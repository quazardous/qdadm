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

  /** @deprecated Use static ApiStorage.capabilities.supportsCaching instead */
  get supportsCaching(): boolean {
    return ApiStorage.capabilities.supportsCaching
  }

  readonly endpoint: string
  readonly responseItemsKey: string
  readonly responseTotalKey: string
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
      paramMapping = {},
      normalize = null,
      denormalize = null,
    } = options

    this.endpoint = endpoint
    this._client = client
    this._getClient = getClient
    this.responseItemsKey = responseItemsKey
    this.responseTotalKey = responseTotalKey
    this.paramMapping = paramMapping
    this._normalize = normalize
    this._denormalize = denormalize
  }

  /**
   * Apply parameter mapping to transform filter names
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

    const mappedFilters = this._applyParamMapping(filters)

    const response = await this.client.get<Record<string, unknown>>(this.endpoint, {
      params: { page, page_size, sort_by, sort_order, ...mappedFilters },
    })

    const data = response.data
    const rawItems = (data[this.responseItemsKey] || data.items || data) as T[]
    const items = this._normalizeData(rawItems, context) as T[]

    return {
      items,
      total:
        (data[this.responseTotalKey] as number) ||
        (data.total as number) ||
        (Array.isArray(data) ? data.length : 0),
    }
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
