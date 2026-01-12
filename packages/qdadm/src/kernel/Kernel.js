/**
 * Kernel - Simplified bootstrap for qdadm applications
 *
 * Handles all the boilerplate:
 * - Vue app creation
 * - Pinia, PrimeVue, ToastService, ConfirmationService
 * - Router with auth guard
 * - Module discovery
 * - qdadm plugin installation
 *
 * The constructor is purely declarative (stores config only).
 * All initialization happens in createApp(), allowing you to:
 * - Modify options before app creation
 * - Add custom plugins/directives after createApp() but before mount()
 *
 * Basic usage:
 * ```js
 * const kernel = new Kernel({ root: App, managers, authAdapter, ... })
 * kernel.createApp().mount('#app')
 * ```
 *
 * Advanced usage (tweaking before/after):
 * ```js
 * const kernel = new Kernel({ ... })
 *
 * // Tweak config before app creation
 * kernel.options.features.poweredBy = false
 *
 * // Create app
 * const app = kernel.createApp()
 *
 * // Add custom plugins/components before mount
 * app.component('MyGlobalComponent', MyComponent)
 * app.directive('focus', focusDirective)
 *
 * app.mount('#app')
 * ```
 */

import { createApp, h, defineComponent, ref } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import Toast from 'primevue/toast'
import ToastListener from '../toast/ToastListener.vue'

import { createQdadm } from '../plugin.js'
import { initModules, getRoutes, setSectionOrder, alterMenuSections, registry } from '../module/moduleRegistry.js'
import { createModuleLoader } from './ModuleLoader.js'
import { createKernelContext } from './KernelContext.js'
// ToastBridgeModule no longer used - Toast/ToastListener rendered at root level
import { Orchestrator } from '../orchestrator/Orchestrator.js'
import { createSignalBus } from './SignalBus'
import { createZoneRegistry } from '../zones/ZoneRegistry.js'
import { registerStandardZones } from '../zones/zones.js'
import { createHookRegistry } from '../hooks/HookRegistry'
import { createSecurityChecker } from '../entity/auth/SecurityChecker.js'
import { authFactory, CompositeAuthAdapter } from '../entity/auth/index.js'
import { PermissionRegistry } from '../security/PermissionRegistry.js'
import { StaticRoleGranterAdapter } from '../security/StaticRoleGranterAdapter.js'
import { createManagers } from '../entity/factory.js'
import { defaultStorageResolver } from '../entity/storage/factory'
import { createDeferredRegistry } from '../deferred/DeferredRegistry.js'
import { createEventRouter } from './EventRouter.js'
import { createSSEBridge } from './SSEBridge.js'
import { ActiveStack } from '../chain/ActiveStack.js'
import { StackHydrator } from '../chain/StackHydrator.js'

// Debug imports are dynamic to enable tree-shaking in production
// When debugBar: false/undefined, no debug code is bundled
let DebugModule = null
let QdadmDebugBar = null

export class Kernel {
  /**
   * @param {object} options
   * @param {object} options.root - Root Vue component
   * @param {object} options.modules - Result of import.meta.glob for module init files (legacy)
   * @param {object} options.modulesOptions - Options for initModules (e.g., { coreNavItems })
   * @param {Array} options.moduleDefs - New-style module definitions (Module classes/objects/functions)
   * @param {string[]} options.sectionOrder - Navigation section order
   * @param {object} options.managers - Entity managers { name: config } - can be instances, strings, or config objects
   * @param {object} options.managerRegistry - Registry of manager classes from qdadm-gen { name: ManagerClass }
   * @param {function} options.storageResolver - Custom storage resolver (config, entityName) => Storage
   * @param {function} options.managerResolver - Custom manager resolver (config, entityName, context) => Manager
   * @param {object} options.authAdapter - Auth adapter for login/logout (app-level authentication)
   * @param {object} options.entityAuthAdapter - Auth adapter for entity permissions (scope/silo checks)
   * @param {object} options.pages - Page components { layout, shell? }
   * @param {object} options.pages.layout - Main layout component (required)
   * @param {object} options.pages.shell - Optional app shell (enables unified routing with zones everywhere)
   * @param {string} options.homeRoute - Route name for home redirect (or object { name, component })
   * @param {Array} options.coreRoutes - Additional routes as layout children (before module routes)
   * @param {string} options.basePath - Base path for router (e.g., '/dashboard/')
   * @param {boolean} options.hashMode - Use hash-based routing (for GitHub Pages, static hosting)
   * @param {object} options.app - App config { name, shortName, version, logo, theme }
   * @param {object} options.features - Feature toggles { auth, poweredBy }
   * @param {object} options.primevue - PrimeVue config { plugin, theme, options }
   * @param {object} options.layouts - Layout components { list, form, dashboard, base }
   * @param {object} options.security - Security config { role_hierarchy, role_permissions, entity_permissions }
   * @param {boolean} options.warmup - Enable warmup at boot (default: true)
   * @param {object} options.eventRouter - EventRouter config { 'source:signal': ['target:signal', ...] }
   * @param {object} options.sse - SSEBridge config { url, reconnectDelay, signalPrefix, autoConnect, events }
   * @param {object} options.debugBar - Debug bar config { module: DebugModule, component: QdadmDebugBar, ...options }
   * @param {boolean} options.toast - Reserved for future use (toast is always enabled when PrimeVue is configured)
   */
  constructor(options) {
    // Auto-inject DebugModule if debugBar.module is provided
    // User must import DebugModule separately for tree-shaking
    if (options.debugBar?.module) {
      const DebugModuleClass = options.debugBar.module
      const { module: _, component: __, ...debugModuleOptions } = options.debugBar
      // Enable by default when using debugBar shorthand
      if (debugModuleOptions.enabled === undefined) {
        debugModuleOptions.enabled = true
      }
      // Mark as kernel-managed to prevent zone block registration
      // (Kernel handles rendering via root wrapper)
      debugModuleOptions._kernelManaged = true
      const debugModule = new DebugModuleClass(debugModuleOptions)
      options.moduleDefs = options.moduleDefs || []
      options.moduleDefs.push(debugModule)
      // Store component for root wrapper
      QdadmDebugBar = options.debugBar.component
      // Enable debug mode
      if (!options.debug) {
        options.debug = true
      }
    }

    // Note: Toast is now handled at root level via _createVueApp()
    // ToastBridgeModule is no longer auto-injected to avoid duplicate listeners

    this.options = options
    this.vueApp = null
    this.router = null
    this.signals = null
    this.orchestrator = null
    this.zoneRegistry = null
    this.hookRegistry = null
    this.deferred = null
    this.eventRouter = null
    this.sseBridge = null
    this.layoutComponents = null
    this.securityChecker = null
    /** @type {import('../security/PermissionRegistry.js').PermissionRegistry|null} */
    this.permissionRegistry = null
    /** @type {import('./ModuleLoader.js').ModuleLoader|null} */
    this.moduleLoader = null
    /** @type {Map<string|symbol, any>} Pending provides from modules (applied after vueApp creation) */
    this._pendingProvides = new Map()
    /** @type {Map<string, import('vue').Component>} Pending components from modules */
    this._pendingComponents = new Map()
    /** @type {import('vue').Ref<number>} App key for force remount on auth changes */
    this._appKey = ref(0)
  }

