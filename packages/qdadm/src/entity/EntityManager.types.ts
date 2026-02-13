import type {
  EntityRecord,
  ListResult,
  IStorage,
  FieldConfig,
  ChildConfig,
  ParentConfig,
  RelationConfig,
  NavConfig,
  StorageCapabilities,
} from '../types'
import type { AuthUser, EntityAuthAdapter as IEntityAuthAdapter } from './auth/EntityAuthAdapter'
import type { SignalBus } from '../kernel/SignalBus'
import type { HookRegistry } from '../hooks/HookRegistry'

// Circular type import — safe because `import type` is erased at runtime
import type { EntityManager } from './EntityManager'

// ============ INTERNAL TYPES ============

/**
 * Cache state for local filtering
 */
export interface CacheState<T> {
  items: T[]
  total: number
  loadedAt: number | null
  valid: boolean
}

/**
 * Operation stats for debugging
 */
export interface OperationStats {
  list: number
  get: number
  create: number
  update: number
  delete: number
  cacheHits: number
  cacheMisses: number
  maxItemsSeen: number
  maxTotal: number
}

/**
 * Resolved storage result
 */
export interface ResolvedStorage<T extends EntityRecord> {
  storage: IStorage<T> | null | undefined
  endpoint?: string
  params?: Record<string, unknown>
  isDynamic?: boolean
}

/**
 * Storage resolution result (what resolveStorage returns)
 */
export type StorageResolution<T extends EntityRecord> =
  | string
  | ((context: RoutingContext | undefined) => string)
  | {
      storage?: IStorage<T> | null
      endpoint?: string | ((context: RoutingContext | undefined) => string)
      params?: Record<string, unknown>
    }
  | null
  | undefined

/**
 * Routing context for multi-storage patterns
 */
export interface RoutingContext {
  parentChain?: Array<{ entity: string; id: string | number }>
  [key: string]: unknown
}

/**
 * Presave hook context
 */
export interface PresaveContext<T extends EntityRecord = EntityRecord> {
  entity: string
  record: Partial<T>
  isNew: boolean
  id?: string | number
  manager: EntityManager<T>
}

/**
 * Postsave hook context
 */
export interface PostsaveContext<T extends EntityRecord = EntityRecord> {
  entity: string
  record: Partial<T>
  result: T
  isNew: boolean
  id?: string | number
  manager: EntityManager<T>
}

/**
 * Predelete hook context
 */
export interface PredeleteContext<T extends EntityRecord = EntityRecord> {
  entity: string
  id: string | number
  manager: EntityManager<T>
}

/**
 * Query options
 */
export interface QueryOptions {
  context?: WhitelistContext
  routingContext?: RoutingContext | null
}

/**
 * Whitelist check context
 */
export interface WhitelistContext {
  module?: string
  scope?: string
  form?: string
  field?: string
  bypassPermissions?: boolean
  reason?: string
}

/**
 * Cache info for debugging
 */
export interface CacheInfo {
  enabled: boolean
  storageSupportsTotal: boolean
  threshold: number
  valid: boolean
  overflow: boolean
  itemCount: number
  total: number
  loadedAt: number | null
  /** Effective TTL in milliseconds (0 = no TTL) */
  ttlMs: number
  /** Timestamp when cache expires (null if no TTL) */
  expiresAt: number | null
  /** Whether the cache has expired based on TTL */
  expired: boolean
}

/**
 * Badge descriptor for entity item headers
 */
export interface EntityBadge {
  label: string
  severity?: 'secondary' | 'info' | 'success' | 'warn' | 'danger' | 'contrast'
}

/**
 * Rich severity descriptor for a field value.
 * Extends beyond a simple severity string to support icons and label overrides.
 */
export interface SeverityDescriptor {
  severity: string
  icon?: string
  label?: string
}

/** A severity map value: plain string (backward compat) or rich descriptor */
export type SeverityMapValue = string | SeverityDescriptor

/** Severity map: field value → severity string or descriptor */
export type SeverityMap = Record<string, SeverityMapValue>

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
  /** Callback to compute badges for an entity item header */
  badges?: (entity: T) => EntityBadge[]
  fields?: Record<string, FieldConfig>
  localFilterThreshold?: number | null
  /** Cache TTL in milliseconds (0=disabled, -1=infinite, >0=TTL). Overrides global, overridden by storage. */
  cacheTtlMs?: number | null
  readOnly?: boolean
  warmup?: boolean
  authSensitive?: boolean
  system?: boolean
  scopeWhitelist?: string[] | null
  isOwn?: ((record: T, user: AuthUser) => boolean) | null
  children?: Record<string, ChildConfig>
  parent?: ParentConfig | null
  parents?: Record<string, ParentConfig>
  relations?: Record<string, RelationConfig>
  authAdapter?: IEntityAuthAdapter | null
  nav?: NavConfig
}

// Forward declaration for Orchestrator (to avoid circular deps)
export interface Orchestrator {
  get<T extends EntityRecord>(name: string): EntityManager<T> | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kernel?: any
  deferred?: DeferredRegistry | null
}

// Forward declaration for DeferredRegistry
export interface DeferredRegistry {
  has(key: string): boolean
  await(key: string): Promise<unknown>
  queue<T>(key: string, fn: () => Promise<T>): Promise<T>
}

/**
 * Exposes protected members of EntityManager for use by prototype-patched helper methods.
 * @internal
 */
export type EntityManagerInternal<T extends EntityRecord = EntityRecord> = EntityManager<T> & {
  // Protected fields accessed by helpers
  _cache: CacheState<T>
  _cacheLoading: Promise<boolean> | null
  _cacheTtlMs: number | null
  _orchestrator: Orchestrator | null
  _parents: Record<string, ParentConfig>
  _parent: ParentConfig | null
  _children: Record<string, ChildConfig>
  _authSensitive: boolean
  _signals: SignalBus | null
  _signalCleanup: (() => void) | null
  _warmup: boolean
  _stats: OperationStats

  // Protected methods that stay in the class body
  _normalizeResolveResult(result: StorageResolution<T>, context?: RoutingContext): ResolvedStorage<T>
  _buildPresaveContext(data: Partial<T>, isNew: boolean, id?: string | number | null): PresaveContext<T>
  _buildPostsaveContext(data: Partial<T>, result: T, isNew: boolean, id?: string | number | null): PostsaveContext<T>
  _buildPredeleteContext(id: string | number): PredeleteContext<T>
  _emitSignal(action: 'created' | 'updated' | 'deleted', data: Record<string, unknown>): void
  _emitDataInvalidate(action: 'created' | 'updated' | 'deleted', id: string | number | undefined): void
  _invokeHook(hookName: string, context: Record<string, unknown>): Promise<void>
}

// Re-export types used by helpers
export type { EntityRecord, ListResult, IStorage, StorageCapabilities }
export type { SignalBus, HookRegistry }
