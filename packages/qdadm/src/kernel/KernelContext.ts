/**
 * KernelContext - Fluent API wrapper for module registration
 *
 * Provides a chainable interface for modules to register entities, routes,
 * navigation items, zones, blocks, and signal handlers.
 *
 * Usage in a module:
 * ```ts
 * class UsersModule extends Module {
 *   async connect(ctx: KernelContext) {
 *     ctx
 *       .entity('users', { storage: 'api:/api/users' })
 *       .routes('users', [
 *         { path: '', name: 'users', component: UserList },
 *         { path: ':id', name: 'users-edit', component: UserEdit }
 *       ])
 *       .navItem({ section: 'Admin', route: 'users', icon: 'pi pi-users', label: 'Users' })
 *       .routeFamily('users', ['users-'])
 *       .zone('users-list-header')
 *       .block('users-list-header', { component: UserStats, weight: 10 })
 *       .on('users:created', (event) => console.log('User created:', event))
 *   }
 * }
 * ```
 */

import type { App, Component } from 'vue'
import type { Router, RouteRecordRaw } from 'vue-router'
import { managerFactory } from '../entity/factory.js'
import { registry, getRoutes } from '../module/moduleRegistry'
import { UsersManager, type UsersManagerOptions } from '../security/UsersManager'
import type { SignalBus } from './SignalBus'
import type { ListenerOptions } from '@quazardous/quarkernel'
import type { Module } from './Module'
import type { Orchestrator } from '../orchestrator/Orchestrator'
import type { HookRegistry } from '../hooks/HookRegistry'
import type { ZoneRegistry } from '../zones/ZoneRegistry'
import type { DeferredRegistry } from '../deferred/DeferredRegistry.js'
import type { SecurityChecker } from '../entity/auth/SecurityChecker'
import type { PermissionRegistry } from '../security/PermissionRegistry'
import type { EntityManager } from '../entity/EntityManager'
import type { EntityRecord } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended Module interface with internal cleanup method
 */
interface ModuleWithCleanup {
  constructor?: { name?: string }
  _addSignalCleanup?: (cleanup: () => void) => void
}

/**
 * Auth adapter interface
 */
interface AuthAdapter {
  getUser(): unknown
  [key: string]: unknown
}

/**
 * Kernel options interface
 */
interface KernelOptions {
  debug?: boolean
  authAdapter?: AuthAdapter | null
  storageResolver?: unknown
  managerResolver?: unknown
  managerRegistry?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Kernel interface for type safety
 */
interface KernelInterface {
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
  _pendingProvides: Map<string | symbol, unknown>
  _pendingComponents: Map<string, Component>
}

/**
 * Navigation item configuration
 */
export interface NavItem {
  section: string
  route: string
  label: string
  icon?: string
  exact?: boolean
  entity?: string
}

/**
 * Zone configuration
 */
export interface ZoneOptions {
  default?: Component
}

/**
 * Block configuration
 */
export interface BlockConfig {
  component: Component
  weight?: number
  props?: Record<string, unknown>
  id?: string
  operation?: 'add' | 'replace' | 'extend' | 'wrap'
}

/**
 * Route options
 */
export interface RouteOptions {
  entity?: string
  parent?: ParentConfig
  label?: string
  layout?: string
}

/**
 * Parent route configuration
 */
interface ParentConfig {
  entity: string
  param: string
  foreignKey: string
}

/**
 * CRUD page components
 */
export interface CrudPages {
  list?: () => Promise<{ default: Component }>
  show?: () => Promise<{ default: Component }>
  form?: () => Promise<{ default: Component }>
  create?: () => Promise<{ default: Component }>
  edit?: () => Promise<{ default: Component }>
}

/**
 * CRUD options
 */
export interface CrudOptions {
  nav?: {
    section: string
    icon?: string
    label?: string
  }
  routePrefix?: string
  parentRoute?: string
  foreignKey?: string
  label?: string
}

/**
 * User entity options
 */
export type UserEntityOptions = UsersManagerOptions

/**
 * Permission metadata
 */
export interface PermissionMeta {
  label: string
  description?: string
}

/**
 * Permission options
 */
export interface PermissionOptions {
  isEntity?: boolean
}

/**
 * Signal handler function type
 */
type SignalHandler = (event: { data: unknown; [key: string]: unknown }) => void

/**
 * Hook handler function type
 */
type HookHandler = (context: unknown) => unknown | Promise<unknown>

/**
 * Deferred factory function type
 */
type DeferredFactory = () => Promise<void>

export class KernelContext {
  private _kernel: KernelInterface
  private _module: ModuleWithCleanup | null