  /**
   * Resolve entityAuthAdapter through authFactory
   *
   * Enables multiple configuration styles:
   * - Instance passthrough (backward compatible): authAdapter instance
   * - String pattern: 'permissive', 'jwt' (if registered in authTypes)
   * - Config object: { type: 'jwt', ... }
   * - Composite: { default: adapter, mapping: { 'entity': adapter } }
   *
   * @private
   */
  _resolveEntityAuthAdapter() {
    const { entityAuthAdapter, authTypes } = this.options

    // No adapter configured → nothing to resolve
    if (entityAuthAdapter == null) return

    // Build factory context with CompositeAuthAdapter available
    const context = {
      authTypes: authTypes || {},
      CompositeAuthAdapter
    }

    // Resolve through factory (handles all input types)
    this.options.entityAuthAdapter = authFactory(entityAuthAdapter, context)
  }

  /**
   * Create and configure the Vue app
   *
   * Note: This method is synchronous for backward compatibility.
   * New-style modules (moduleDefs) are loaded synchronously via _loadModules().
   * For async module loading, use createAppAsync() instead.
   *
   * @returns {App} Vue app instance ready to mount
   */
  createApp() {
    // 0. Resolve entityAuthAdapter (supports instance, string, config, composite)
    this._resolveEntityAuthAdapter()
    // 1. Create services first (modules need them)
    this._createSignalBus()
    this._createHookRegistry()
    this._createZoneRegistry()
    this._createActiveStack()
    this._createDeferredRegistry()
    // 2. Create orchestrator early (modules need it for ctx.entity())
    this._createOrchestrator()
    // 2.1. Create stack hydrator (needs activeStack + orchestrator)
    this._createStackHydrator()
    // 2.5. Create PermissionRegistry early (modules register permissions via ctx.entity())
    this._createPermissionRegistry()
    // 2.6. Setup security early (SecurityModule needs ctx.security)
    this._setupSecurity()
    // 3. Register auth:ready deferred (if auth configured)
    this._registerAuthDeferred()
    // 4. Initialize legacy modules (can use all services, registers routes)
    this._initModules()
    // 4.5. Load new-style modules (moduleDefs) - synchronous for backward compat
    this._loadModulesSync()
    // 5. Create router (needs routes from modules)
    this._createRouter()
    // 5.5. Setup stack sync (rebuild activeStack on route change)
    this._setupStackSync()
    // 5.6. Setup auth guard (if authAdapter provided)
    this._setupAuthGuard()
    // 6. Setup auth:expired handler (needs router + authAdapter)
    this._setupAuthExpiredHandler()
    // 6.5. Setup auth impersonation (authAdapter reacts to signals)
    this._setupAuthImpersonation()
    // 6.6. Setup auth invalidation (remount app on auth changes)
    this._setupAuthInvalidation()
    // 7. Wire modules that need orchestrator (phase 2 - kernel:ready signal)
    this._wireModules()
    // 8. Create EventRouter (needs signals + orchestrator)
    this._createEventRouter()
    // 9. Create SSEBridge (needs signals + authAdapter for token)
    this._createSSEBridge()
    this._createLayoutComponents()
    this._createVueApp()
    this._installPlugins()
    // 10. Fire warmups (fire-and-forget, pages await via DeferredRegistry)
    this._fireWarmups()
    return this.vueApp
  }

  /**
   * Create and configure the Vue app asynchronously
   *
   * Use this method when modules have async connect() methods.
   * Supports the full async module loading flow.
   *
   * @returns {Promise<App>} Vue app instance ready to mount
   */
  async createAppAsync() {
    // 0. Resolve entityAuthAdapter (supports instance, string, config, composite)
    this._resolveEntityAuthAdapter()
    // 1. Create services first (modules need them)
    this._createSignalBus()
    this._createHookRegistry()
    this._createZoneRegistry()
    this._createActiveStack()
    this._createDeferredRegistry()
    // 2. Create orchestrator early (modules need it for ctx.entity())
    this._createOrchestrator()
    // 2.1. Create stack hydrator (needs activeStack + orchestrator)
    this._createStackHydrator()
    // 2.5. Create PermissionRegistry early (modules register permissions via ctx.entity())
    this._createPermissionRegistry()
    // 2.6. Setup security early (SecurityModule needs ctx.security)
    this._setupSecurity()
    // 3. Register auth:ready deferred (if auth configured)
    this._registerAuthDeferred()
    // 4. Initialize legacy modules (can use all services, registers routes)
    this._initModules()
    // 4.5. Load new-style modules (moduleDefs) - async version
    await this._loadModules()
    // 5. Create router (needs routes from modules)
    this._createRouter()
    // 5.5. Setup stack sync (rebuild activeStack on route change)
    this._setupStackSync()
    // 5.6. Setup auth guard (if authAdapter provided)
    this._setupAuthGuard()
    // 6. Setup auth:expired handler (needs router + authAdapter)
    this._setupAuthExpiredHandler()
    // 6.5. Setup auth impersonation (authAdapter reacts to signals)
    this._setupAuthImpersonation()
    // 6.6. Setup auth invalidation (remount app on auth changes)
    this._setupAuthInvalidation()
    // 7. Wire modules that need orchestrator (phase 2 - kernel:ready signal)
    await this._wireModulesAsync()
    // 8. Create EventRouter (needs signals + orchestrator)
    this._createEventRouter()
    // 9. Create SSEBridge (needs signals + authAdapter for token)
    this._createSSEBridge()
    this._createLayoutComponents()
    this._createVueApp()
    this._installPlugins()
    // 10. Fire warmups (fire-and-forget, pages await via DeferredRegistry)
    this._fireWarmups()
    return this.vueApp
  }

