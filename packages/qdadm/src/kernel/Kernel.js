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
import { initModules, getRoutes, setSectionOrder } from '../module/moduleRegistry.js'
import { Orchestrator } from '../orchestrator/Orchestrator.js'

export class Kernel {
  /**
   * @param {object} options
   * @param {object} options.root - Root Vue component
   * @param {object} options.modules - Result of import.meta.glob for module init files
   * @param {object} options.modulesOptions - Options for initModules (e.g., { coreNavItems })
   * @param {string[]} options.sectionOrder - Navigation section order
   * @param {object} options.managers - Entity managers { name: EntityManager }
   * @param {object} options.authAdapter - Auth adapter for login/logout
   * @param {object} options.pages - Page components { login, layout }
   * @param {string} options.homeRoute - Route name for home redirect (or object { name, component })
   * @param {Array} options.coreRoutes - Additional routes as layout children (before module routes)
   * @param {string} options.basePath - Base path for router (e.g., '/dashboard/')
   * @param {boolean} options.hashMode - Use hash-based routing (/#/path) for static hosting
   * @param {object} options.app - App config { name, shortName, version, logo, theme }
   * @param {object} options.features - Feature toggles { auth, poweredBy }
   * @param {object} options.primevue - PrimeVue config { plugin, theme, options }
   */
  constructor(options) {
    this.options = options
    this.vueApp = null
    this.router = null
    this.orchestrator = null
  }

  /**
   * Create and configure the Vue app
   * @returns {App} Vue app instance ready to mount
   */
  createApp() {
    this._initModules()
    this._createRouter()
    this._createOrchestrator()
    this._createVueApp()
    this._installPlugins()
    return this.vueApp
  }

  /**
   * Initialize modules from glob import
   */
  _initModules() {
    if (this.options.sectionOrder) {
      setSectionOrder(this.options.sectionOrder)
    }
    if (this.options.modules) {
      initModules(this.options.modules, this.options.modulesOptions || {})
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
   * Create orchestrator with managers
   */
  _createOrchestrator() {
    this.orchestrator = new Orchestrator({
      managers: this.options.managers || {}
    })
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
}
