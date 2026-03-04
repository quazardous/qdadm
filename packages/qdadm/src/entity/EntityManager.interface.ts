/**
 * EntityManager - Minimal decoupled interfaces
 *
 * Centralizes the lightweight "structural" interfaces that composables
 * and other modules use instead of importing the full EntityManager class.
 *
 * Design: tiered hierarchy — pick the smallest interface that fits.
 *
 *   EntityManagerBase        ← identity + metadata (everyone)
 *     ├── EntityManagerRead  ← + get/list/query (read-oriented views)
 *     ├── EntityManagerCrud  ← + create/update/patch/delete (forms)
 *     └── EntityManagerList  ← + list specifics (list pages)
 *
 * All interfaces accept an optional generic parameter `T` (default: `unknown`)
 * that flows through to method signatures for typed entity data.
 */

// ─── Base ────────────────────────────────────────────────────────────────────

/**
 * Minimal identity / metadata — used by navigation, breadcrumbs, child pages.
 */
export interface EntityManagerBase<T = unknown> {
  readonly idField: string
  label?: string
  labelPlural?: string
  routePrefix?: string
  labelField?: string | ((entity: T) => string)
  readOnly?: boolean
  getEntityLabel: (data: T) => string
  getEntityBadges?: (data: T) => Array<{ label: string; severity?: string }>
}

// ─── Permissions ─────────────────────────────────────────────────────────────

/**
 * Permission checks — used by guards, list pages, forms.
 */
export interface EntityManagerPermissions<T = unknown> {
  canRead?: (entity?: T) => boolean
  canCreate: () => boolean
  canUpdate: (entity?: T) => boolean
  canDelete: (entity?: T) => boolean
}

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Read operations + delete — used by list pages and other read-oriented views.
 */
export interface EntityManagerRead<T = unknown> extends EntityManagerBase<T>, EntityManagerPermissions<T> {
  get: (id: string | number, context?: unknown) => Promise<T>
  list: (params?: unknown, context?: unknown) => Promise<{ items: T[]; total?: number; fromCache?: boolean; [key: string]: unknown }>
  query?: (params?: unknown, options?: { routingContext?: unknown }) => Promise<{ items: T[]; total?: number; fromCache?: boolean; [key: string]: unknown }>
  delete: (id: string | number, context?: unknown) => Promise<void>
  request: (method: string, path: string, options?: { data?: unknown }) => Promise<unknown>
  invalidateCache?: () => void
  localFilterThreshold?: number
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

/**
 * Full CRUD — used by form pages.
 */
export interface EntityManagerCrud<T = unknown> extends EntityManagerRead<T> {
  fields?: Record<string, unknown> | unknown[]
  getInitialData: () => Record<string, unknown>
  getFormFields: () => Array<{ name: string; [key: string]: unknown }>
  getFieldConfig: (name: string) => unknown | null
  resolveReferenceOptions: (fieldName: string) => Promise<unknown[]>
  create: (data: unknown, context?: unknown) => Promise<T>
  update: (id: string | number, data: unknown, context?: unknown) => Promise<T>
  patch: (id: string | number, data: unknown, context?: unknown) => Promise<T>
  hasSeverityMap?: (field: string) => boolean
  getSeverity?: (field: string, value: string | number, defaultSeverity?: string) => string
  getSeverityDescriptor?: (field: string, value: string | number, defaultSeverity?: string) => { severity: string; icon?: string; label?: string }
}