  /**
   * Register auth:ready deferred if auth is configured
   * This allows warmup and other services to await authentication.
   */
  _registerAuthDeferred() {
    const { authAdapter } = this.options
    if (!authAdapter) return

    // Create a promise that resolves on first auth:login
    this.deferred.queue('auth:ready', () => {
      return new Promise(resolve => {
        this.signals.once('auth:login', ({ user }) => {
          resolve(user)
        })
      })
    })
  }

  /**
   * Setup handler for auth:expired signal
   *
   * When auth:expired is emitted (e.g., from API 401/403 response),
   * this handler:
   * 1. Calls authAdapter.logout() to clear tokens
   * 2. Redirects to login page
   * 3. Optionally calls onAuthExpired callback
   *
   * To emit auth:expired from your API client:
   * ```js
   * axios.interceptors.response.use(
   *   response => response,
   *   error => {
   *     if (error.response?.status === 401 || error.response?.status === 403) {
   *       signals.emit('auth:expired', { status: error.response.status })
   *     }
   *     return Promise.reject(error)
   *   }
   * )
   * ```
   */
  _setupAuthExpiredHandler() {
    const { authAdapter, onAuthExpired } = this.options
    if (!authAdapter) return

    this.signals.on('auth:expired', async (payload) => {
      const debug = this.options.debug ?? false
      if (debug) {
        console.warn('[Kernel] auth:expired received:', payload)
      }

      // 1. Logout (clear tokens)
      if (authAdapter.logout) {
        authAdapter.logout()
      }

      // 2. Emit auth:logout signal
      await this.signals.emit('auth:logout', { reason: 'expired', ...payload })

      // 3. Redirect to login (if not already there)
      if (this.router.currentRoute.value.name !== 'login') {
        this.router.push({ name: 'login', query: { expired: '1' } })
      }

      // 4. Optional callback
      if (onAuthExpired) {
        onAuthExpired(payload)
      }
    })
  }

  /**
   * Setup authAdapter to react to impersonation signals
   *
   * If the authAdapter has a connectSignals() method, wire it up to the
   * signal bus so it can react to auth:impersonate and auth:impersonate:stop
   * signals automatically.
   *
   * This enables signal-driven impersonation: components emit signals,
   * authAdapter updates its state in response.
   */
  _setupAuthImpersonation() {
    const { authAdapter } = this.options
    if (!authAdapter?.connectSignals) return

    const debug = this.options.debug ?? false
    if (debug) {
      console.debug('[Kernel] Wiring authAdapter.connectSignals() for impersonation')
    }

    // Connect authAdapter to signals - returns cleanup function
    this._authImpersonationCleanup = authAdapter.connectSignals(this.signals)
  }

  /**
   * Setup auth invalidation - remount entire app on auth changes
   *
   * This centralizes the auth signal handling that was previously spread
   * across multiple composables (useAuth, useNavigation, useUserImpersonator).
   * Changing _appKey forces Vue to remount the root component and all children.
   */
  _setupAuthInvalidation() {
    const debug = this.options.debug ?? false
    const authSignals = ['auth:login', 'auth:logout', 'auth:impersonate', 'auth:impersonate:stop']

    for (const signal of authSignals) {
      this.signals.on(signal, () => {
        if (debug) {
          console.debug(`[Kernel] ${signal} → invalidateApp()`)
        }
        this.invalidateApp()
      })
    }
  }

  /**
   * Force full app remount
   *
   * Increments _appKey which causes Vue to destroy and recreate
   * the root component and all its children. Use sparingly.
   */
  invalidateApp() {
    this._appKey.value++
  }

  /**
   * Fire entity cache warmups
   * Fire-and-forget: pages that need cache will await via DeferredRegistry.
   * Controlled by options.warmup (default: true).
   */
  _fireWarmups() {
    const warmup = this.options.warmup ?? true
    if (!warmup) return

    // Fire-and-forget: each manager awaits its dependencies (auth:ready, etc.)
    this.orchestrator.fireWarmups()
  }

  /**
   * Initialize legacy modules from glob import
   * Passes services to modules for zone/signal/hook registration
   */
  _initModules() {
    if (this.options.sectionOrder) {
      setSectionOrder(this.options.sectionOrder)
    }
    if (this.options.modules) {
      initModules(this.options.modules, {
        ...this.options.modulesOptions,
        zones: this.zoneRegistry,
        signals: this.signals,
        hooks: this.hookRegistry,
        deferred: this.deferred
      })
    }
  }

  /**
   * Create KernelContext for module connection
   *
   * Creates a context object that provides modules access to kernel services
   * and registration APIs.
   *
   * @param {import('./Module.js').Module} module - Module instance
   * @returns {import('./KernelContext.js').KernelContext}
   * @private
   */
  _createModuleContext(module) {
    return createKernelContext(this, module)
  }

