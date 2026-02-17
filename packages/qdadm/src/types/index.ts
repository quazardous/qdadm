/**
 * Core types for qdadm framework
 */

// ============ ENTITY TYPES ============

/**
 * Base interface for all entity records
 */
export interface EntityRecord {
  id: string | number
  [key: string]: unknown
}

/**
 * Parameters for list operations
 */
export interface ListParams {
  page?: number
  page_size?: number
  search?: string
  filters?: Record<string, unknown>
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  cacheSafe?: boolean
  [key: string]: unknown
}

/**
 * Result of list operations
 */
export interface ListResult<T = EntityRecord> {
  items: T[]
  total: number
  fromCache?: boolean
}

// ============ STORAGE TYPES ============

/**
 * Storage capabilities declaration
 */
export interface StorageCapabilities {
  supportsTotal: boolean
  supportsFilters: boolean
  supportsPagination: boolean
  supportsCaching: boolean
  requiresAuth?: boolean
  searchFields?: string[]
  /** Cache TTL in milliseconds (0=disabled, -1=infinite, >0=TTL). Can be set dynamically from API headers. */
  cacheTtlMs?: number
  /** Asymmetric mode: list() and get() return different structures. Falls back from EntityManagerOptions. */
  asymmetric?: boolean
}

// ============ FIELD TYPES ============

/**
 * Field type definitions
 */
export type FieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'datetime'
  | 'email'
  | 'url'
  | 'textarea'
  | 'password'
  | 'array'
  | 'object'
  | 'json'
  | string

/**
 * Field configuration
 */
export interface FieldConfig {
  type: FieldType
  label?: string
  required?: boolean
  default?: unknown | (() => unknown)
  options?: Array<{ label: string; value: unknown }>
  reference?: {
    entity: string
    labelField?: string
    valueField?: string
  }
  listable?: boolean
  editable?: boolean
  sortable?: boolean
  filterable?: boolean
  searchable?: boolean
  validator?: (value: unknown) => boolean | string
  [key: string]: unknown
}

// ============ ENTITY MANAGER TYPES ============

/**
 * Child entity configuration
 */
export interface ChildConfig {
  entity: string
  endpoint?: string
}

/**
 * Parent entity configuration
 */
export interface ParentConfig {
  entity: string
  foreignKey: string
}

/**
 * Relation configuration
 */
export interface RelationConfig {
  entity: string
  through?: string
}

/**
 * Navigation configuration for auto-generated menus
 */
export interface NavConfig {
  icon?: string
  section?: string
  weight?: number
  visible?: boolean | (() => boolean)
}

/**
 * EntityManager constructor options
 */
export interface EntityManagerOptions<T extends EntityRecord = EntityRecord> {
  name: string
  storage?: IStorage<T> | null
  idField?: string
  label?: string
  labelPlural?: string
  routePrefix?: string
  labelField?: string | ((entity: T) => string)
  fields?: Record<string, FieldConfig>
  localFilterThreshold?: number | null
  /** Cache TTL in milliseconds (0=disabled, -1=infinite, >0=TTL). Overrides global, overridden by storage. */
  cacheTtlMs?: number | null
  /** Asymmetric mode: list() and get() return different structures. get() skips list cache. */
  asymmetric?: boolean
  /** Detail cache TTL in milliseconds (0=disabled (default), -1=infinite, >0=TTL). Only used when asymmetric=true. */
  detailCacheTtlMs?: number
  readOnly?: boolean
  warmup?: boolean
  authSensitive?: boolean
  system?: boolean
  scopeWhitelist?: string[] | null
  isOwn?: ((record: T, user: unknown) => boolean) | null
  children?: Record<string, ChildConfig>
  parent?: ParentConfig | null
  parents?: Record<string, ParentConfig>
  relations?: Record<string, RelationConfig>
  authAdapter?: EntityAuthAdapter | null
  nav?: NavConfig
}

// ============ AUTH TYPES ============

/**
 * Standard auth actions
 */
export type AuthAction = 'read' | 'list' | 'create' | 'update' | 'delete'

/**
 * Entity auth adapter interface
 */
export interface EntityAuthAdapter {
  canPerform(entity: string, action: AuthAction): boolean
  canAccessRecord?(entity: string, record: unknown): boolean
  isGranted?(permission: string, record?: unknown): boolean
  getCurrentUser?(): unknown
}

// ============ SIGNAL TYPES ============

/**
 * Signal handler context
 */
export interface ListenerContext {
  id?: string
  cancel: () => void
  emit: (signal: string, payload: unknown) => Promise<void>
}

/**
 * Signal event object
 */
export interface SignalEvent {
  name: string
  data: unknown
}

/**
 * Signal handler function
 */
export type SignalHandler = (
  event: SignalEvent,
  ctx: ListenerContext
) => void | Promise<void>

// ============ HOOK TYPES ============

/**
 * Hook registration options
 */
export interface HookOptions {
  priority?: number
  id?: string
  after?: string | string[]
  once?: boolean
}

/**
 * Hook event object
 */
export interface HookEvent {
  name: string
  data: unknown
  cancel: () => void
}

/**
 * Hook handler function
 */
export type HookHandler = (event: HookEvent) => void | Promise<void>

// ============ PERMISSION TYPES ============

/**
 * Permission definition
 */
export interface PermissionDefinition {
  key: string
  namespace: string
  action: string
  module: string | null
  label: string
  description: string | null
  custom: boolean
}

// ============ FORWARD DECLARATIONS ============

// These will be properly typed when their modules are converted

/**
 * IStorage interface (forward declaration)
 */
export interface IStorage<T extends EntityRecord = EntityRecord> {
  list(params?: ListParams, context?: unknown): Promise<ListResult<T>>
  get(id: string | number, context?: unknown): Promise<T | null>
  create(data: Partial<T>): Promise<T>
  update(id: string | number, data: Partial<T>): Promise<T>
  patch?(id: string | number, data: Partial<T>): Promise<T>
  delete(id: string | number): Promise<void>
  request?(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    options?: RequestOptions
  ): Promise<unknown>
  reset?(): void
}

/**
 * Request options for storage
 */
export interface RequestOptions {
  data?: unknown
  params?: Record<string, unknown>
  headers?: Record<string, string>
  context?: unknown
}
