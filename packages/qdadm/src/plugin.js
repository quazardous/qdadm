/**
 * qdadm Vue Plugin
 *
 * Creates and configures the qdadm framework for Vue applications.
 */

import { Orchestrator } from './orchestrator/Orchestrator.js'
import qdadmLogo from './assets/logo.svg'

/**
 * Creates the qdadm plugin with the given configuration
 *
 * @param {object} options - Configuration options
 * @param {function} options.entityFactory - Factory function: (entityName, entityConfig) => EntityManager
 * @param {object} options.managers - Pre-registered managers to override defaults (e.g., { users: myUsersManager })
 * @param {object} options.orchestrator - Or provide a pre-configured Orchestrator instance
 * @param {object} options.authAdapter - Optional: Auth adapter for login/logout
 * @param {object} options.router - Required: Vue Router instance
 * @param {object} options.toast - Required: Toast notification service
 * @param {object} options.app - Optional: App branding configuration
 * @param {object} options.modules - Optional: Module system configuration
 * @param {object} options.features - Optional: Feature toggles (auth, poweredBy)
 * @param {object} options.builtinModules - Optional: Builtin modules configuration
 * @param {object} options.endpoints - Optional: API endpoints configuration
 * @param {string} options.homeRoute - Optional: Home route name for breadcrumb
 * @returns {object} Vue plugin
 */
export function createQdadm(options) {
  return {
    install(app) {
      // Validation des contrats requis
      if (!options.entityFactory && !options.orchestrator && !options.managers) {
        throw new Error('[qdadm] entityFactory, orchestrator, or managers required')
      }
      if (!options.router) {
        throw new Error('[qdadm] router required')
      }
      if (!options.toast) {
        throw new Error('[qdadm] toast required')
      }

      // Create or use provided Orchestrator
      let orchestrator = options.orchestrator
      if (!orchestrator) {
        orchestrator = new Orchestrator({
          entityFactory: options.entityFactory,
          managers: options.managers || {}
        })
      } else if (options.managers) {
        // Register additional managers on existing orchestrator
        for (const [name, manager] of Object.entries(options.managers)) {
          orchestrator.register(name, manager)
        }
      }

      // Features config avec défauts
      const features = {
        auth: true,
        poweredBy: true,
        breadcrumb: true,
        ...options.features
      }

      // App config avec défauts
      const appConfig = {
        name: 'Admin',
        shortName: 'Admin',
        logo: null,
        logoSmall: null,
        favicon: qdadmLogo,
        version: null,
        theme: {
          primary: '#3B82F6',
          surface: '#1E293B',
          ...options.app?.theme
        },
        ...options.app
      }

      // Endpoints config
      const endpoints = {
        users: '/users',
        roles: '/roles',
        ...options.endpoints
      }

      // Builtin modules config
      const builtinModules = {
        users: features.auth,
        roles: features.auth,
        ...options.builtinModules
      }

      // Validation conditionnelle
      if (features.auth && !options.authAdapter) {
        throw new Error('[qdadm] authAdapter required when features.auth is true')
      }

      // Provide all dependencies
      app.provide('qdadmOrchestrator', orchestrator)
      app.provide('qdadmRouter', options.router)
      app.provide('qdadmToast', options.toast)
      app.provide('qdadmFeatures', features)
      app.provide('qdadmApp', appConfig)
      app.provide('qdadmEndpoints', endpoints)
      app.provide('qdadmBuiltinModules', builtinModules)

      if (options.authAdapter) {
        app.provide('authAdapter', options.authAdapter)
      }

      if (options.modules?.sectionOrder) {
        app.provide('qdadmSectionOrder', options.modules.sectionOrder)
      }

      if (options.homeRoute) {
        app.provide('qdadmHomeRoute', options.homeRoute)
      }

      // Add route guard for entity permissions
      options.router.beforeEach((to, from, next) => {
        const entity = to.meta?.entity
        if (entity) {
          const manager = orchestrator.get(entity)
          if (manager && !manager.canRead()) {
            // Redirect to home or show forbidden
            console.warn(`[qdadm] Access denied to ${to.path} (entity: ${entity})`)
            return next({ path: '/' })
          }
        }
        next()
      })

      // Appliquer le thème via CSS variables
      if (appConfig.theme) {
        document.documentElement.style.setProperty('--qdadm-primary', appConfig.theme.primary)
        document.documentElement.style.setProperty('--qdadm-surface', appConfig.theme.surface)
      }

      // Appliquer le favicon
      if (appConfig.favicon) {
        const link = document.querySelector("link[rel~='icon']") || document.createElement('link')
        link.rel = 'icon'
        link.href = appConfig.favicon
        document.head.appendChild(link)
      }
    }
  }
}