  /**
   * Load new-style modules synchronously
   *
   * Used by createApp() for backward compatibility. Modules with async
   * connect() methods will have their promises ignored (fire-and-forget).
   * For proper async support, use createAppAsync().
   *
   * @private
   */
  _loadModulesSync() {
    const { moduleDefs } = this.options
    if (!moduleDefs?.length) return

    this.moduleLoader = createModuleLoader()

    // Add all modules
    for (const mod of moduleDefs) {
      this.moduleLoader.add(mod)
    }

    // Get sorted modules and load synchronously
    const sorted = this.moduleLoader._topologicalSort()

    for (const name of sorted) {
      const module = this.moduleLoader._registered.get(name)
      const ctx = this._createModuleContext(module)

      // Check if enabled
      if (!module.enabled(ctx)) {
        continue
      }

      // Load module styles if defined (must happen before connect)
      if (typeof module.loadStyles === 'function') {
        const styleResult = module.loadStyles()
        // Fire-and-forget for async style loading in sync context
        if (styleResult instanceof Promise) {
          styleResult.catch(err => {
            console.warn(`[Kernel] Module '${name}' styles failed:`, err)
          })
        }
      }

      // Connect module (sync - async modules will be fire-and-forget)
      const result = module.connect(ctx)

      // If it's a promise, we can't await it in sync context
      // The module should handle its own async initialization
      if (result instanceof Promise) {
        result.catch(err => {
          console.error(`[Kernel] Async module '${name}' failed:`, err)
        })
      }

      this.moduleLoader._loaded.set(name, module)
      this.moduleLoader._loadOrder.push(name)
    }
  }

  /**
   * Load new-style modules asynchronously
   *
   * Fully supports async connect() methods in modules.
   * Used by createAppAsync().
   *
   * @returns {Promise<void>}
   * @private
   */
  async _loadModules() {
    const { moduleDefs } = this.options
    if (!moduleDefs?.length) return

    this.moduleLoader = createModuleLoader()

    // Add all modules
    for (const mod of moduleDefs) {
      this.moduleLoader.add(mod)
    }

    // Get sorted modules and load
    const sorted = this.moduleLoader._topologicalSort()

    for (const name of sorted) {
      const module = this.moduleLoader._registered.get(name)
      const ctx = this._createModuleContext(module)

      // Check if enabled
      if (!module.enabled(ctx)) {
        continue
      }

      // Load module styles if defined (must happen before connect)
      if (typeof module.loadStyles === 'function') {
        await module.loadStyles()
      }

      // Connect module (await async)
      await module.connect(ctx)

      this.moduleLoader._loaded.set(name, module)
      this.moduleLoader._loadOrder.push(name)
    }
  }

  /**
   * Wire modules that need orchestrator (phase 2)
   *
   * Some modules may need access to the orchestrator after it's created.
   * This method emits 'kernel:ready' signal that modules can listen to.
   *
   * Note: We don't pass kernel/orchestrator in the payload to avoid cyclic
   * reference errors when debug logging is enabled. Handlers can access
   * these via their stored context from connect().
   *
   * @private
   */
  _wireModules() {
    if (!this.moduleLoader) return

    // Emit kernel:ready signal - payload is intentionally minimal to avoid
    // cyclic reference errors when QuarKernel debug mode serializes events
    const result = this.signals.emit('kernel:ready', {
      ready: true
    })

    // If emit returns a promise (async handlers), we can't await it
    if (result instanceof Promise) {
      result.catch(err => {
        console.error('[Kernel] kernel:ready handler failed:', err)
      })
    }
  }

  /**
   * Wire modules that need orchestrator (phase 2) - async version
   *
   * @returns {Promise<void>}
   * @private
   */
  async _wireModulesAsync() {
    if (!this.moduleLoader) return

    // Emit kernel:ready signal - payload is intentionally minimal to avoid
    // cyclic reference errors when QuarKernel debug mode serializes events
    await this.signals.emit('kernel:ready', {
      ready: true
    })
  }

  /**
   * Create Vue Router
   *
   * Routes are built from:
   * 1. Module routes (via ctx.routes()) - can be public or protected via meta
   * 2. coreRoutes option - additional routes
   * 3. homeRoute - redirect or component for /
   *
   * Auth is NOT hardcoded here - it's handled via:
   * - Route meta: { public: true } or { requiresAuth: false }
   * - Auth guard registered via _setupAuthGuard() if authAdapter provided
   *
   * Layout modes:
   * - **Shell mode** (pages.shell): All routes inside shell, layout wraps protected area
   * - **Layout-only mode**: Layout at root with all routes as children
   */
  _createRouter() {
    const { pages, homeRoute, coreRoutes, basePath } = this.options

    // Layout is required (shell is optional)
    if (!pages?.layout) {
      throw new Error('[Kernel] pages.layout is required')
    }

    // Build home route
    // Note: Must have a name to avoid Vue Router warning when parent (_layout) has a name
    let homeRouteConfig
    if (typeof homeRoute === 'object' && homeRoute.component) {
      homeRouteConfig = { path: '', name: homeRoute.name || '_home', ...homeRoute }
    } else {
      homeRouteConfig = { path: '', name: '_home', redirect: { name: homeRoute || 'home' } }
    }

    // Collect all module routes
    const moduleRoutes = getRoutes()

    // Separate public routes (meta.public or meta.requiresAuth === false)
    const publicRoutes = moduleRoutes.filter(r => r.meta?.public || r.meta?.requiresAuth === false)
    const protectedRoutes = moduleRoutes.filter(r => !r.meta?.public && r.meta?.requiresAuth !== false)

    // Auto-create login route if pages.login is provided (backward compatibility)
    // This creates a public route that modules don't need to define explicitly.
    if (pages.login) {
      publicRoutes.unshift({
        path: '/login',
        name: 'login',
        component: pages.login,
        meta: { public: true }
      })
    }

    // Build layout children: home + coreRoutes + protected module routes
    const layoutChildren = [
      homeRouteConfig,
      ...(coreRoutes || []),
      ...protectedRoutes
    ]

    let routes

    if (pages.shell) {
      // Shell mode: shell wraps everything, layout wraps protected area
      routes = [
        {
          path: '/',
          name: '_shell',
          component: pages.shell,
          children: [
            // Public routes at shell level (login, register, etc.)
            ...publicRoutes,
            // Protected area with layout
            {
              path: '',
              name: '_layout',
              component: pages.layout,
              meta: { requiresAuth: true },
              children: layoutChildren
            }
          ]
        }
      ]
    } else {
      // Layout-only mode: layout at root
      // Public routes need to be handled differently (no shell)
      routes = [
        // Public routes standalone
        ...publicRoutes,
        // Protected area with layout
        {
          path: '/',
          name: '_layout',
          component: pages.layout,
          meta: { requiresAuth: true },
          children: layoutChildren
        }
      ]
    }

    // Add 404 catch-all route
    const notFoundComponent = pages.notFound || (() => import('../components/pages/NotFoundPage.vue'))
    const notFoundRoute = {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: notFoundComponent,
      meta: { public: true }
    }

    // Insert 404 route at the end of top-level routes
    routes.push(notFoundRoute)

    const { hashMode } = this.options
    const history = hashMode
      ? createWebHashHistory(basePath)
      : createWebHistory(basePath)

    this.router = createRouter({
      history,
      routes
    })
  }

