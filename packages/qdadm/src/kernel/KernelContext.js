/**
 * KernelContext - Fluent API wrapper for module registration
 *
 * Provides a chainable interface for modules to register entities, routes,
 * navigation items, zones, blocks, and signal handlers.
 *
 * Usage in a module:
 * ```js
 * class UsersModule extends Module {
 *   async connect(ctx) {
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

import { managerFactory } from '../entity/factory.js'
import { registry, getRoutes } from '../module/moduleRegistry.js'
import { UsersManager } from '../security/UsersManager.js'

export class KernelContext {
  /**
   * @param {import('./Kernel.js').Kernel} kernel - Kernel instance
   * @param {import('./Module.js').Module} module - Module instance
   */
  constructor(kernel, module) {
    this._kernel = kernel
    this._module = module
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Getters for kernel services
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get Vue app instance
   * @returns {import('vue').App}
   */
  get app() {
    return this._kernel.vueApp
  }

  /**
   * Get Vue router instance
   * @returns {import('vue-router').Router}
   */
  get router() {
    return this._kernel.router
  }

  /**
   * Get SignalBus instance
   * @returns {import('./SignalBus.js').SignalBus}
   */
  get signals() {
    return this._kernel.signals
  }

  /**
   * Get Orchestrator instance (entity managers)
   * @returns {import('../orchestrator/Orchestrator.js').Orchestrator}
   */
  get orchestrator() {
    return this._kernel.orchestrator
  }

  /**
   * Get ZoneRegistry instance
   * @returns {import('../zones/ZoneRegistry.js').ZoneRegistry}
   */
  get zones() {
    return this._kernel.zoneRegistry
  }

  /**
   * Get HookRegistry instance
   * @returns {import('../hooks/HookRegistry.js').HookRegistry}
   */
  get hooks() {
    return this._kernel.hookRegistry
  }

  /**
   * Get DeferredRegistry instance
   * @returns {import('../deferred/DeferredRegistry.js').DeferredRegistry}
   */
  get deferred() {
    return this._kernel.deferred
  }

  /**
   * Check if running in development mode
   * @returns {boolean}
   */
  get isDev() {
    return import.meta.env?.DEV ?? false
  }

  /**
   * Get debug mode from kernel options
   * @returns {boolean}
   */
  get debug() {
    return this._kernel.options?.debug ?? false
  }

  /**
   * Get auth adapter
   * @returns {object|null}
   */
  get authAdapter() {
    return this._kernel.options?.authAdapter ?? null
  }

  /**
   * Get security checker (role hierarchy, permissions)
   * @returns {import('../entity/auth/SecurityChecker.js').SecurityChecker|null}
   */
  get security() {
    return this._kernel.securityChecker
  }

  /**
   * Get permission registry
   * @returns {import('../security/PermissionRegistry.js').PermissionRegistry|null}
   */
  get permissionRegistry() {
    return this._kernel.permissionRegistry
  }

  /**
   * Get auth adapter shortcut
   * @returns {object|null}
   */
  get auth() {
    return this._kernel.options?.authAdapter ?? null
  }

  /**
   * Get ActiveStack instance (sync navigation context)
   * @returns {import('../chain/ActiveStack.js').ActiveStack|null}
   */
  get activeStack() {
    return this._kernel.activeStack ?? null
  }

  /**
   * Get StackHydrator instance (async data loading)
   * @returns {import('../chain/StackHydrator.js').StackHydrator|null}
   */
  get stackHydrator() {
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
   * @param {string} name - Entity name (e.g., 'users', 'books')
   * @param {string|object|import('../entity/EntityManager.js').EntityManager} config - Manager config
   *   - String pattern: 'api:/api/users' → creates ApiStorage + EntityManager
   *   - Object: { storage: '...', label: '...', fields: {...} }
   *   - Manager instance: passed through directly
   * @returns {this}
   *
   * @example
   * ctx.entity('users', 'api:/api/users')
   * ctx.entity('books', { storage: 'api:/api/books', label: 'Book' })
   * ctx.entity('settings', new SettingsManager({...}))
   */
  entity(name, config) {
    // Build factory context from kernel options
    const factoryContext = {
      storageResolver: this._kernel.options.storageResolver,
      managerResolver: this._kernel.options.managerResolver,
      managerRegistry: this._kernel.options.managerRegistry || {}
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
        module: this._module?.constructor?.name || 'unknown',
        // Register entity-own:* permissions if manager has isOwn configured
        hasOwnership: !!manager._isOwn
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
   * @param {Object} options - Configuration options
   * @param {Object} options.storage - Storage adapter (required)
   * @param {Object} [options.extraFields={}] - Additional fields beyond username/password/role
   * @param {string} [options.adminRole='ROLE_ADMIN'] - Role required for user management
   * @param {boolean} [options.adminOnly=true] - Restrict access to admin role only
   * @param {Object} [options.fieldOverrides={}] - Override default field configs
   * @returns {this}
   *
   * @example
   * // Basic usage with MockApiStorage
   * ctx.userEntity({
   *   storage: new MockApiStorage({ entityName: 'users', initialData: usersFixture })
   * })
   *
   * @example
   * // With extra fields and API storage
   * ctx.userEntity({
   *   storage: new ApiStorage({ endpoint: '/api/users' }),
   *   extraFields: {
   *     email: { type: 'email', label: 'Email', required: true },
   *     firstName: { type: 'text', label: 'First Name' },
   *     lastName: { type: 'text', label: 'Last Name' }
   *   }
   * })
   *
   * @example
   * // Allow non-admin access (e.g., for user profile editing)
   * ctx.userEntity({
   *   storage: usersStorage,
   *   adminOnly: false
   * })
   */
  userEntity(options = {}) {
    const manager = new UsersManager(options)

    // Register with orchestrator
    if (this._kernel.orchestrator) {
      this._kernel.orchestrator.register('users', manager)
    }

    // Auto-register CRUD permissions for users entity
    if (this._kernel.permissionRegistry) {
      this._kernel.permissionRegistry.registerEntity('users', {
        module: this._module?.constructor?.name || 'unknown'
      })
    }

    return this
  }

  /**
   * Register routes for this module
   *
   * Delegates to moduleRegistry.addRoutes with prefix application.
   *
   * @param {string} basePath - Base path prefix (e.g., 'users')
   * @param {Array} routes - Route definitions with relative paths
   * @param {object} [opts={}] - Route options
   * @param {string} [opts.entity] - Entity name for permission checking
   * @param {object} [opts.parent] - Parent entity config for child routes
   * @param {string} [opts.label] - Label for nav links
   * @param {string} [opts.layout] - Default layout type
   * @returns {this}
   *
   * @example
   * ctx.routes('users', [
   *   { path: '', name: 'users', component: UserList },
   *   { path: ':id', name: 'users-edit', component: UserEdit }
   * ], { entity: 'users' })
   */
  routes(basePath, routes, opts = {}) {
    registry.addRoutes(basePath, routes, opts)
    return this
  }

  /**
   * Add a navigation item to a section
   *
   * @param {object} item - Navigation item config
   * @param {string} item.section - Section title (e.g., 'Admin', 'Content')
   * @param {string} item.route - Route name
   * @param {string} [item.icon] - Icon class (e.g., 'pi pi-users')
   * @param {string} [item.label] - Display label
   * @param {boolean} [item.exact] - Use exact route matching
   * @param {string} [item.entity] - Entity for permission check
   * @returns {this}
   *
   * @example
   * ctx.navItem({ section: 'Admin', route: 'users', icon: 'pi pi-users', label: 'Users' })
   */
  navItem(item) {
    registry.addNavItem(item)
    return this
  }

  /**
   * Add route family mapping for active state detection
   *
   * @param {string} base - Parent route name (e.g., 'users')
   * @param {string[]} prefixes - Child route prefixes (e.g., ['users-', 'user-'])
   * @returns {this}
   *
   * @example
   * ctx.routeFamily('users', ['users-', 'user-'])
   */
  routeFamily(base, prefixes) {
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
   * @param {string} entity - Entity name (plural, e.g., 'books', 'users')
   * @param {object} pages - Page components (lazy imports)
   * @param {Function} pages.list - List page: () => import('./pages/List.vue')
   * @param {Function} [pages.show] - Show page (read-only detail view)
   * @param {Function} [pages.form] - Single form for create+edit (recommended)
   * @param {Function} [pages.create] - Separate create page (alternative to form)
   * @param {Function} [pages.edit] - Separate edit page (alternative to form)
   * @param {object} [options={}] - Additional options
   * @param {object} [options.nav] - Navigation config
   * @param {string} options.nav.section - Nav section (e.g., 'Library')
   * @param {string} [options.nav.icon] - Icon class (e.g., 'pi pi-book')
   * @param {string} [options.nav.label] - Display label (default: capitalized entity)
   * @param {string} [options.routePrefix] - Override route prefix (default: singularized entity, or parentPrefix-singularized for children)
   * @param {string} [options.parentRoute] - Parent route name for child entities (e.g., 'book' to mount under books/:bookId)
   * @param {string} [options.foreignKey] - Foreign key field linking to parent (e.g., 'book_id')
   * @param {string} [options.label] - Label for navlinks (defaults to entity labelPlural from manager)
   * @returns {this}
   *
   * @example
   * // Minimal - list only (read-only entity)
   * ctx.crud('countries', { list: () => import('./pages/CountriesList.vue') })
   *
   * @example
   * // List + show (read-only with detail view)
   * ctx.crud('countries', {
   *   list: () => import('./pages/CountriesList.vue'),
   *   show: () => import('./pages/CountryShow.vue')
   * })
   *
   * @example
   * // Single form pattern (recommended)
   * ctx.crud('books', {
   *   list: () => import('./pages/BookList.vue'),
   *   form: () => import('./pages/BookForm.vue')
   * }, {
   *   nav: { section: 'Library', icon: 'pi pi-book' }
   * })
   *
   * @example
   * // Child entity mounted under parent route
   * ctx.crud('loans', {
   *   list: () => import('./pages/BookLoans.vue'),
   *   form: () => import('./pages/BookLoanForm.vue')
   * }, {
   *   parentRoute: 'book',
   *   foreignKey: 'book_id',
   *   routePrefix: 'book-loan'  // Optional: defaults to 'book-loan'
   * })
   *
   * @example
   * // Separate create/edit pages
   * ctx.crud('users', {
   *   list: () => import('./pages/UserList.vue'),
   *   create: () => import('./pages/UserCreate.vue'),
   *   edit: () => import('./pages/UserEdit.vue')
   * }, {
   *   nav: { section: 'Admin', icon: 'pi pi-users', label: 'Users' }
   * })
   */
  crud(entity, pages, options = {}) {
    // Entity name is always used for permission binding
    // Manager may not be registered yet (child entity before parent module loads)
    const entityBinding = entity
    const manager = this._kernel.orchestrator?.isRegistered(entity)
      ? this._kernel.orchestrator.get(entity)
      : null
    const idParam = manager?.idField || 'id'

    // Handle parent route configuration
    let basePath = entity
    let parentConfig = null
    let parentRoutePrefix = null

    if (options.parentRoute) {
      // Find parent route info from registered routes
      const parentRouteName = options.parentRoute
      const allRoutes = getRoutes()
      const parentRoute = allRoutes.find(r => r.name === parentRouteName)

      if (parentRoute) {
        // Get parent entity from route meta
        const parentEntityName = parentRoute.meta?.entity
        const parentManager = parentEntityName
          ? this._kernel.orchestrator?.get(parentEntityName)
          : null
        const parentIdParam = parentManager?.idField || 'id'

        // Build base path: parentPath/:parentId/entity
        // e.g., books/:bookId/loans
        const parentBasePath = parentRoute.path.replace(/\/(create|:.*)?$/, '') || parentEntityName
        basePath = `${parentBasePath}/:${parentIdParam}/${entity}`

        // Build parent config for route meta
        parentConfig = {
          entity: parentEntityName,
          param: parentIdParam,
          foreignKey: options.foreignKey || `${this._singularize(parentEntityName)}_id`
        }

        // Store parent route prefix for derived naming
        parentRoutePrefix = parentRouteName
      }
    }

    // Derive route prefix
    // - With parent: 'book' + '-loan' → 'book-loan'
    // - Without parent: 'books' → 'book'
    const routePrefix = options.routePrefix
      || (parentRoutePrefix ? `${parentRoutePrefix}-${this._singularize(entity)}` : this._singularize(entity))

    // Build routes array
    const routes = []

    // List route
    if (pages.list) {
      routes.push({
        path: '',
        name: routePrefix,
        component: pages.list,
        meta: { layout: 'list' }
      })
    }

    // Show route (read-only detail view)
    if (pages.show) {
      routes.push({
        path: `:${idParam}`,
        name: `${routePrefix}-show`,
        component: pages.show,
        meta: { layout: 'show' }
      })
    }

    // Form routes - single form or separate create/edit
    if (pages.form) {
      // Single form pattern (recommended)
      routes.push({
        path: 'create',
        name: `${routePrefix}-create`,
        component: pages.form
      })
      routes.push({
        path: `:${idParam}/edit`,
        name: `${routePrefix}-edit`,
        component: pages.form
      })
    } else {
      // Separate create/edit pages
      if (pages.create) {
        routes.push({
          path: 'create',
          name: `${routePrefix}-create`,
          component: pages.create
        })
      }
      if (pages.edit) {
        routes.push({
          path: `:${idParam}/edit`,
          name: `${routePrefix}-edit`,
          component: pages.edit
        })
      }
    }

    // Build route options
    const routeOpts = {}
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
      const navItem = {
        section: options.nav.section,
        route: routePrefix,
        icon: options.nav.icon,
        label
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
   * @param {string} plural - Plural word
   * @returns {string} Singular form
   * @private
   */
  _singularize(plural) {
    if (plural.endsWith('ies')) return plural.slice(0, -3) + 'y'
    if (plural.endsWith('ses') || plural.endsWith('xes') || plural.endsWith('zes')) {
      return plural.slice(0, -2)
    }
    if (plural.endsWith('s') && !plural.endsWith('ss')) return plural.slice(0, -1)
    return plural
  }

  /**
   * Capitalize first letter
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   * @private
   */
  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  /**
   * Define a zone for extensible UI composition
   *
   * @param {string} name - Zone name (e.g., 'users-list-header')
   * @param {object} [options={}] - Zone options
   * @param {import('vue').Component} [options.default] - Default component when no blocks
   * @returns {this}
   *
   * @example
   * ctx.zone('users-list-header')
   * ctx.zone('users-sidebar', { default: DefaultSidebar })
   */
  zone(name, options = {}) {
    if (this._kernel.zoneRegistry) {
      this._kernel.zoneRegistry.defineZone(name, options)
    }
    return this
  }

  /**
   * Register a block in a zone
   *
   * @param {string} zoneName - Target zone name
   * @param {object} config - Block configuration
   * @param {import('vue').Component} config.component - Vue component
   * @param {number} [config.weight=50] - Ordering weight (lower = first)
   * @param {object} [config.props={}] - Props to pass to component
   * @param {string} [config.id] - Unique identifier
   * @param {string} [config.operation='add'] - Block operation (add, replace, extend, wrap)
   * @returns {this}
   *
   * @example
   * ctx.block('users-list-header', { component: UserStats, weight: 10, id: 'user-stats' })
   */
  block(zoneName, config) {
    if (this._kernel.zoneRegistry) {
      this._kernel.zoneRegistry.registerBlock(zoneName, config)
    }
    return this
  }

  /**
   * Provide a value to Vue's dependency injection system
   *
   * @param {string|symbol} key - Injection key
   * @param {*} value - Value to provide
   * @returns {this}
   *
   * @example
   * ctx.provide('myService', new MyService())
   */
  provide(key, value) {
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
   * @param {string} name - Component name
   * @param {import('vue').Component} component - Vue component
   * @returns {this}
   *
   * @example
   * ctx.component('MyGlobalComponent', MyComponent)
   */
  component(name, component) {
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
   * @param {string} signal - Signal name (supports wildcards via SignalBus)
   * @param {Function} handler - Handler function (event, ctx) => void
   * @param {object} [options={}] - Listener options
   * @param {number} [options.priority] - Listener priority (higher = earlier)
   * @param {string} [options.id] - Unique listener ID
   * @param {boolean} [options.once] - Remove after first call
   * @returns {this}
   *
   * @example
   * ctx.on('users:created', (event) => console.log('User created:', event.data))
   * ctx.on('entity:*', (event) => console.log('Entity event:', event))
   */
  on(signal, handler, options = {}) {
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
   * @param {string} hookName - Hook name (e.g., 'users:presave')
   * @param {Function} handler - Handler function
   * @param {object} [options={}] - Hook options
   * @returns {this}
   *
   * @example
   * ctx.hook('users:presave', (context) => {
   *   context.data.updated_at = new Date().toISOString()
   *   return context
   * })
   */
  hook(hookName, handler, options = {}) {
    if (this._kernel.hookRegistry) {
      this._kernel.hookRegistry.register(hookName, handler, options)
    }
    return this
  }

  /**
   * Queue a deferred task
   *
   * @param {string} name - Deferred task name
   * @param {Function} factory - Factory function returning a promise
   * @returns {this}
   *
   * @example
   * ctx.deferred('users:warmup', async () => {
   *   await ctx.orchestrator.get('users').warmup()
   * })
   */
  defer(name, factory) {
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
   * @param {string} namespace - Permission namespace (e.g., 'books', 'auth', 'admin:config')
   * @param {Object<string, string|PermissionMeta>} permissions - Permission definitions
   * @param {Object} [options={}]
   * @param {boolean} [options.isEntity=false] - Auto-prefix with 'entity:'
   * @returns {this}
   *
   * @example
   * // Entity custom permissions (auto-prefixed with 'entity:')
   * ctx.permissions('books', {
   *   checkout: 'Checkout a book',
   *   reserve: { label: 'Reserve', description: 'Reserve a book for later' }
   * }, { isEntity: true })
   * // → entity:books:checkout, entity:books:reserve
   *
   * @example
   * // System permissions (no prefix)
   * ctx.permissions('auth', {
   *   impersonate: 'Impersonate another user',
   *   'manage-roles': 'Manage user roles'
   * })
   * // → auth:impersonate, auth:manage-roles
   *
   * @example
   * // Admin permissions with nested namespace
   * ctx.permissions('admin:config', {
   *   view: 'View configuration',
   *   edit: 'Edit configuration'
   * })
   * // → admin:config:view, admin:config:edit
   */
  permissions(namespace, permissions, options = {}) {
    if (this._kernel.permissionRegistry) {
      this._kernel.permissionRegistry.register(namespace, permissions, {
        ...options,
        module: this._module?.constructor?.name || 'unknown'
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
   * @param {string} entity - Entity name
   * @param {Object<string, string|PermissionMeta>} permissions - Permission definitions
   * @returns {this}
   *
   * @example
   * ctx.entityPermissions('books', {
   *   checkout: 'Checkout a book'
   * })
   * // → entity:books:checkout
   */
  entityPermissions(entity, permissions) {
    return this.permissions(entity, permissions, { isEntity: true })
  }
}

/**
 * Factory function to create a KernelContext instance
 *
 * @param {import('./Kernel.js').Kernel} kernel - Kernel instance
 * @param {import('./Module.js').Module} module - Module instance
 * @returns {KernelContext}
 */
export function createKernelContext(kernel, module) {
  return new KernelContext(kernel, module)
}
