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

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'

import { createQdadm } from '../plugin.js'
import { initModules, getRoutes, setSectionOrder, alterMenuSections } from '../module/moduleRegistry.js'
import { Orchestrator } from '../orchestrator/Orchestrator.js'
import { createSignalBus } from './SignalBus.js'
import { createZoneRegistry } from '../zones/ZoneRegistry.js'
import { registerStandardZones } from '../zones/zones.js'
import { createHookRegistry } from '../hooks/HookRegistry.js'
import { createSecurityChecker } from '../entity/auth/SecurityChecker.js'
import { createManagers } from '../entity/factory.js'
import { defaultStorageResolver } from '../entity/storage/factory.js'
import { createDeferredRegistry } from '../deferred/DeferredRegistry.js'
import { createEventRouter } from './EventRouter.js'
import { createSSEBridge } from './SSEBridge.js'

export class Kernel {
  /**
   * @param {object} options
   * @param {object} options.root - Root Vue component
   * @param {object} options.modules - Result of import.meta.glob for module init files
   * @param {object} options.modulesOptions - Options for initModules (e.g., { coreNavItems })
   * @param {string[]} options.sectionOrder - Navigation section order
   * @param {object} options.managers - Entity managers { name: config } - can be instances, strings, or config objects
   * @param {object} options.managerRegistry - Registry of manager classes from qdadm-gen { name: ManagerClass }
   * @param {function} options.storageResolver - Custom storage resolver (config, entityName) => Storage
   * @param {function} options.managerResolver - Custom manager resolver (config, entityName, context) => Manager
   * @param {object} options.authAdapter - Auth adapter for login/logout (app-level authentication)
   * @param {object} options.entityAuthAdapter - Auth adapter for entity permissions (scope/silo checks)
   * @param {object} options.pages - Page components { login, layout }
   * @param {string} options.homeRoute - Route name for home redirect (or object { name, component })
   * @param {Array} options.coreRoutes - Additional routes as layout children (before module routes)
   * @param {string} options.basePath - Base path for router (e.g., '/dashboard/')
   * @param {boolean} options.hashMode - Use hash-based routing (/#/path) for static hosting
   * @param {object} options.app - App config { name, shortName, version, logo, theme }
   * @param {object} options.features - Feature toggles { auth, poweredBy }
   * @param {object} options.primevue - PrimeVue config { plugin, theme, options }
   * @param {object} options.layouts - Layout components { list, form, dashboard, base }
   * @param {object} options.security - Security config { role_hierarchy, role_permissions, entity_permissions }
   * @param {boolean} options.warmup - Enable warmup at boot (default: true)
   * @param {object} options.eventRouter - EventRouter config { 'source:signal': ['target:signal', ...] }
   * @param {object} options.sse - SSEBridge config { url, reconnectDelay, signalPrefix, autoConnect, events }
   */
  constructor(options) {
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
  }

  /**
   * Create and configure the Vue app
   * @returns {App} Vue app instance ready to mount
   */
  createApp() {
    // 1. Create services first (modules need them)
    this._createSignalBus()
    this._createHookRegistry()
    this._createZoneRegistry()
    this._createDeferredRegistry()
    // 2. Register auth:ready deferred (if auth configured)
    this._registerAuthDeferred()
    // 3. Initialize modules (can use all services, registers routes)
    this._initModules()
    // 4. Create router (needs routes from modules)
    this._createRouter()
    // 5. Setup auth:expired handler (needs router + authAdapter)
    this._setupAuthExpiredHandler()
    // 6. Create orchestrator and remaining components
    this._createOrchestrator()
    // 7. Create EventRouter (needs signals + orchestrator)
    this._createEventRouter()
    // 8. Create SSEBridge (needs signals + authAdapter for token)
    this._createSSEBridge()
    this._setupSecurity()
    this._createLayoutComponents()
    this._createVueApp()
    this._installPlugins()
    // 9. Fire warmups (fire-and-forget, pages await via DeferredRegistry)
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
   * Initialize modules from glob import
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
   * Create Vue Router with auth guard
   */
  _createRouter() {
    const { pages, homeRoute, coreRoutes, basePath, hashMode, authAdapter } = this.options

    // Validate required pages
    if (!pages?.login) {
      throw new Error('[Kernel] pages.login is required')
    }
    if (!pages?.layout) {
      throw new Error('[Kernel] pages.layout is required')
    }

    // Build home route
    let homeRouteConfig
    if (typeof homeRoute === 'object' && homeRoute.component) {
      // homeRoute is a route config with component
      homeRouteConfig = { path: '', ...homeRoute }
    } else {
      // homeRoute is a route name for redirect
      homeRouteConfig = { path: '', redirect: { name: homeRoute || 'home' } }
    }

    // Build layout children: home + coreRoutes + moduleRoutes
    const layoutChildren = [
      homeRouteConfig,
      ...(coreRoutes || []),
      ...getRoutes()
    ]

    // Build routes
    const routes = [
      {
        path: '/login',
        name: 'login',
        component: pages.login
      },
      {
        path: '/',
        component: pages.layout,
        meta: { requiresAuth: true },
        children: layoutChildren
      }
    ]

    this.router = createRouter({
      history: hashMode ? createWebHashHistory(basePath) : createWebHistory(basePath),
      routes
    })

    // Auth guard
    if (authAdapter) {
      this.router.beforeEach((to, from, next) => {
        if (to.meta.requiresAuth && !authAdapter.isAuthenticated()) {
          next({ name: 'login' })
        } else {
          next()
        }
      })
    }
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
    if (!security) return

    // Create SecurityChecker with role hierarchy and permissions
    this.securityChecker = createSecurityChecker({
      role_hierarchy: security.role_hierarchy || {},
      role_permissions: security.role_permissions || {},
      getCurrentUser: () => entityAuthAdapter?.getCurrentUser?.() || null
    })

    // Store entity_permissions config for EntityManager to use
    this.securityChecker.entityPermissions = security.entity_permissions ?? false

    // Wire SecurityChecker into entityAuthAdapter
    if (entityAuthAdapter?.setSecurityChecker) {
      entityAuthAdapter.setSecurityChecker(this.securityChecker)
    }
  }

  /**
   * Create zone registry for extensible UI composition
   * Registers standard zones during bootstrap.
   */
  _createZoneRegistry() {
    const debug = this.options.debug ?? false
    this.zoneRegistry = createZoneRegistry({ debug })
    registerStandardZones(this.zoneRegistry)
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
   */
  _createVueApp() {
    if (!this.options.root) {
      throw new Error('[Kernel] root component is required')
    }
    this.vueApp = createApp(this.options.root)
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

    // Extract home route name for breadcrumb
    const { homeRoute } = this.options
    const homeRouteName = typeof homeRoute === 'object' ? homeRoute.name : homeRoute

    // Zone registry injection
    app.provide('qdadmZoneRegistry', this.zoneRegistry)

    // Dev mode: expose zone registry on window for DevTools inspection
    if (this.options.debug && typeof window !== 'undefined') {
      window.__qdadmZones = this.zoneRegistry
      console.debug('[qdadm] Zone registry exposed on window.__qdadmZones')
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
