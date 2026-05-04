/**
 * @quazardous/qdcore/entity — entity layer contracts.
 *
 * Pure types. No implementation. The actual implementations live in
 * qdadm (in-process EntityManager), qdcms-frontend (ApiStorage), and
 * qdcms-backend (SqlBackendStorage on top of MikroORM).
 *
 * Vocabulary alignment (mirrors the docs/qdcms-glossary.md proposal):
 *
 *   Entity            — business concept (e.g. "Event"); just a name
 *   EntityDescriptor  — runtime schema (fields, relations, validation rules)
 *   EntityRegistry    — collection of descriptors, indexed by name
 *   Repository<T>     — typed CRUD/query access for one entity
 *   EntityManager     — façade routing to repos, cache + signals (qdadm/qdcms layer)
 *   BackendStorage    — schema-aware, transactional, server-owned
 *   FrontendStorage   — cache + invalidation + API client, browser-owned
 *
 * Static vs dynamic entities is NOT a framework concern — both register the
 * same descriptor shape; only the source of the descriptor differs (compile-
 * time class, codegen, runtime YAML, …).
 */

// ─── Field configuration ──────────────────────────────────────────────────

/**
 * The portable field types. Implementations map these to dialect-specific
 * column types. Keep this list intentionally small; richer types are layered
 * on top via {@link EntityFieldConfig.dbType} (escape hatch).
 */
export type EntityFieldType =
  | 'uuid'
  | 'string'
  | 'text'
  | 'integer'
  | 'bigint'
  | 'float'
  | 'boolean'
  | 'json'
  | 'date'
  | 'datetime'
  | 'timestamp'

export interface EntityFieldConfig {
  type: EntityFieldType
  /** Marks the field as part of the primary key. Multiple fields = composite PK. */
  pk?: boolean
  /** Allow NULL. Default false. */
  nullable?: boolean
  /** Unique constraint at the DB level. */
  unique?: boolean
  /** Default value (literal, or `'now'` shorthand for current timestamp). */
  default?: unknown
  /** String length (only for `string`). */
  length?: number
  /** Foreign key target — `'tableName.columnName'`. */
  fk?: string
  /** Behaviour on delete of the referenced row (only when `fk` is set). */
  onDelete?: 'cascade' | 'restrict' | 'set null' | 'no action'
  /** Behaviour on update of the referenced row. */
  onUpdate?: 'cascade' | 'restrict' | 'set null' | 'no action'
  /**
   * Override the dialect-mapped DB type. Use sparingly — breaks portability.
   * Example: `dbType: 'tsvector'` on Postgres.
   */
  dbType?: string
  /**
   * The plugin id that owns this field. Auto-populated by the schema
   * composer when fields are merged from multi-plugin contributions; the
   * owner is what the OwnershipTracker reads to decide what to drop on
   * uninstall.
   */
  owner?: string
}

// ─── Index / constraint definitions ───────────────────────────────────────

export interface EntityIndexConfig {
  /** Column names participating in the index. */
  fields: string[]
  /** Unique index. */
  unique?: boolean
  /** Optional name; defaults to a deterministic `idx_table_field1_field2`. */
  name?: string
  /** The plugin id that owns this index. */
  owner?: string
}

// ─── Entity descriptor ────────────────────────────────────────────────────

/**
 * A fully-described entity ready to register. Whether it came from a
 * decorated class, codegen, or a YAML file is invisible at this layer.
 */
export interface EntityDescriptor {
  /** Logical name (singular, snake_case recommended): `'event'`, `'post_meta'`. */
  name: string
  /**
   * Physical table name. Implementations compose this with the plugin
   * prefix; the registry stores it post-prefix (e.g. `dc_post_meta`).
   */
  tableName: string
  fields: Record<string, EntityFieldConfig>
  indexes?: EntityIndexConfig[]
  /** The plugin that owns this entity (populated by the composer). */
  owner?: string
}

// ─── Registry ─────────────────────────────────────────────────────────────

/**
 * Holds descriptors keyed by name. The composer feeds it; consumers read
 * from it. Mutations should go through the plugin lifecycle, never direct.
 */
export interface EntityRegistry {
  register(descriptor: EntityDescriptor): void
  unregister(name: string): void
  get(name: string): EntityDescriptor | undefined
  list(): EntityDescriptor[]
  has(name: string): boolean
  /** Listing of entities owned by a given plugin. */
  ownedBy(plugin: string): EntityDescriptor[]
}

// ─── Repository<T> ────────────────────────────────────────────────────────

export interface Query<T> {
  where?: Partial<T> | Record<string, unknown>
  orderBy?: Record<string, 'asc' | 'desc'>
  limit?: number
  offset?: number
}

/**
 * Typed CRUD/query surface for one entity. Implementations decide whether
 * `T` is a plain object, a class instance, or a proxy — the contract only
 * requires the shape.
 */
export interface Repository<T> {
  find(id: string | number): Promise<T | null>
  list(query?: Query<T>): Promise<T[]>
  count(query?: Query<T>): Promise<number>
  create(data: Partial<T>): Promise<T>
  update(id: string | number, data: Partial<T>): Promise<T>
  delete(id: string | number): Promise<void>
}

// ─── Storage contracts (split frontend vs backend) ────────────────────────

/**
 * Backend storage: schema-aware, transactional, server-owned. This is what
 * a `qdcms-backend` instance binds to (SQLite/MariaDB/Postgres via MikroORM).
 *
 * The contract is intentionally minimal — concrete implementations expose
 * tool-specific extras (transactions, raw queries) through their own
 * extended interfaces. This keeps qdcore decoupled from any specific ORM.
 */
export interface BackendStorage {
  /** Open the connection / pool. Idempotent. */
  connect(): Promise<void>
  /** Close cleanly. */
  disconnect(): Promise<void>
  /** Get a typed repository for an entity name. */
  repository<T>(entityName: string): Repository<T>
  /** Run a function inside a transaction (best-effort across drivers). */
  transaction<R>(fn: (tx: BackendStorage) => Promise<R>): Promise<R>
}

/**
 * Frontend storage: API client + cache + signal-driven invalidation,
 * browser-owned. This is what `qdcms-frontend` blocks bind to.
 *
 * Reads go through the cache; writes hit the API and invalidate. Offline-
 * first / IndexedDB / SW are not part of the v1 contract — add via
 * extension if needed.
 */
export interface FrontendStorage {
  repository<T>(entityName: string): Repository<T>
  /** Manually invalidate cached entries for an entity. */
  invalidate(entityName: string, id?: string | number): void
  /** Drop all caches. */
  clear(): void
}
