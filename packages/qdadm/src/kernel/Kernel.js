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

export class Kernel {
  /**
   * @param {object} options
   * @param {object} options.root - Root Vue component
   * @param {object} options.modules - Result of import.meta.glob for module init files
   * @param {object} options.modulesOptions - Options for initModules (e.g., { coreNavItems })
   * @param {string[]} options.sectionOrder - Navigation section order
   * @param {object} options.managers - Entity managers { name: EntityManager }
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
   */
  constructor(options) {
    this.options = options
    this.vueApp = null
    this.router = null
    this.signals = null
    this.orchestrator = null
    this.zoneRegistry = null
    this.hookRegistry = null
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
    // 2. Initialize modules (can use all services, registers routes)
    this._initModules()
    // 3. Create router (needs routes from modules)
    this._createRouter()
    // 4. Create orchestrator and remaining components
    this._createOrchestrator()
    this._setupSecurity()
    this._createLayoutComponents()
    this._createVueApp()
    this._installPlugins()
    return this.vueApp
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
        hooks: this.hookRegistry
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
   */
  _createOrchestrator() {
    this.orchestrator = new Orchestrator({
      managers: this.options.managers || {},
      signals: this.signals,
      hooks: this.hookRegistry,
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
    const { managers, authAdapter, features, primevue } = this.options

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

    // Hook registry injection
    app.provide('qdadmHooks', this.hookRegistry)

    // Layout components injection for useLayoutResolver
    app.provide('qdadmLayoutComponents', this.layoutComponents)

    // qdadm plugin
    app.use(createQdadm({
      orchestrator: this.orchestrator,
      managers,
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
}
