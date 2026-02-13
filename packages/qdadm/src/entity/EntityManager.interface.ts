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
 */

// ─── Base ────────────────────────────────────────────────────────────────────

/**
 * Minimal identity / metadata — used by navigation, breadcrumbs, child pages.
 */
export interface EntityManagerBase {
  readonly idField: string
  label?: string
  labelPlural?: string
  routePrefix?: string
  labelField?: string | ((entity: unknown) => string)
  readOnly?: boolean
  getEntityLabel: (data: unknown) => string
  getEntityBadges?: (data: unknown) => Array<{ label: string; severity?: string }>
}

// ─── Permissions ─────────────────────────────────────────────────────────────

/**
 * Permission checks — used by guards, list pages, forms.
 */
export interface EntityManagerPermissions {
  canRead?: (entity?: unknown) => boolean
  canCreate: () => boolean
  canUpdate: (entity?: unknown) => boolean
  canDelete: (entity?: unknown) => boolean
}

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Read operations + delete — used by list pages and other read-oriented views.
 */
export interface EntityManagerRead extends EntityManagerBase, EntityManagerPermissions {
  get: (id: string | number, context?: unknown) => Promise<unknown>
  list: (params?: unknown, context?: unknown) => Promise<{ items: unknown[]; total?: number; fromCache?: boolean; [key: string]: unknown }>
  query?: (params?: unknown, options?: { routingContext?: unknown }) => Promise<{ items: unknown[]; total?: number; fromCache?: boolean; [key: string]: unknown }>
  delete: (id: string | number, context?: unknown) => Promise<void>
  request: (method: string, path: string, options?: { data?: unknown }) => Promise<unknown>
  invalidateCache?: () => void
  localFilterThreshold?: number
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

/**
 * Full CRUD — used by form pages.
 */
export interface EntityManagerCrud extends EntityManagerRead {
  fields?: Record<string, unknown> | unknown[]
  getInitialData: () => Record<string, unknown>
  getFormFields: () => Array<{ name: string; [key: string]: unknown }>
  getFieldConfig: (name: string) => unknown | null
  resolveReferenceOptions: (fieldName: string) => Promise<unknown[]>
  create: (data: unknown, context?: unknown) => Promise<unknown>
  update: (id: string | number, data: unknown, context?: unknown) => Promise<unknown>
  patch: (id: string | number, data: unknown, context?: unknown) => Promise<unknown>
  hasSeverityMap?: (field: string) => boolean
  getSeverity?: (field: string, value: string | number, defaultSeverity?: string) => string
  getSeverityDescriptor?: (field: string, value: string | number, defaultSeverity?: string) => { severity: string; icon?: string; label?: string }
}
