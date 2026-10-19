import { IStorage } from './IStorage'
import type { EntityRecord, ListParams, ListResult, StorageCapabilities } from '../../types'
import { sortItems, filterItems, paginate, searchItems } from '../../query/clientFilter'

/**
 * SDK method result with data property
 */
export interface SdkMethodResult<T = unknown> {
  data: T
}

/**
 * SDK interface - generic SDK with callable methods
 */
export interface SdkInstance {
  [methodName: string]: (params?: unknown) => Promise<SdkMethodResult>
}

/**
 * Method configuration - either string name or function callback
 */
export type SdkMethodConfig<T extends EntityRecord = EntityRecord> =
  | string
  | ((sdk: SdkInstance, params: unknown) => Promise<T | T[] | ListResult<T> | void>)

/**
 * Transform functions for request/response
 */
export interface SdkMethodTransforms<T extends EntityRecord = EntityRecord> {
  request?: (params: unknown) => unknown
  response?: (data: T | T[] | ListResult<T>) => T | T[] | ListResult<T>
}

/**
 * Global transform functions
 */
export type SdkGlobalRequestTransform = (operation: string, params: unknown) => unknown
export type SdkGlobalResponseTransform<T extends EntityRecord = EntityRecord> = (
  operation: string,
  data: T | T[] | ListResult<T>
) => T | T[] | ListResult<T>

/**
 * Response format configuration
 */
export interface SdkResponseFormat {
  dataField?: string
  totalField?: string
  itemsField?: string
}

/**
 * SdkStorage methods configuration
 */
export interface SdkMethods<T extends EntityRecord = EntityRecord> {
  list?: SdkMethodConfig<T>
  get?: SdkMethodConfig<T>
  create?: SdkMethodConfig<T>
  update?: SdkMethodConfig<T>
  patch?: SdkMethodConfig<T>
  delete?: SdkMethodConfig<T>
  [key: string]: SdkMethodConfig<T> | undefined
}

/** The options of a path request, as `EntityManager.request` passes them. */
export interface SdkPathRequestOptions {
  data?: unknown
  params?: Record<string, unknown>
  headers?: Record<string, string>
}

/**
 * How a path request (`'GET', 'distinct/status'`) reaches the backend (#4069).
 *
 * A generated SDK has no method for an arbitrary path, and no reliable way
 * to tell its base URL or this entity's endpoint, so the app supplies it —
 * usually through the SDK's own client.
 */
export type SdkPathRequest = (
  method: string,
  path: string,
  options: SdkPathRequestOptions,
  sdk: SdkInstance
) => Promise<unknown>

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

/**
 * SdkStorage options
 */
export interface SdkStorageOptions<T extends EntityRecord = EntityRecord> {
  sdk?: SdkInstance | null
  getSdk?: (() => SdkInstance) | null
  methods?: SdkMethods<T>
  transformRequest?: SdkGlobalRequestTransform | null
  transformResponse?: SdkGlobalResponseTransform<T> | null
  transforms?: Partial<Record<string, SdkMethodTransforms<T>>>
  responseFormat?: SdkResponseFormat | null
  clientSidePagination?: boolean
  /** Runs `request(method, path, options)` calls — `optionsEndpoint` filters among them. */
  request?: SdkPathRequest | null
}

/**
 * SdkStorage - hey-api SDK storage adapter
 *
 * Implements the storage interface using hey-api generated SDKs.
 * Provides config-based method mapping with optional transform callbacks.
 */
export class SdkStorage<T extends EntityRecord = EntityRecord> extends IStorage<T> {
  static storageName = 'SdkStorage'

  static capabilities: StorageCapabilities = {
    supportsTotal: true,
    supportsFilters: true,
    supportsPagination: true,
    supportsCaching: true,
  }

  readonly clientSidePagination: boolean

  protected _sdk: SdkInstance | null
  protected _getSdk: (() => SdkInstance) | null
  protected _methods: SdkMethods<T>
  protected _transformRequest: SdkGlobalRequestTransform | null
  protected _transformResponse: SdkGlobalResponseTransform<T> | null
  protected _transforms: Partial<Record<string, SdkMethodTransforms<T>>>
  protected _responseFormat: SdkResponseFormat | null
  protected _pathRequest: SdkPathRequest | null