  /**
   * Setup auth guard on router
   *
   * Only installed if authAdapter is provided.
   * Uses route meta to determine access:
   * - meta.public: true → always accessible
   * - meta.requiresAuth: false → always accessible
   * - meta.requiresAuth: true → requires auth (default for layout children)
   * - no meta → inherits from parent route
   */
  _setupAuthGuard() {
    const { authAdapter } = this.options
    if (!authAdapter) return

    // Track if user was ever authenticated (to detect session loss)
    let wasEverAuthenticated = authAdapter.isAuthenticated()

    // Listen for session loss signal and show toast
    const debug = this.options.debug ?? false
    this.signals.on('auth:session-lost', () => {
      if (debug) {
        console.warn('[Kernel] auth:session-lost received, emitting toast:warn')
      }
      this.orchestrator.toast.warn(
        'Session lost',
        'Your session has expired. Please log in again.',
        'Kernel'
      )
    })

    this.router.beforeEach((to, from, next) => {
      // Update auth tracking
      if (authAdapter.isAuthenticated()) {
        wasEverAuthenticated = true
      }

      // Check if route or any parent is explicitly public
      const isPublic = to.matched.some(record =>
        record.meta.public === true || record.meta.requiresAuth === false
      )

      if (isPublic) {
        next()
        return
      }

      // Check if route or any parent requires auth
      const requiresAuth = to.matched.some(record => record.meta.requiresAuth === true)

      if (requiresAuth && !authAdapter.isAuthenticated()) {
        // Session loss detected - emit signal if user was previously authenticated
        if (wasEverAuthenticated) {
          const debug = this.options.debug ?? false
          if (debug) {
            console.warn('[Kernel] Session lost detected, emitting auth:session-lost')
          }
          this.signals.emit('auth:session-lost', {
            reason: 'token_missing',
            redirectTo: 'login'
          })
          // Reset tracking for next session
          wasEverAuthenticated = false
        }

        // Redirect to login with session_lost param (if exists) or emit signal
        const loginRoute = this.router.hasRoute('login')
          ? { name: 'login', query: { session_lost: '1' } }
          : '/'
        next(loginRoute)
        return
      }

      // Check entity permissions (authorization, not just authentication)
      const entity = to.meta?.entity
      if (entity && this.orchestrator) {
        try {
          const manager = this.orchestrator.get(entity)
          if (manager && !manager.canRead()) {
            // Show visible error via toast
            console.warn(`[qdadm] Access denied to ${to.path} (entity: ${entity})`)
            this.orchestrator.toast.error(
              'Access Denied',
              `You don't have permission to access ${manager.labelPlural || entity}`,
              'Kernel'
            )
            // Emit signal for custom error handling
            this.signals.emit('auth:access-denied', {
              path: to.path,
              entity,
              manager
            })
            // Redirect to home
            next({ path: '/' })
            return
          }
        } catch (e) {
          // Entity not registered - allow navigation (route guard handles unknown entities)
        }
      }

      next()
    })
  }

  /**
   * Setup activeStack synchronization with router
   * Rebuilds the stack on every route change (single source of truth)
   */
  _setupStackSync() {
    this.router.afterEach((to) => {
      this._rebuildActiveStack(to)
    })
  }

  /**
   * Rebuild activeStack from route
   * @param {object} route - Vue Router route object
   * @private
   */
  _rebuildActiveStack(route) {
    const entityConfig = route.meta?.entity
    if (!entityConfig) {
      this.activeStack.clear()
      return
    }

    const levels = []

    // Build parent chain from route.meta.parent
    let parentConfig = route.meta?.parent
    while (parentConfig) {
      const id = route.params[parentConfig.param] ?? null
      levels.unshift({
        entity: parentConfig.entity,
        param: parentConfig.param,
        foreignKey: null,
        id,
      })
      parentConfig = parentConfig.parent ?? null
    }

    // Add current entity ONLY if it has an ID
    const manager = this.orchestrator?.get(entityConfig)
    const idField = manager?.idField ?? 'id'
    const currentId = route.params[idField] ?? null
    const currentForeignKey = route.meta?.parent?.foreignKey ?? null

    if (currentId) {
      levels.push({
        entity: entityConfig,
        param: idField,
        foreignKey: currentForeignKey,
        id: currentId,
      })
    }

    this.activeStack.set(levels)
  }

  /**
   * Create signal bus for event-driven communication
   */
  _createSignalBus() {
    const debug = this.options.debug ?? false
    this.signals = createSignalBus({ debug })
  }

  /**
   * Create hook registry for Drupal-inspired extensibility
   * Shares the same QuarKernel instance as the signal bus for unified event bus
   */
  _createHookRegistry() {
    const debug = this.options.debug ?? false
    // HookRegistry shares the same QuarKernel as SignalBus for unified event bus
    // Both use the underlying kernel for event dispatch
    this.hookRegistry = createHookRegistry({
      kernel: this.signals.getKernel(),
      debug,
    })
  }

