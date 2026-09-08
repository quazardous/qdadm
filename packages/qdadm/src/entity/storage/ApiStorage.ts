import { IStorage } from './IStorage'
import type { EntityRecord, ListParams, ListResult, StorageCapabilities } from '../../types'

/**
 * HTTP client interface compatible with axios
 */
export interface HttpClient {
  get<T = unknown>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T }>
  post<T = unknown>(url: string, data?: unknown): Promise<{ data: T }>
  put<T = unknown>(url: string, data?: unknown): Promise<{ data: T }>
  patch<T = unknown>(url: string, data?: unknown): Promise<{ data: T }>
  delete<T = unknown>(url: string): Promise<{ data: T }>
  request<T = unknown>(config: {
    method: string
    url: string
    data?: unknown
    params?: Record<string, unknown>
    headers?: Record<string, string>
  }): Promise<{ data: T }>
}

/**
 * Routing context for normalize functions
 */
export interface RoutingContext {
  parentChain?: Array<{ entity: string; id: string }>
  path?: string
}

/**
 * ApiStorage options
 */
export interface ApiStorageOptions<T extends EntityRecord = EntityRecord> {
  endpoint: string
  client?: HttpClient | null
  getClient?: (() => HttpClient) | null
  responseItemsKey?: string
  responseTotalKey?: string
  /**
   * Response HEADER carrying the total, for APIs that report it there rather
   * than in the body (`X-Total-Count` is the json-server convention). Read
   * before `responseTotalKey`. The header must be CORS-exposed to be
   * readable from a browser.
   */
  responseTotalHeader?: string | null
  paramMapping?: Record<string, string>
  normalize?: ((data: T, context?: RoutingContext | null) => T) | null
  denormalize?: ((data: Partial<T>) => Partial<T>) | null
}

/**
 * ApiStorage - REST API storage adapter
 *
 * Implements the storage interface for REST APIs.
 * Expects standard response format: { items: [], total: number, page: number }
 */
export class ApiStorage<T extends EntityRecord = EntityRecord> extends IStorage<T> {
  static storageName = 'ApiStorage'

  static capabilities: StorageCapabilities = {
    supportsTotal: true,
    supportsFilters: true,
    supportsPagination: true,
    supportsCaching: true,
  }

  readonly endpoint: string
  readonly responseItemsKey: string
  readonly responseTotalKey: string
  readonly responseTotalHeader: string | null
  readonly paramMapping: Record<string, string>

  protected _client: HttpClient | null
  protected _getClient: (() => HttpClient) | null
  protected _normalize: ((data: T, context?: RoutingContext | null) => T) | null
  protected _denormalize: ((data: Partial<T>) => Partial<T>) | null

  constructor(options: ApiStorageOptions<T>) {
    super()
    const {
      endpoint,
      client = null,
      getClient = null,
      responseItemsKey = 'items',
      responseTotalKey = 'total',
      responseTotalHeader = null,
      paramMapping = {},
      normalize = null,
      denormalize = null,
    } = options

    this.endpoint = endpoint
    this._client = client
    this._getClient = getClient
    this.responseItemsKey = responseItemsKey
    this.responseTotalKey = responseTotalKey
    this.responseTotalHeader = responseTotalHeader
    this.paramMapping = paramMapping
    this._normalize = normalize
    this._denormalize = denormalize
  }

