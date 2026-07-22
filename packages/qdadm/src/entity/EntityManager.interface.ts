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
 *
 * ## Optionality contract (#1253)
 *
 * These views describe the IMPLEMENTER'S MINIMUM, not a mirror of the
 * EntityManager class. A member is REQUIRED iff qdadm's own composables
 * call it unguarded (or capability coherence demands it — e.g. the four
 * can* permission checks travel together). A member stays OPTIONAL only
 * when it is a genuine capability a minimal manager-like need not carry;
 * the reason is documented inline. `?` means "conditional", never "lazy".
 */

import type { EntityBadge } from './EntityManager.types'
import type { SignalBus } from '../kernel/SignalBus'
import type { EntityAuthAdapter } from './auth/EntityAuthAdapter'

// ─── Base ────────────────────────────────────────────────────────────────────

/**
 * Minimal identity / metadata — used by navigation, breadcrumbs, child pages.
 */
export interface EntityManagerBase<T = unknown> {
  readonly idField: string
  label?: string
  labelPlural?: string
  /** Optional one-liner explaining what the entity is (list page subtitle) */
  description?: string | null
  routePrefix?: string
  labelField?: string | ((entity: T) => string)
  readOnly?: boolean
  getEntityLabel: (data: T) => string
  // Optional BY DESIGN (#1253): part of the badge/severity presentation
  // capability; call sites guard (e.g. useEntityItemShowPage checks
  // `if (!manager.getEntityBadges)`).
  getEntityBadges?: (data: T) => EntityBadge[]
}

// ─── Permissions ─────────────────────────────────────────────────────────────

/**
 * Permission checks — used by guards, list pages, forms.
 */
export interface EntityManagerPermissions<T = unknown> {
  // The four checks are ONE capability — a manager-like answering canUpdate
  // but not canRead is not a smaller contract, it's an incoherent one. The
  // `?` on canRead was a #1191 leftover (#1253).
  canRead: (entity?: T) => boolean
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
  // query/invalidateCache/getFieldConfig are required since #1253: they are
  // unconditionally implemented on the class (prototype-applied) and called
  // unguarded by list pages — the `?` was a #1191 leftover that forced
  // consumer-side casts on base methods.
  query: (params?: unknown, options?: { routingContext?: unknown }) => Promise<{ items: T[]; total?: number; fromCache?: boolean; [key: string]: unknown }>
  delete: (id: string | number, context?: unknown) => Promise<void>
  request: (method: string, path: string, options?: { data?: unknown }) => Promise<unknown>
  invalidateCache: () => void
  /** Field config lookup — read-side too since list column binding (#1255) */
  getFieldConfig: (name: string) => unknown | null
  /** Config-carrying property: always present on the class, VALUE nullable */
  localFilterThreshold?: number | null
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

/**
 * Full CRUD — used by form pages.
 */
export interface EntityManagerCrud<T = unknown> extends EntityManagerRead<T> {
  fields?: Record<string, unknown> | unknown[]
  getInitialData: () => Record<string, unknown>
  getFormFields: () => Array<{ name: string; [key: string]: unknown }>
  // getFieldConfig inherited (required) from EntityManagerRead since #1253
  resolveReferenceOptions: (fieldName: string) => Promise<unknown[]>
  create: (data: unknown, context?: unknown) => Promise<T>
  update: (id: string | number, data: unknown, context?: unknown) => Promise<T>
  patch: (id: string | number, data: unknown, context?: unknown) => Promise<T>
  // Optional BY DESIGN (#1253): the severity/badge presentation capability —
  // a minimal manager-like need not carry it; every qdadm call site guards
  // (`?.` or truthiness). The canonical class always provides it.
  hasSeverityMap?: (field: string) => boolean
  getSeverity?: (field: string, value: string | number, defaultSeverity?: string) => string
  getSeverityDescriptor?: (field: string, value: string | number, defaultSeverity?: string) => { severity: string; icon?: string; label?: string }
}
// ============================================================================
// ASSIGNMENT-SAFE STRUCTURAL VIEWS (#1191)
// ============================================================================
//
// Composables and components used to redeclare tiny local `EntityManager` /
// `Orchestrator` interfaces (24 sites) because the canonical generics don't
// assign across erased type parameters. These shared, non-generic views are
// the single replacement: the canonical classes satisfy them structurally
// (compile-time asserted in orchestrator/Orchestrator.ts), and consumers
// declare exactly the surface they touch by intersecting when they need more.
//
// NOTE: members use METHOD syntax on purpose — TS keeps method parameters
// bivariant (even under strictFunctionTypes), which is what lets
// `EntityManager<T>` assign to the erased signatures below.

/** Toast surface exposed by the orchestrator (structural ToastHelper). */
export interface ToastLike {
  success(summary: string, detail?: string, emitter?: unknown): void
  error(summary: string, detail?: string, emitter?: unknown): void
  warn(summary: string, detail?: string, emitter?: unknown): void
  info(summary: string, detail?: string, emitter?: unknown): void
}

/**
 * Minimal structural view of an EntityManager for composables/components.
 * Every member exists on the canonical `EntityManager`; optionals reflect
 * genuinely optional configuration.
 */
export interface EntityManagerLike {
  idField: string
  label?: string
  labelPlural?: string
  description?: string | null
  // Function-typed PROPERTY → strictly contravariant param; `never` is the
  // contravariant top, so the canonical `(entity: T) => string` assigns.
  // Cast at the call site when invoking.
  labelField?: string | ((data: never) => string)
  routePrefix?: string
  readOnly?: boolean
  getEntityLabel(data: unknown): string | null
  getEntityBadges?(data: unknown): EntityBadge[]
  canRead(entity?: unknown): boolean
  canCreate(): boolean
  canUpdate(entity?: unknown): boolean
  canDelete(entity?: unknown): boolean
  list(params?: Record<string, unknown>, context?: unknown): Promise<{
    items: unknown[]
    total?: number
    fromCache?: boolean
  }>
  get(id: string | number, context?: unknown): Promise<unknown>
  create(data: Record<string, unknown>, context?: unknown): Promise<unknown>
  update(id: string | number, data: Record<string, unknown>, context?: unknown): Promise<unknown>
  delete(id: string | number, context?: unknown): Promise<unknown>
}

/**
 * Minimal structural view of the Orchestrator for composables/components.
 * `get()` is typed nullable so consumers guard — the canonical class throws
 * on unknown names, injected test doubles commonly return null.
 */
export interface OrchestratorLike<M = EntityManagerLike | null | undefined> {
  get(name: string): M
  has?(name: string): boolean
  isRegistered?(name: string): boolean
  toast: ToastLike
  signals?: SignalBus | null
  entityAuthAdapter?: EntityAuthAdapter | null
}