  /**
   * Create orchestrator with managers and signal bus
   * Injects entityAuthAdapter and hookRegistry into all managers for permission checks
   * and lifecycle hook support.
   *
   * Uses createManagers() to resolve manager configs through the factory pattern:
   * - String patterns ('api:/api/bots') → creates storage + manager
   * - Config objects ({ storage: '...', label: '...' }) → resolved
   * - Manager instances → passed through directly
   */
  _createOrchestrator() {
    // Build factory context with resolvers and registry
    const factoryContext = {
      storageResolver: this.options.storageResolver || defaultStorageResolver,
      managerResolver: this.options.managerResolver,
      managerRegistry: this.options.managerRegistry || {}
    }

    // Resolve all managers through factory
    const managers = createManagers(this.options.managers || {}, factoryContext)

    this.orchestrator = new Orchestrator({
      managers,
      signals: this.signals,
      hooks: this.hookRegistry,
      deferred: this.deferred,
      entityAuthAdapter: this.options.entityAuthAdapter || null
    })

    // Apply toast config if provided (life defaults per severity)
    if (this.options.toast) {
      this.orchestrator.setToastConfig(this.options.toast)
    }
  }

  /**
   * Create PermissionRegistry early so modules can register permissions
   * via ctx.entity() and ctx.permissions()
   */
  _createPermissionRegistry() {
    this.permissionRegistry = new PermissionRegistry()

    // Register core system permissions
    this._registerCorePermissions()
  }

  /**
   * Register core system permissions provided by the framework
   * These are always available regardless of which modules are loaded
   */
  _registerCorePermissions() {
    // Auth permissions - for impersonation and auth management
    this.permissionRegistry.register('auth', {
      'impersonate': 'Impersonate other users',
      'manage': 'Manage authentication settings'
    })

    // Admin permissions - for system administration
    this.permissionRegistry.register('admin', {
      'access': 'Access admin panel',
      'config': 'Edit system configuration'
    })
  }

  /**
   * Setup security layer (role hierarchy, permissions)
   *
   * If security config is provided, creates a SecurityChecker and wires it
   * into the entityAuthAdapter for isGranted() support.
   *
   * Security config:
   * ```js
   * security: {
   *   role_hierarchy: { ROLE_ADMIN: ['ROLE_USER'] },
   *   role_permissions: {
   *     ROLE_USER: ['entity:read', 'entity:list'],
   *     ROLE_ADMIN: ['entity:create', 'entity:update', 'entity:delete'],
   *   },
   *   entity_permissions: false  // false | true | ['books', 'loans']
   * }
   * ```
   */
  _setupSecurity() {
    const { security, entityAuthAdapter } = this.options

    // PermissionRegistry should already be created by _createPermissionRegistry()
    // but create it here as fallback for backward compatibility
    if (!this.permissionRegistry) {
      this.permissionRegistry = new PermissionRegistry()
    }

    if (!security) return

    // Resolve roleGranter: explicit adapter or auto-create from config
    let roleGranter = security.roleGranter
    if (!roleGranter && (security.role_permissions || security.role_hierarchy)) {
      roleGranter = new StaticRoleGranterAdapter({
        role_hierarchy: security.role_hierarchy || {},
        role_permissions: security.role_permissions || {},
        role_labels: security.role_labels || {}
      })
    }

    // Create SecurityChecker with roleGranter
    this.securityChecker = createSecurityChecker({
      roleGranter,
      getCurrentUser: () => entityAuthAdapter?.getCurrentUser?.() || null
    })

    // Store entity_permissions config for EntityManager to use
    this.securityChecker.entityPermissions = security.entity_permissions ?? false

    // Wire SecurityChecker into entityAuthAdapter
    if (entityAuthAdapter?.setSecurityChecker) {
      entityAuthAdapter.setSecurityChecker(this.securityChecker)
    }

    // Install roleGranter (for EntityRoleGranterAdapter signal subscriptions)
    if (roleGranter?.install) {
      // Create minimal context for roleGranter installation
      const ctx = {
        orchestrator: this.orchestrator,
        signals: this.signals
      }
      roleGranter.install(ctx)
    }
  }

  /**
   * Create zone registry for extensible UI composition
   * Zones are created dynamically when used (no pre-registration).
   */
  _createZoneRegistry() {
    const debug = this.options.debug ?? false
    this.zoneRegistry = createZoneRegistry({ debug })
  }

  /**
   * Create active stack for navigation state
   * Holds the sync stack of levels (entity, param, foreignKey, id).
   */
  _createActiveStack() {
    this.activeStack = new ActiveStack(this.signals)
  }

  /**
   * Create stack hydrator for async data loading
   * Hydrates stack levels with entity data and labels.
   * Must be called after activeStack and orchestrator are created.
   */
  _createStackHydrator() {
    this.stackHydrator = new StackHydrator(this.activeStack, this.orchestrator, this.signals)
  }

  /**
   * Create deferred registry for async service loading
   * Enables loose coupling between services and components via named promises.
   */
  _createDeferredRegistry() {
    const debug = this.options.debug ?? false
    this.deferred = createDeferredRegistry({
      kernel: this.signals?.getKernel(),
      debug
    })
  }

  /**
   * Create EventRouter for declarative signal routing
   * Transforms high-level events into targeted signals.
   */
  _createEventRouter() {
    const { eventRouter: routes } = this.options
    if (!routes || Object.keys(routes).length === 0) return

    const debug = this.options.debug ?? false
    this.eventRouter = createEventRouter({
      signals: this.signals,
      orchestrator: this.orchestrator,
      routes,
      debug
    })
  }