  constructor(kernel: KernelInterface, module: ModuleWithCleanup | null) {
    this._kernel = kernel
    this._module = module
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Getters for kernel services
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get Vue app instance
   */
  get app(): App | null {
    return this._kernel.vueApp
  }

  /**
   * Get Vue router instance
   */
  get router(): Router | null {
    return this._kernel.router
  }

  /**
   * Get SignalBus instance
   */
  get signals(): SignalBus | null {
    return this._kernel.signals
  }

  /**
   * Get Orchestrator instance (entity managers)
   */
  get orchestrator(): Orchestrator | null {
    return this._kernel.orchestrator
  }

  /**
   * Get ZoneRegistry instance
   */
  get zones(): ZoneRegistry | null {
    return this._kernel.zoneRegistry
  }

  /**
   * Get HookRegistry instance
   */
  get hooks(): HookRegistry | null {
    return this._kernel.hookRegistry
  }

  /**
   * Get DeferredRegistry instance
   */
  get deferred(): DeferredRegistry | null {
    return this._kernel.deferred
  }

  /**
   * Check if running in development mode
   */
  get isDev(): boolean {
    return (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV ?? false
  }

  /**
   * Get debug mode from kernel options
   */
  get debug(): boolean {
    return this._kernel.options?.debug ?? false
  }

  /**
   * Get auth adapter
   */
  get authAdapter(): AuthAdapter | null {
    return this._kernel.options?.authAdapter ?? null
  }

  /**
   * Get security checker (role hierarchy, permissions)
   */
  get security(): SecurityChecker | null {
    return this._kernel.securityChecker
  }

  /**
   * Get permission registry
   */
  get permissionRegistry(): PermissionRegistry | null {
    return this._kernel.permissionRegistry
  }

  /**
   * Get auth adapter shortcut
   */
  get auth(): AuthAdapter | null {
    return this._kernel.options?.authAdapter ?? null
  }

  /**
   * Get ActiveStack instance (sync navigation context)
   */
  get activeStack(): unknown {
    return this._kernel.activeStack ?? null
  }

  /**
   * Get StackHydrator instance (async data loading)
   */
  get stackHydrator(): unknown {
    return this._kernel.stackHydrator ?? null
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Fluent registration methods (return this for chaining)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Register an entity manager
   *
   * Uses managerFactory to resolve config into a manager instance.
   * Registers with Orchestrator for CRUD operations.
   *
   * @param name - Entity name (e.g., 'users', 'books')
   * @param config - Manager config
   *   - String pattern: 'api:/api/users' → creates ApiStorage + EntityManager
   *   - Object: { storage: '...', label: '...', fields: {...} }
   *   - Manager instance: passed through directly
   *
   * @example
   * ctx.entity('users', 'api:/api/users')
   * ctx.entity('books', { storage: 'api:/api/books', label: 'Book' })
   * ctx.entity('settings', new SettingsManager({...}))
   */
  entity(name: string, config: string | Record<string, unknown> | EntityManager): this {
    // Build factory context from kernel options
    const factoryContext = {
      storageResolver: this._kernel.options.storageResolver,
      managerResolver: this._kernel.options.managerResolver,
      managerRegistry: this._kernel.options.managerRegistry || {},
    }

    // Create manager via factory
    const manager = managerFactory(config, name, factoryContext)

    // Register with orchestrator
    if (this._kernel.orchestrator) {
      this._kernel.orchestrator.register(name, manager)
    }

    // Auto-register CRUD permissions for this entity
    if (this._kernel.permissionRegistry) {
      this._kernel.permissionRegistry.registerEntity(name, {
        module: (this._module?.constructor as { name?: string })?.name || 'unknown',
        // Register entity-own:* permissions if manager has isOwn configured
        hasOwnership: !!(manager as unknown as { _isOwn?: unknown })._isOwn,
      })
    }

    return this
  }

  /**
   * Register a users entity with standard fields and role linking
   *
   * Creates a UsersManager with:
   * - username, password, role fields (role linked to roles entity)
   * - System entity flag
   * - Admin-only access by default
   *
   * @param options - Configuration options
   *
   * @example
   * // Basic usage with MockApiStorage
   * ctx.userEntity({
   *   storage: new MockApiStorage({ entityName: 'users', initialData: usersFixture })
   * })
   */
  userEntity(options: UserEntityOptions): this {
    const manager = new UsersManager(options)

    // Register with orchestrator
    if (this._kernel.orchestrator) {
      this._kernel.orchestrator.register('users', manager)
    }

    // Auto-register CRUD permissions for users entity
    if (this._kernel.permissionRegistry) {
      this._kernel.permissionRegistry.registerEntity('users', {
        module: (this._module?.constructor as { name?: string })?.name || 'unknown',
      })
    }

    return this
  }

  /**
   * Register routes for this module
   *
   * Delegates to moduleRegistry.addRoutes with prefix application.
   *
   * @param basePath - Base path prefix (e.g., 'users')
   * @param routes - Route definitions with relative paths
   * @param opts - Route options
   *
   * @example
   * ctx.routes('users', [
   *   { path: '', name: 'users', component: UserList },
   *   { path: ':id', name: 'users-edit', component: UserEdit }
   * ], { entity: 'users' })
   */
  routes(basePath: string, routes: RouteRecordRaw[], opts: RouteOptions = {}): this {
    registry.addRoutes(basePath, routes, opts)
    return this
  }

  /**
   * Add a navigation item to a section
   *
   * @param item - Navigation item config
   *
   * @example
   * ctx.navItem({ section: 'Admin', route: 'users', icon: 'pi pi-users', label: 'Users' })
   */
  navItem(item: NavItem): this {
    registry.addNavItem(item)
    return this
  }

  /**
   * Add route family mapping for active state detection
   *
   * @param base - Parent route name (e.g., 'users')
   * @param prefixes - Child route prefixes (e.g., ['users-', 'user-'])
   *
   * @example
   * ctx.routeFamily('users', ['users-', 'user-'])
   */
  routeFamily(base: string, prefixes: string[]): this {
    registry.addRouteFamily(base, prefixes)
    return this
  }

  /**
   * Register standard CRUD routes with naming conventions
   *
   * Generates routes following qdadm conventions:
   * - Entity 'books' → route prefix 'book'
   * - List: /books → name 'book'
   * - Show: /books/:id → name 'book-show' (optional)
   * - Create: /books/create → name 'book-create'
   * - Edit: /books/:id/edit → name 'book-edit'
   *
   * Also registers route family and optional nav item.
   *
   * @param entity - Entity name (plural, e.g., 'books', 'users')
   * @param pages - Page components (lazy imports)
   * @param options - Additional options
   *
   * @example
   * // Single form pattern (recommended)
   * ctx.crud('books', {
   *   list: () => import('./pages/BookList.vue'),
   *   form: () => import('./pages/BookForm.vue')
   * }, {
   *   nav: { section: 'Library', icon: 'pi pi-book' }
   * })
   */
  crud(entity: string, pages: CrudPages, options: CrudOptions = {}): this {
    // Entity name is always used for permission binding
    // Manager may not be registered yet (child entity before parent module loads)
    const entityBinding = entity
    const manager = this._kernel.orchestrator?.isRegistered(entity)
      ? this._kernel.orchestrator.get(entity)
      : null
    const idParam = manager?.idField || 'id'

    // Handle parent route configuration
    let basePath = entity
    let parentConfig: ParentConfig | null = null
    let parentRoutePrefix: string | null = null

    if (options.parentRoute) {
      // Find parent route info from registered routes
      const parentRouteName = options.parentRoute
      const allRoutes = getRoutes()
      const parentRoute = allRoutes.find((r) => r.name === parentRouteName)

      if (parentRoute) {
        // Get parent entity from route meta
        const parentEntityName = parentRoute.meta?.entity
        const parentManager = parentEntityName
          ? this._kernel.orchestrator?.get(parentEntityName)
          : null
        const parentIdParam = parentManager?.idField || 'id'

        // Build base path: parentPath/:parentId/entity
        // e.g., books/:bookId/loans
        const parentBasePath =
          parentRoute.path.replace(/\/(create|:.*)?$/, '') || parentEntityName
        basePath = `${parentBasePath}/:${parentIdParam}/${entity}`

        // Build parent config for route meta (only if parent entity is defined)
        if (parentEntityName) {
          parentConfig = {
            entity: parentEntityName,
            param: parentIdParam,
            foreignKey:
              options.foreignKey || `${this._singularize(parentEntityName)}_id`,
          }
        }

        // Store parent route prefix for derived naming
        parentRoutePrefix = parentRouteName
      }
    }

    // Derive route prefix
    // - With parent: 'book' + '-loan' → 'book-loan'
    // - Without parent: 'books' → 'book'
    const routePrefix =
      options.routePrefix ||
      (parentRoutePrefix
        ? `${parentRoutePrefix}-${this._singularize(entity)}`
        : this._singularize(entity))

    // Build routes array
    const routes: RouteRecordRaw[] = []

    // List route
    if (pages.list) {
      routes.push({
        path: '',
        name: routePrefix,
        component: pages.list,
        meta: { layout: 'list' },
      })
    }

    // Show route (read-only detail view)
    if (pages.show) {
      routes.push({
        path: `:${idParam}`,
        name: `${routePrefix}-show`,
        component: pages.show,
        meta: { layout: 'show' },
      })
    }

    // Form routes - single form or separate create/edit
    if (pages.form) {
      // Single form pattern (recommended)
      routes.push({
        path: 'create',
        name: `${routePrefix}-create`,
        component: pages.form,
      })
      routes.push({
        path: `:${idParam}/edit`,
        name: `${routePrefix}-edit`,
        component: pages.form,
      })
    } else {
      // Separate create/edit pages
      if (pages.create) {
        routes.push({
          path: 'create',
          name: `${routePrefix}-create`,
          component: pages.create,
        })
      }
      if (pages.edit) {
        routes.push({
          path: `:${idParam}/edit`,
          name: `${routePrefix}-edit`,
          component: pages.edit,
        })
      }
    }

    // Build route options
    const routeOpts: RouteOptions = {}
    // Set entity if:
    // 1. Entity is registered (manager exists), OR
    // 2. This is a child route (parentConfig) - needs entity binding for permission checks
    if (manager || parentConfig) {
      routeOpts.entity = entityBinding
    }
    if (parentConfig) {
      routeOpts.parent = parentConfig
    }
    if (options.label) {
      routeOpts.label = options.label
    }

    // Register routes
    this.routes(basePath, routes, routeOpts)

    // Register route family for active state detection
    this.routeFamily(routePrefix, [`${routePrefix}-`])

    // Register nav item if provided (typically not for child entities)
    if (options.nav) {
      const label = options.nav.label || this._capitalize(entity)
      const navItem: NavItem = {
        section: options.nav.section,
        route: routePrefix,
        icon: options.nav.icon,
        label,
      }
      // Only set entity on nav item if registered (to avoid permission check failure)
      // Routes always get entity binding, but nav items need it to be resolvable
      if (manager) {
        navItem.entity = entityBinding
      }
      this.navItem(navItem)
    }

    return this
  }

  /**
   * Singularize a plural word (simple English rules)
   */
  private _singularize(plural: string): string {
    if (plural.endsWith('ies')) return plural.slice(0, -3) + 'y'
    if (
      plural.endsWith('ses') ||
      plural.endsWith('xes') ||
      plural.endsWith('zes')
    ) {
      return plural.slice(0, -2)
    }
    if (plural.endsWith('s') && !plural.endsWith('ss')) return plural.slice(0, -1)
    return plural
  }

  /**
   * Capitalize first letter
   */
  private _capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  /**
   * Define a zone for extensible UI composition
   *
   * @param name - Zone name (e.g., 'users-list-header')
   * @param options - Zone options
   *
   * @example
   * ctx.zone('users-list-header')
   * ctx.zone('users-sidebar', { default: DefaultSidebar })
   */
  zone(name: string, options: ZoneOptions = {}): this {
    if (this._kernel.zoneRegistry) {
      this._kernel.zoneRegistry.defineZone(name, options)
    }
    return this
  }

  /**
   * Register a block in a zone
   *
   * @param zoneName - Target zone name
   * @param config - Block configuration
   *
   * @example
   * ctx.block('users-list-header', { component: UserStats, weight: 10, id: 'user-stats' })
   */
  block(zoneName: string, config: BlockConfig): this {
    if (this._kernel.zoneRegistry) {
      this._kernel.zoneRegistry.registerBlock(zoneName, config)
    }
    return this
  }

  /**
   * Provide a value to Vue's dependency injection system
   *
   * @param key - Injection key
   * @param value - Value to provide
   *
   * @example
   * ctx.provide('myService', new MyService())
   */
  provide(key: string | symbol, value: unknown): this {
    if (this._kernel.vueApp) {
      this._kernel.vueApp.provide(key, value)
    } else {
      // Store for later application when vueApp is created
      this._kernel._pendingProvides.set(key, value)
    }
    return this
  }

  /**
   * Register a global Vue component
   *
   * @param name - Component name
   * @param component - Vue component
   *
   * @example
   * ctx.component('MyGlobalComponent', MyComponent)
   */
  component(name: string, component: Component): this {
    if (this._kernel.vueApp) {
      this._kernel.vueApp.component(name, component)
    } else {
      // Store for later registration when vueApp is created
      this._kernel._pendingComponents.set(name, component)
    }
    return this
  }

  /**
   * Subscribe to a signal with automatic cleanup on module disconnect
   *
   * The handler will be automatically unsubscribed when the module's
   * disconnect() method is called.
   *
   * @param signal - Signal name (supports wildcards via SignalBus)
   * @param handler - Handler function (event, ctx) => void
   * @param options - Listener options
   *
   * @example
   * ctx.on('users:created', (event) => console.log('User created:', event.data))
   * ctx.on('entity:*', (event) => console.log('Entity event:', event))
   */
  on(signal: string, handler: SignalHandler, options: ListenerOptions = {}): this {
    if (this._kernel.signals) {
      const cleanup = this._kernel.signals.on(signal, handler, options)
      // Register cleanup with module for automatic unsubscribe on disconnect
      if (this._module && typeof this._module._addSignalCleanup === 'function') {
        this._module._addSignalCleanup(cleanup)
      }
    }
    return this
  }

  /**
   * Register a hook handler
   *
   * @param hookName - Hook name (e.g., 'users:presave')
   * @param handler - Handler function
   * @param options - Hook options
   *
   * @example
   * ctx.hook('users:presave', (context) => {
   *   context.data.updated_at = new Date().toISOString()
   *   return context
   * })
   */
  hook(hookName: string, handler: HookHandler, options: Record<string, unknown> = {}): this {
    if (this._kernel.hookRegistry) {
      this._kernel.hookRegistry.register(hookName, handler, options)
    }
    return this
  }

  /**
   * Queue a deferred task
   *
   * @param name - Deferred task name
   * @param factory - Factory function returning a promise
   *
   * @example
   * ctx.deferred('users:warmup', async () => {
   *   await ctx.orchestrator.get('users').warmup()
   * })
   */
  defer(name: string, factory: DeferredFactory): this {
    if (this._kernel.deferred) {
      this._kernel.deferred.queue(name, factory)
    }
    return this
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Permission registration
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Register permissions for this module
   *
   * Permissions are namespaced and collected in the central PermissionRegistry.
   * Use this to declare what permissions your module provides.
   *
   * Permission format: namespace:action
   * - For entity CRUD: automatically prefixed with 'entity:'
   * - For system features: use any namespace (auth:, admin:, feature:, etc.)
   *
   * @param namespace - Permission namespace (e.g., 'books', 'auth', 'admin:config')
   * @param permissions - Permission definitions
   * @param options - Permission options
   *
   * @example
   * // Entity custom permissions (auto-prefixed with 'entity:')
   * ctx.permissions('books', {
   *   checkout: 'Checkout a book',
   *   reserve: { label: 'Reserve', description: 'Reserve a book for later' }
   * }, { isEntity: true })
   * // → entity:books:checkout, entity:books:reserve
   */
  permissions(
    namespace: string,
    permissions: Record<string, string | PermissionMeta>,
    options: PermissionOptions = {}
  ): this {
    if (this._kernel.permissionRegistry) {
      this._kernel.permissionRegistry.register(namespace, permissions, {
        ...options,
        module: (this._module?.constructor as { name?: string })?.name || 'unknown',
      })
    }
    return this
  }

  /**
   * Register entity permissions (convenience method)
   *
   * Shorthand for registering entity-namespaced permissions.
   * Equivalent to: ctx.permissions(entity, perms, { isEntity: true })
   *
   * @param entity - Entity name
   * @param permissions - Permission definitions
   *
   * @example
   * ctx.entityPermissions('books', {
   *   checkout: 'Checkout a book'
   * })
   * // → entity:books:checkout
   */
  entityPermissions(
    entity: string,
    permissions: Record<string, string | PermissionMeta>
  ): this {
    return this.permissions(entity, permissions, { isEntity: true })
  }
}

/**
 * Factory function to create a KernelContext instance
 */
export function createKernelContext(
  kernel: KernelInterface,
  module: ModuleWithCleanup | null
): KernelContext {
  return new KernelContext(kernel, module)
}