  constructor(options: SdkStorageOptions<T> = {}) {
    super()
    const {
      sdk = null,
      getSdk = null,
      methods = {},
      transformRequest = null,
      transformResponse = null,
      transforms = {},
      responseFormat = null,
      clientSidePagination = false,
      request = null,
    } = options

    this._sdk = sdk
    this._getSdk = getSdk
    this._methods = methods
    this._transformRequest = transformRequest
    this._transformResponse = transformResponse
    this._transforms = transforms
    this._responseFormat = responseFormat
    this.clientSidePagination = clientSidePagination
    this._pathRequest = request
  }

  /** Whether `request(method, path)` can run, i.e. a `request` option was given. */
  get supportsPathRequests(): boolean {
    return this._pathRequest !== null
  }

  get sdk(): SdkInstance {
    if (this._getSdk) {
      return this._getSdk()
    }
    if (!this._sdk) {
      throw new Error('SdkStorage: No SDK instance available')
    }
    return this._sdk
  }

  set sdk(value: SdkInstance) {
    this._sdk = value
  }

  protected _getRequestTransform(
    operation: string
  ): ((params: unknown) => unknown) | SdkGlobalRequestTransform | null {
    const methodTransforms = this._transforms[operation]
    if (methodTransforms?.request) {
      return methodTransforms.request
    }
    return this._transformRequest
  }

  protected _getResponseTransform(
    operation: string
  ):
    | ((data: T | T[] | ListResult<T>) => T | T[] | ListResult<T>)
    | SdkGlobalResponseTransform<T>
    | null {
    const methodTransforms = this._transforms[operation]
    if (methodTransforms?.response) {
      return methodTransforms.response
    }
    return this._transformResponse
  }