  /**
   * Create SSEBridge for Server-Sent Events to SignalBus integration
   *
   * SSE config:
   * ```js
   * sse: {
   *   url: '/api/events',       // SSE endpoint
   *   reconnectDelay: 5000,     // Reconnect delay (ms), 0 to disable
   *   signalPrefix: 'sse',      // Signal prefix (default: 'sse')
   *   autoConnect: false,       // Connect immediately vs wait for auth:login
   *   events: ['task:completed', 'bot:status']  // Event names to register
   * }
   * ```
   */
  _createSSEBridge() {
    const { sse, authAdapter } = this.options
    if (!sse?.url) return

    const debug = this.options.debug ?? false

    // Build getToken from authAdapter
    const getToken = authAdapter?.getToken
      ? () => authAdapter.getToken()
      : () => localStorage.getItem('auth_token')

    this.sseBridge = createSSEBridge({
      signals: this.signals,
      url: sse.url,
      reconnectDelay: sse.reconnectDelay ?? 5000,
      signalPrefix: sse.signalPrefix ?? 'sse',
      autoConnect: sse.autoConnect ?? false,
      withCredentials: sse.withCredentials ?? false,
      tokenParam: sse.tokenParam ?? 'token',
      getToken,
      debug
    })

    // Register known event names if provided
    if (sse.events?.length) {
      // Wait for connection before registering
      this.signals.once('sse:connected').then(() => {
        this.sseBridge.registerEvents(sse.events)
      })
    }
  }

  /**
   * Create layout components map for useLayoutResolver
   * Maps layout types to their Vue components.
   */
  _createLayoutComponents() {
    const layouts = this.options.layouts || {}
    this.layoutComponents = {
      list: layouts.list || layouts.ListLayout || null,
      form: layouts.form || layouts.FormLayout || null,
      dashboard: layouts.dashboard || layouts.DashboardLayout || null,
      base: layouts.base || layouts.BaseLayout || null
    }
  }

  /**
   * Create Vue app instance
   *
   * Always wraps the root component with:
   * - Toast (for global toast notifications on all pages including login)
   * - QdadmDebugBar (if debugBar is enabled)
   */
  _createVueApp() {
    if (!this.options.root) {
      throw new Error('[Kernel] root component is required')
    }

    const OriginalRoot = this.options.root
    const DebugBarComponent = this.options.debugBar?.component && QdadmDebugBar ? QdadmDebugBar : null
    const hasPrimeVue = !!this.options.primevue?.plugin
    const appKey = this._appKey

    // Wrap root with Toast + ToastListener (for global toasts on all pages) and optionally DebugBar
    // Note: Apps should NOT include their own <Toast /> - Kernel provides it at root level
    // appKey enables full app remount on auth changes (login/logout/impersonate)
    const WrappedRoot = defineComponent({
      name: 'QdadmRootWrapper',
      setup() {
        return () => {
          const children = [h(OriginalRoot, { key: appKey.value })]

          // Add global Toast and ToastListener if PrimeVue is configured
          if (hasPrimeVue) {
            children.push(h(Toast))
            children.push(h(ToastListener))
          }

          // Add DebugBar if enabled
          if (DebugBarComponent) {
            children.push(h(DebugBarComponent))
          }

          return h('div', { id: 'qdadm-root', style: 'display: contents' }, children)
        }
      }
    })

    this.vueApp = createApp(WrappedRoot)
  }

  /**
   * Install all plugins on Vue app
   */
  _installPlugins() {
    const app = this.vueApp
    const { authAdapter, features, primevue } = this.options

    // Pinia
    app.use(createPinia())

    // PrimeVue (plugin passed by app to avoid peer dep issues)
    if (primevue?.plugin) {
      const pvConfig = {
        theme: {
          preset: primevue.theme,
          options: {
            darkModeSelector: '.dark-mode',
            ...primevue.options
          }
        }
      }
      app.use(primevue.plugin, pvConfig)
      app.use(ToastService)
      app.use(ConfirmationService)
      app.directive('tooltip', Tooltip)
    }

    // Router
    app.use(this.router)

    // Apply pending provides from modules (registered before vueApp existed)
    for (const [key, value] of this._pendingProvides) {
      app.provide(key, value)
    }
    this._pendingProvides.clear()

    // Apply pending components from modules
    for (const [name, component] of this._pendingComponents) {
      app.component(name, component)
    }
    this._pendingComponents.clear()

    // Extract home route name for breadcrumb
    const { homeRoute } = this.options
    const homeRouteName = typeof homeRoute === 'object' ? homeRoute.name : homeRoute

    // Zone registry injection
    app.provide('qdadmZoneRegistry', this.zoneRegistry)

    // Active stack injection (for navigation context)
    app.provide('qdadmActiveStack', this.activeStack)

    // Stack hydrator injection (for async data loading)
    app.provide('qdadmStackHydrator', this.stackHydrator)

    // Dev mode: expose qdadm services on window for DevTools inspection
    if (this.options.debug && typeof window !== 'undefined') {
      window.__qdadm = {
        kernel: this,
        orchestrator: this.orchestrator,
        signals: this.signals,
        hooks: this.hookRegistry,
        zones: this.zoneRegistry,
        activeStack: this.activeStack,
        stackHydrator: this.stackHydrator,
        deferred: this.deferred,
        router: this.router,
        // Helper to get a manager quickly
        get: (name) => this.orchestrator.get(name),
        // List all managers
        managers: () => this.orchestrator.getRegisteredNames()
      }
      // Legacy alias
      window.__qdadmZones = this.zoneRegistry
      console.debug('[qdadm] Debug mode: window.__qdadm exposed (orchestrator, signals, hooks, zones, deferred, router)')
    }

    // Signal bus injection
    app.provide('qdadmSignals', this.signals)

    // SSEBridge injection (if configured)
    if (this.sseBridge) {
      app.provide('qdadmSSEBridge', this.sseBridge)
    }

    // Hook registry injection
    app.provide('qdadmHooks', this.hookRegistry)

    // Deferred registry injection
    app.provide('qdadmDeferred', this.deferred)

    // Layout components injection for useLayoutResolver
    app.provide('qdadmLayoutComponents', this.layoutComponents)

    // Security injection (for SecurityModule and other system modules)
    if (this.securityChecker) {
      app.provide('qdadmSecurityChecker', this.securityChecker)
    }
    if (this.permissionRegistry) {
      app.provide('qdadmPermissionRegistry', this.permissionRegistry)
    }

    // qdadm plugin
    // Note: Don't pass managers here - orchestrator already has resolved managers
    // from createManagers(). Passing raw configs would overwrite them.
    app.use(createQdadm({
      orchestrator: this.orchestrator,
      authAdapter,
      router: this.router,
      toast: app.config.globalProperties.$toast,
      app: this.options.app,
      homeRoute: homeRouteName,
      features: {
        auth: !!authAdapter,
        poweredBy: true,
        ...features
      }
    }))
  }

