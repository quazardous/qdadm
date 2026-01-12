import { IStorage } from './IStorage'
import type { EntityRecord, ListParams, ListResult, StorageCapabilities } from '../../types'

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

  /** @deprecated Use SdkStorage.capabilities.supportsCaching instead */
  get supportsCaching(): boolean {
    return SdkStorage.capabilities.supportsCaching
  }

  readonly clientSidePagination: boolean

  protected _sdk: SdkInstance | null
  protected _getSdk: (() => SdkInstance) | null
  protected _methods: SdkMethods<T>
  protected _transformRequest: SdkGlobalRequestTransform | null
  protected _transformResponse: SdkGlobalResponseTransform<T> | null
  protected _transforms: Partial<Record<string, SdkMethodTransforms<T>>>
  protected _responseFormat: SdkResponseFormat | null

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
    } = options

    this._sdk = sdk
    this._getSdk = getSdk
    this._methods = methods
    this._transformRequest = transformRequest
    this._transformResponse = transformResponse
    this._transforms = transforms
    this._responseFormat = responseFormat
    this.clientSidePagination = clientSidePagination
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
    const { page = 1, page_size = 20, sort_by, sort_order = 'asc', filters = {} } = params

    const queryParams = { query: { page, page_size, sort_by, sort_order, ...filters } }
    const data = (await this._execute('list', queryParams)) as ListResult<T>

    let { items, total } = data

    if (!Array.isArray(items)) {
      items = []
      total = 0
    }

    if (this.clientSidePagination && items.length > 0) {
      total = items.length

      if (sort_by) {
        items = [...items].sort((a, b) => {
          const aVal = a[sort_by as keyof T]
          const bVal = b[sort_by as keyof T]
          if (aVal === undefined || aVal === null) return 1
          if (bVal === undefined || bVal === null) return -1
          if (aVal < bVal) return sort_order === 'asc' ? -1 : 1
          if (aVal > bVal) return sort_order === 'asc' ? 1 : -1
          return 0
        })
      }

      for (const [key, value] of Object.entries(filters)) {
        if (value === null || value === undefined || value === '') continue
        items = items.filter((item) => {
          const itemValue = item[key as keyof T]
          if (typeof value === 'string' && typeof itemValue === 'string') {
            return itemValue.toLowerCase().includes(value.toLowerCase())
          }
          return itemValue === value
        })
      }

      total = items.length

      const start = (page - 1) * page_size
      items = items.slice(start, start + page_size)
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

  async request<R = unknown>(methodName: string, params: unknown = {}): Promise<R> {
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