  /**
   * Rename outgoing query parameters to the backend's vocabulary.
   *
   * Applies to filters AND to the pagination/sort keys (#2113) — see `list()`.
   */
  protected _applyParamMapping(params: Record<string, unknown>): Record<string, unknown> {
    if (!this.paramMapping || Object.keys(this.paramMapping).length === 0) {
      return params
    }
    const mapped: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(params)) {
      const mappedKey = this.paramMapping[key] || key
      mapped[mappedKey] = value
    }
    return mapped
  }

  /**
   * Normalize API response data to internal format
   */
  protected _normalizeData(data: T | T[], context: RoutingContext | null = null): T | T[] {
    if (!this._normalize) return data
    if (Array.isArray(data)) {
      return data.map((item) => this._normalize!(item, context))
    }
    return this._normalize(data, context)
  }

  /**
   * Denormalize internal data to API format
   */
  protected _denormalizeData(data: Partial<T>): Partial<T> {
    if (!this._denormalize) return data
    return this._denormalize(data)
  }

  get client(): HttpClient {
    if (this._getClient) {
      return this._getClient()
    }
    if (!this._client) {
      throw new Error('ApiStorage: No HTTP client configured')
    }
    return this._client
  }

  set client(value: HttpClient) {
    this._client = value
  }

  async list(params: ListParams = {}, context: RoutingContext | null = null): Promise<ListResult<T>> {
    const { page = 1, page_size = 20, sort_by, sort_order, filters = {} } = params

    // `paramMapping` covers the WHOLE outgoing query, pagination included
    // (#2113). It used to be applied to the filters only, so `status` could
    // be renamed to `state` but `page_size` could not be renamed to `limit` —
    // and an API speaking any other pagination dialect had to subclass the
    // storage for that alone. The names qdadm uses internally are its own
    // business; what goes on the wire is the backend's.
    //
    // Filters keep their precedence over the pagination keys, exactly as
    // before: a filter named `page` still wins, for better or worse.
    const outgoing = { page, page_size, sort_by, sort_order, ...filters }

    const response = await this.client.get<Record<string, unknown>>(this.endpoint, {
      params: this._applyParamMapping(outgoing),
    })

    const data = response.data
    const rawItems = (data[this.responseItemsKey] || data.items || data) as T[]
    const items = this._normalizeData(rawItems, context) as T[]

    return {
      items,
      total:
        this._totalFromHeader(response) ??
        ((data[this.responseTotalKey] as number) ||
          (data.total as number) ||
          (Array.isArray(data) ? data.length : 0)),
    }
  }

  /**
   * Total announced in a response header, when `responseTotalHeader` says so.
   *
   * Returns null — not 0 — when there is nothing to read, so the body-based
   * fallbacks still get their turn. A 0 from the server is a real answer and
   * is preserved.
   */
  protected _totalFromHeader(response: unknown): number | null {
    if (!this.responseTotalHeader) return null

    const headers = (response as { headers?: unknown })?.headers as
      | { get?: (name: string) => unknown }
      | Record<string, unknown>
      | undefined
    if (!headers) return null

    const raw =
      typeof (headers as { get?: unknown }).get === 'function'
        ? (headers as { get: (name: string) => unknown }).get(this.responseTotalHeader)
        : (headers as Record<string, unknown>)[this.responseTotalHeader.toLowerCase()]

    if (raw === null || raw === undefined || raw === '') return null
    const total = Number(raw)
    return Number.isFinite(total) ? total : null
  }

  async get(id: string | number, context: RoutingContext | null = null): Promise<T> {
    const response = await this.client.get<T>(`${this.endpoint}/${id}`)
    return this._normalizeData(response.data, context) as T
  }

  async create(data: Partial<T>): Promise<T> {
    const apiData = this._denormalizeData(data)
    const response = await this.client.post<T>(this.endpoint, apiData)
    return this._normalizeData(response.data) as T
  }

  async update(id: string | number, data: Partial<T>): Promise<T> {
    const apiData = this._denormalizeData(data)
    const response = await this.client.put<T>(`${this.endpoint}/${id}`, apiData)
    return this._normalizeData(response.data) as T
  }

  async patch(id: string | number, data: Partial<T>): Promise<T> {
    const apiData = this._denormalizeData(data)
    const response = await this.client.patch<T>(`${this.endpoint}/${id}`, apiData)
    return this._normalizeData(response.data) as T
  }

  async delete(id: string | number): Promise<void> {
    await this.client.delete(`${this.endpoint}/${id}`)
  }

  /**
   * Generic request for special operations
   */
  async request<R = T>(
    method: string,
    endpoint: string,
    options: {
      data?: unknown
      params?: Record<string, unknown>
      headers?: Record<string, string>
      context?: RoutingContext | null
    } = {}
  ): Promise<R> {
    const { context, ...requestOptions } = options
    const url = endpoint.startsWith('/') ? endpoint : `${this.endpoint}/${endpoint}`
    const response = await this.client.request<R>({
      method,
      url,
      data: requestOptions.data,
      params: requestOptions.params,
      headers: requestOptions.headers,
    })
    return this._normalizeData(response.data as unknown as T, context) as unknown as R
  }
}

/**
 * Factory function to create an ApiStorage
 */
export function createApiStorage<T extends EntityRecord = EntityRecord>(
  options: ApiStorageOptions<T>
): ApiStorage<T> {
  return new ApiStorage(options)
}