  /**
   * Get the Vue Router instance
   * @returns {Router}
   */
  getRouter() {
    return this.router
  }

  /**
   * Get the Vue app instance (available after mount)
   * @returns {App}
   */
  getApp() {
    return this.vueApp
  }

  /**
   * Get the Orchestrator instance
   * @returns {Orchestrator}
   */
  getOrchestrator() {
    return this.orchestrator
  }

  /**
   * Get the SignalBus instance
   * @returns {SignalBus}
   */
  getSignals() {
    return this.signals
  }

  /**
   * Get the ZoneRegistry instance
   * @returns {ZoneRegistry}
   */
  getZoneRegistry() {
    return this.zoneRegistry
  }

  /**
   * Get the HookRegistry instance
   * @returns {HookRegistry}
   */
  getHookRegistry() {
    return this.hookRegistry
  }

  /**
   * Shorthand accessor for hook registry
   * Allows `kernel.hooks.register(...)` syntax
   * @returns {HookRegistry}
   */
  get hooks() {
    return this.hookRegistry
  }

  /**
   * Get the DeferredRegistry instance
   * @returns {import('../deferred/DeferredRegistry.js').DeferredRegistry}
   */
  getDeferredRegistry() {
    return this.deferred
  }

  /**
   * Get the EventRouter instance
   * @returns {import('./EventRouter.js').EventRouter|null}
   */
  getEventRouter() {
    return this.eventRouter
  }

  /**
   * Get the SSEBridge instance
   * @returns {import('./SSEBridge.js').SSEBridge|null}
   */
  getSSEBridge() {
    return this.sseBridge
  }

  /**
   * Shorthand accessor for SSE bridge
   * @returns {import('./SSEBridge.js').SSEBridge|null}
   */
  get sse() {
    return this.sseBridge
  }

  /**
   * Get the layout components map
   * @returns {object} Layout components by type
   */
  getLayoutComponents() {
    return this.layoutComponents
  }

  /**
   * Shorthand accessor for layout components
   * @returns {object}
   */
  get layouts() {
    return this.layoutComponents
  }

  /**
   * Get the SecurityChecker instance
   * @returns {import('../entity/auth/SecurityChecker.js').SecurityChecker|null}
   */
  getSecurityChecker() {
    return this.securityChecker
  }

  /**
   * Shorthand accessor for security checker
   * Allows `kernel.security.isGranted(...)` syntax
   * @returns {import('../entity/auth/SecurityChecker.js').SecurityChecker|null}
   */
  get security() {
    return this.securityChecker
  }

  /**
   * Get the ModuleLoader instance
   * @returns {import('./ModuleLoader.js').ModuleLoader|null}
   */
  getModuleLoader() {
    return this.moduleLoader
  }

  /**
   * Shorthand accessor for module loader
   * Allows `kernel.modules.getModules()` syntax
   * @returns {import('./ModuleLoader.js').ModuleLoader|null}
   */
  get modules() {
    return this.moduleLoader
  }

  /**
   * Get the DebugModule instance if loaded
   * @returns {import('../modules/debug/DebugModule.js').DebugModule|null}
   */
  getDebugModule() {
    return this.moduleLoader?._loaded?.get('debug') ?? null
  }

  /**
   * Shorthand accessor for debug bridge
   * Allows `kernel.debugBar.toggle()` syntax
   * @returns {import('../modules/debug/DebugBridge.js').DebugBridge|null}
   */
  get debugBar() {
    const debugModule = this.getDebugModule()
    return debugModule?.getBridge?.() ?? null
  }

  /**
   * Setup an axios client with automatic auth and error handling
   *
   * Adds interceptors that:
   * - Add Authorization header with token from authAdapter
   * - Emit auth:expired on 401/403 responses (triggers auto-logout)
   * - Emit api:error on all errors for centralized handling
   *
   * Usage:
   * ```js
   * import axios from 'axios'
   *
   * const apiClient = axios.create({ baseURL: '/api' })
   * kernel.setupApiClient(apiClient)
   *
   * // Now 401/403 errors automatically trigger logout
   * const storage = new ApiStorage({ endpoint: '/users', client: apiClient })
   * ```
   *
   * Or let Kernel create the client:
   * ```js
   * const kernel = new Kernel({
   *   ...options,
   *   apiClient: { baseURL: '/api' }  // axios.create() options
   * })
   * const apiClient = kernel.getApiClient()
   * ```
   *
   * @param {object} client - Axios instance to configure
   * @returns {object} The configured axios instance
   */
  setupApiClient(client) {
    const { authAdapter } = this.options
    const signals = this.signals
    const debug = this.options.debug ?? false

    // Request interceptor: add Authorization header
    client.interceptors.request.use(
      (config) => {
        if (authAdapter?.getToken) {
          const token = authAdapter.getToken()
          if (token) {
            config.headers = config.headers || {}
            config.headers.Authorization = `Bearer ${token}`
          }
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor: handle auth errors
    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = error.response?.status
        const url = error.config?.url

        // Emit api:error for all errors
        await signals.emit('api:error', {
          status,
          message: error.message,
          url,
          error
        })

        // Emit auth:expired for 401/403
        if (status === 401 || status === 403) {
          if (debug) {
            console.warn(`[Kernel] API ${status} error on ${url}, emitting auth:expired`)
          }
          await signals.emit('auth:expired', { status, url })
        }

        return Promise.reject(error)
      }
    )

    // Store reference
    this._apiClient = client
    return client
  }

  /**
   * Get the configured API client
   * @returns {object|null} Axios instance or null if not configured
   */
  getApiClient() {
    return this._apiClient
  }

  /**
   * Shorthand accessor for API client
   * @returns {object|null}
   */
  get api() {
    return this._apiClient
  }
}