  protected _getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    if (!path || !obj) return undefined
    return path.split('.').reduce((acc: unknown, part) => {
      if (acc && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[part]
      }
      return undefined
    }, obj)
  }

  protected _normalizeListResponse(data: unknown): ListResult<T> {
    if (Array.isArray(data)) {
      return { items: data as T[], total: data.length }
    }

    if (!data || typeof data !== 'object') {
      return { items: [], total: 0 }
    }

    const dataObj = data as Record<string, unknown>
    const format = this._responseFormat
    let items: T[] | undefined
    let total: number | undefined

    if (format) {
      if (format.itemsField) {
        items = this._getNestedValue(dataObj, format.itemsField) as T[] | undefined
      } else if (format.dataField) {
        items = dataObj[format.dataField] as T[] | undefined
      }

      if (format.totalField) {
        total = dataObj[format.totalField] as number | undefined
      }
    }

    if (!Array.isArray(items)) {
      items = (dataObj.items || dataObj.data || dataObj.results || []) as T[]
    }

    if (!Array.isArray(items)) {
      items = []
    }

    if (total === undefined || total === null) {
      total =
        (dataObj.total as number | undefined) ??
        (dataObj.count as number | undefined) ??
        items.length
    }

    return { items, total }
  }

  protected async _execute(
    operation: string,
    params: unknown
  ): Promise<T | T[] | ListResult<T> | void> {
    const methodConfig = this._methods[operation]

    if (!methodConfig) {
      throw new Error(`SdkStorage: No method configured for operation '${operation}'`)
    }

    const sdk = this.sdk

    let transformedParams = params
    const requestTransform = this._getRequestTransform(operation)
    if (requestTransform) {
      const isMethodSpecific = this._transforms[operation]?.request === requestTransform
      transformedParams = isMethodSpecific
        ? (requestTransform as (params: unknown) => unknown)(params)
        : (requestTransform as SdkGlobalRequestTransform)(operation, params)
    }

    let result: T | T[] | ListResult<T> | void

    if (typeof methodConfig === 'function') {
      result = await methodConfig(sdk, transformedParams)
    } else if (typeof methodConfig === 'string') {
      const sdkMethod = sdk[methodConfig]
      if (typeof sdkMethod !== 'function') {
        throw new Error(`SdkStorage: SDK method '${methodConfig}' not found`)
      }
      const response = await sdkMethod.call(sdk, transformedParams)
      result = response.data as T | T[] | ListResult<T>
    } else {
      throw new Error(
        `SdkStorage: Invalid method config for '${operation}' - expected string or function`
      )
    }

    if (operation === 'list') {
      result = this._normalizeListResponse(result)
    }

    const responseTransform = this._getResponseTransform(operation)
    if (responseTransform && result !== undefined) {
      const isMethodSpecific = this._transforms[operation]?.response === responseTransform
      result = isMethodSpecific
        ? (
            responseTransform as (data: T | T[] | ListResult<T>) => T | T[] | ListResult<T>
          )(result as T | T[] | ListResult<T>)
        : (responseTransform as SdkGlobalResponseTransform<T>)(
            operation,
            result as T | T[] | ListResult<T>
          )
    }

    return result
  }

  async list(params: ListParams = {}): Promise<ListResult<T>> {
    const { page = 1, page_size = 20, sort_by, sort_order = 'asc', filters = {}, search } = params

    // `search` goes to the SDK with everything else (#2147). It was dropped
    // here, so a search box over an SDK-backed entity typed into the void:
    // the call went out without the term and the rows came back unfiltered,
    // with nothing anywhere saying why.
    const queryParams = { query: { page, page_size, sort_by, sort_order, search, ...filters } }
    const data = (await this._execute('list', queryParams)) as ListResult<T>

    let { items, total } = data

    if (!Array.isArray(items)) {
      items = []
      total = 0
    }

    if (this.clientSidePagination && items.length > 0) {
      total = items.length

      // Shared pipeline (#1192) — original order preserved: sort, then
      // filter (substring semantics), then paginate.
      //
      // The search is applied here TOO, not only sent (#2147). An SDK that
      // ignores the term would otherwise hand back the whole collection and
      // this branch would paginate it as if it had been searched.
      items = sortItems([...items], sort_by, sort_order)
      items = filterItems(items, filters, { stringMatch: 'includes' })
      items = searchItems(items, search)
      total = items.length
      items = paginate(items, page, page_size)
    }

    return { items, total }
  }

  async get(id: string | number): Promise<T> {
    const pathParams = { path: { id } }
    return (await this._execute('get', pathParams)) as T
  }

  async create(data: Partial<T>): Promise<T> {
    const bodyParams = { body: data }
    return (await this._execute('create', bodyParams)) as T
  }

  async update(id: string | number, data: Partial<T>): Promise<T> {
    const params = { path: { id }, body: data }
    return (await this._execute('update', params)) as T
  }

  async patch(id: string | number, data: Partial<T>): Promise<T> {
    const params = { path: { id }, body: data }
    return (await this._execute('patch', params)) as T
  }

  async delete(id: string | number): Promise<void> {
    const pathParams = { path: { id } }
    await this._execute('delete', pathParams)
  }

  /**
   * Two calls share this name. `request('GET', 'distinct/status', options)` is
   * the path request every storage answers, the one `EntityManager.request`
   * makes; it goes through the `request` option. `request('getStats', params)`
   * calls a configured method or an SDK method by name.
   *
   * Told apart by the verb: no SDK method is called `GET`, and before #4069
   * the path form looked one up and failed with "SDK method 'GET' not found".
   */
  async request<R = unknown>(methodName: string, params: unknown = {}, options: SdkPathRequestOptions = {}): Promise<R> {
    if (HTTP_METHODS.has(methodName) && typeof params === 'string') {
      if (!this._pathRequest) {
        throw new Error(
          `SdkStorage cannot run ${methodName} '${params}': a generated SDK has no method for a path. ` +
            `Pass a request option, e.g. request: (method, url, o, sdk) => sdk.client.request({ method, url, query: o.params, body: o.data })`
        )
      }
      return (await this._pathRequest(methodName, params, options, this.sdk)) as R
    }

    if (this._methods[methodName]) {
      return (await this._execute(methodName, params)) as R
    }

    const sdk = this.sdk
    const sdkMethod = sdk[methodName]
    if (typeof sdkMethod !== 'function') {
      throw new Error(`SdkStorage: SDK method '${methodName}' not found`)
    }

    const response = await sdkMethod.call(sdk, params)
    return response.data as R
  }
}

/**
 * Factory function to create an SdkStorage
 */
export function createSdkStorage<T extends EntityRecord = EntityRecord>(
  options: SdkStorageOptions<T>
): SdkStorage<T> {
  return new SdkStorage(options)
}
