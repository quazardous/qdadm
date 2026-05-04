/**
 * KernelContext types - shared between the class shell and the prototype-patch
 * modules (KernelContext.{entities,routing,zones,events,permissions,i18n}.ts).
 *
 * Internal types (ModuleWithCleanup, AuthAdapter, KernelOptions,
 * KernelInterface, function types) stay un-exported by KernelContext.ts so
 * they remain private to qdadm internals; the public types (NavItem,
 * ZoneOptions, …) are re-exported from KernelContext.ts to preserve the
 * existing barrel API.
 */

import type { App, Component } from 'vue'
import type { Router } from 'vue-router'
import type { UsersManagerOptions } from '../security/UsersManager'
import type { SignalBus } from './SignalBus'
import type { Orchestrator } from '../orchestrator/Orchestrator'
import type { HookRegistry } from '../hooks/HookRegistry'
import type { ZoneRegistry } from '../zones/ZoneRegistry'
import type { DeferredRegistry } from '../deferred/DeferredRegistry.js'
import type { SecurityChecker } from '../entity/auth/SecurityChecker'
import type { PermissionRegistry } from '../security/PermissionRegistry'
import type { I18n } from '../i18n/I18n'

// ─────────────────────────────────────────────────────────────────────────────
// Internal types — shared across patch modules, not exposed by index.ts
// ─────────────────────────────────────────────────────────────────────────────

/** Extended Module interface with internal cleanup method */
export interface ModuleWithCleanup {
  constructor?: { name?: string }
  _addSignalCleanup?: (cleanup: () => void) => void
}

/** Auth adapter interface */
export interface AuthAdapter {
  getUser(): unknown
  [key: string]: unknown
}

/** Kernel options interface */
export interface KernelOptions {
  debug?: boolean
  authAdapter?: AuthAdapter | null
  storageResolver?: unknown
  managerResolver?: unknown
  managerRegistry?: Record<string, unknown>
  [key: string]: unknown
}

/** Kernel interface for type safety inside KernelContext */
export interface KernelInterface {
  vueApp: App | null
  router: Router | null
  signals: SignalBus | null
  orchestrator: Orchestrator | null
  zoneRegistry: ZoneRegistry | null
  hookRegistry: HookRegistry | null
  deferred: DeferredRegistry | null
  securityChecker: SecurityChecker | null
  permissionRegistry: PermissionRegistry | null
  activeStack: unknown
  stackHydrator: unknown
  options: KernelOptions
  i18nInstance: I18n | null
  _pendingProvides: Map<string | symbol, unknown>
  _pendingComponents: Map<string, Component>
}

/** Signal handler function type */
export type SignalHandler = (event: { data: unknown; [key: string]: unknown }) => void

/** Hook handler function type */
export type HookHandler = (context: unknown) => unknown | Promise<unknown>

/** Deferred factory function type */
export type DeferredFactory = () => Promise<void>

// ─────────────────────────────────────────────────────────────────────────────
// Public types — re-exported by KernelContext.ts (and ultimately by index.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** Navigation item configuration */
export interface NavItem {
  section: string
  route: string
  label: string
  icon?: string
  exact?: boolean
  entity?: string
}

/** Zone configuration */
export interface ZoneOptions {
  default?: Component
}

/** Block configuration */
export interface BlockConfig {
  component: Component
  weight?: number
  props?: Record<string, unknown>
  id?: string
  operation?: 'add' | 'replace' | 'extend' | 'wrap'
  /** Block ID to replace (required if operation='replace') */
  replaces?: string
  /** Block ID to insert before (for operation='extend') */
  before?: string
  /** Block ID to insert after (for operation='extend') */
  after?: string
  /** Block ID to wrap (required if operation='wrap') */
  wraps?: string
}

/** Route options */
export interface RouteOptions {
  entity?: string
  parent?: ParentConfig
  label?: string
  layout?: string
}

/** Parent route configuration */
export interface ParentConfig {
  entity: string
  param: string
  foreignKey?: string
}

/** CRUD page components */
export interface CrudPages {
  list?: () => Promise<{ default: Component }>
  show?: () => Promise<{ default: Component }>
  form?: () => Promise<{ default: Component }>
  create?: () => Promise<{ default: Component }>
  edit?: () => Promise<{ default: Component }>
}

/** CRUD options */
export interface CrudOptions {
  nav?: {
    section: string
    icon?: string
    label?: string
  }
  routePrefix?: string
  /** Override the URL path segment (defaults to entity name). Useful for camelCase entities like 'jobTasks' → 'tasks'. */
  pathSegment?: string
  parentRoute?: string
  foreignKey?: string
  label?: string
}

/** Child page options for non-entity child routes */
export interface ChildPageOptions {
  component: () => Promise<{ default: Component }>
  label?: string
  icon?: string
  meta?: Record<string, unknown>
}

/** User entity options */
export type UserEntityOptions = UsersManagerOptions

/** Permission metadata */
export interface PermissionMeta {
  label: string
  description?: string
}

/** Permission options */
export interface PermissionOptions {
  isEntity?: boolean
}
