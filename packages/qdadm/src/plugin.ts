/**
 * qdadm Vue Plugin
 *
 * Creates and configures the qdadm framework for Vue applications.
 */

import type { App } from 'vue'
import type { Router, RouteLocationNormalized, NavigationGuardNext } from 'vue-router'
import { Orchestrator } from './orchestrator/Orchestrator'
import { EntityManager } from './entity/EntityManager'
import qdadmLogo from './assets/logo.svg'

/**
 * Toast service interface
 */
export interface ToastService {
  add: (options: {
    severity: string
    summary: string
    detail: string
    life?: number
  }) => void
}

/**
 * Auth adapter interface
 */
export interface AuthAdapter {
  login?: (credentials: unknown) => Promise<unknown>
  logout?: () => void | Promise<void>
  isAuthenticated?: () => boolean
  getUser?: () => unknown
  [key: string]: unknown
}

/**
 * App theme configuration
 */
export interface AppTheme {
  primary?: string
  surface?: string
  [key: string]: string | undefined
}

/**
 * App configuration
 */
export interface AppConfig {
  name?: string
  shortName?: string
  logo?: string | null
  logoSmall?: string | null
  favicon?: string | null
  version?: string | null
  theme?: AppTheme
  [key: string]: unknown
}

/**
 * Features configuration
 */
export interface FeaturesConfig {
  auth?: boolean
  poweredBy?: boolean
  breadcrumb?: boolean
  [key: string]: boolean | undefined
}

/**
 * Module system configuration
 */
export interface ModulesConfig {
  sectionOrder?: string[]
  [key: string]: unknown
}

/**
 * qdadm plugin options
 */
export interface QdadmOptions {
  entityFactory?: (entityName: string, entityConfig: unknown) => EntityManager
  managers?: Record<string, EntityManager>
  orchestrator?: Orchestrator
  authAdapter?: AuthAdapter
  router: Router
  toast: ToastService
  app?: AppConfig
  modules?: ModulesConfig
  features?: FeaturesConfig
  builtinModules?: Record<string, boolean>
  endpoints?: Record<string, string>
  homeRoute?: string
}

/**
 * Vue plugin interface
 */
export interface QdadmPlugin {
  install: (app: App) => void
}

/**
 * Creates the qdadm plugin with the given configuration
 */
export function createQdadm(options: QdadmOptions): QdadmPlugin {
  return {
    install(app: App) {
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
      const features: FeaturesConfig = {
        auth: true,
        poweredBy: true,
        breadcrumb: true,
        ...options.features
      }

      // App config avec défauts
      const appConfig: AppConfig = {
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
      const endpoints: Record<string, string> = {
        users: '/users',
        roles: '/roles',
        ...options.endpoints
      }

      // Builtin modules config
      const builtinModules: Record<string, boolean> = {
        users: features.auth || false,
        roles: features.auth || false,
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
      options.router.beforeEach((
        to: RouteLocationNormalized,
        _from: RouteLocationNormalized,
        next: NavigationGuardNext
      ) => {
        const entity = to.meta?.entity as string | undefined
        if (entity && orchestrator) {
          const manager = orchestrator.get(entity) as EntityManager & { canRead?: () => boolean }
          if (manager && manager.canRead && !manager.canRead()) {
            // Show visible error via toast
            console.warn(`[qdadm] Access denied to ${to.path} (entity: ${entity})`)
            options.toast.add({
              severity: 'error',
              summary: 'Access Denied',
              detail: `You don't have permission to access ${manager.labelPlural || entity}`,
              life: 5000
            })
            // Emit signal if orchestrator has signals configured
            if (orchestrator.signals) {
              orchestrator.signals.emit('auth:access-denied', {
                path: to.path,
                entity,
                manager
              })
            }
            return next({ path: '/' })
          }
        }
        next()
      })

      // Appliquer le thème via CSS variables
      if (appConfig.theme) {
        if (appConfig.theme.primary) {
          document.documentElement.style.setProperty('--qdadm-primary', appConfig.theme.primary)
        }
        if (appConfig.theme.surface) {
          document.documentElement.style.setProperty('--qdadm-surface', appConfig.theme.surface)
        }
      }

      // Appliquer le favicon
      if (appConfig.favicon) {
        const existingLink = document.querySelector("link[rel~='icon']")
        const link = existingLink || document.createElement('link')
        link.setAttribute('rel', 'icon')
        link.setAttribute('href', appConfig.favicon)
        if (!existingLink) {
          document.head.appendChild(link)
        }
      }
    }
  }
}
