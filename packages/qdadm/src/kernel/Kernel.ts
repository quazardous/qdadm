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
 * ```ts
 * const kernel = new Kernel({ root: App, managers, authAdapter, ... })
 * kernel.createApp().mount('#app')
 * ```
 */

import {
  createApp,
  h,
  defineComponent,
  ref,
  type App,
  type Component,
  type Ref,
} from 'vue'
import { createPinia } from 'pinia'
import {
  createRouter,
  createWebHistory,
  createWebHashHistory,
  type Router,
  type RouteRecordRaw,
  type RouteLocationNormalized,
} from 'vue-router'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import Toast from 'primevue/toast'
import ToastListener from '../toast/ToastListener.vue'

import { createQdadm } from '../plugin.js'
import {
  initModules,
  getRoutes,
  setSectionOrder,
  registry,
} from '../module/moduleRegistry'
import { createModuleLoader, type ModuleLoader, type ModuleLike } from './ModuleLoader'
import { createKernelContext, type KernelContext } from './KernelContext'
import { Orchestrator } from '../orchestrator/Orchestrator'
import { createSignalBus, type SignalBus } from './SignalBus'
import { createZoneRegistry, type ZoneRegistry } from '../zones/ZoneRegistry'
import { registerStandardZones } from '../zones/zones'
import { createHookRegistry, type HookRegistry } from '../hooks/HookRegistry'
import { createSecurityChecker, type SecurityChecker } from '../entity/auth/SecurityChecker'
import { authFactory, CompositeAuthAdapter } from '../entity/auth'
import { PermissionRegistry } from '../security/PermissionRegistry'
import { StaticRoleGranterAdapter } from '../security/StaticRoleGranterAdapter'
import { createManagers } from '../entity/factory.js'
import { defaultStorageResolver } from '../entity/storage/factory'
import { createDeferredRegistry, type DeferredRegistry } from '../deferred/DeferredRegistry.js'
import { createEventRouter, type EventRouter, type RoutesConfig } from './EventRouter'
import { createSSEBridge, type SSEBridge } from './SSEBridge'
import { ActiveStack } from '../chain/ActiveStack.js'
import { StackHydrator } from '../chain/StackHydrator.js'
import type { EntityManager } from '../entity/EntityManager'
import type { RoleGranterAdapter } from '../security/RoleGranterAdapter'
import type { EntityAuthAdapter } from '../entity/auth/EntityAuthAdapter'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Auth adapter interface (app-level authentication)
 */
export interface AuthAdapter {
  isAuthenticated(): boolean
  getToken?(): string | null
  logout?(): void
  connectSignals?(signals: SignalBus): () => void
  [key: string]: unknown
}

/**
 * Debug module interface
 */
interface DebugModule {
  getBridge?(): unknown
  [key: string]: unknown
}

/**
 * App configuration
 */
export interface AppConfig {
  name?: string
  shortName?: string
  version?: string
  logo?: string
  theme?: string
}

/**
 * Feature toggles
 */
export interface Features {
  auth?: boolean
  poweredBy?: boolean
  [key: string]: unknown
}

/**
 * Page components
 */
export interface Pages {
  layout: Component
  shell?: Component
  login?: Component
  notFound?: Component
}

/**
 * Layout components
 */
export interface LayoutComponents {
  list?: Component | null
  form?: Component | null
  dashboard?: Component | null
  base?: Component | null
  ListLayout?: Component
  FormLayout?: Component
  DashboardLayout?: Component
  BaseLayout?: Component
}

/**
 * PrimeVue configuration
 */
export interface PrimeVueConfig {
  plugin: unknown
  theme?: unknown
  options?: Record<string, unknown>
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  role_hierarchy?: Record<string, string[]>
  role_permissions?: Record<string, string[]>
  role_labels?: Record<string, string>
  entity_permissions?: boolean | string[]
  roleGranter?: RoleGranterAdapter
}

/**
 * SSE configuration
 */
export interface SSEConfig {
  url: string
  reconnectDelay?: number
  signalPrefix?: string
  autoConnect?: boolean
  withCredentials?: boolean
  tokenParam?: string
  events?: string[]
}

/**
 * Debug bar configuration
 */
export interface DebugBarConfig {
  module?: new (options: unknown) => unknown
  component?: Component
  enabled?: boolean
  _kernelManaged?: boolean
  [key: string]: unknown
}

/**
 * Home route configuration
 */
export type HomeRoute = string | { name?: string; component?: Component }

/**
 * Kernel options
 */
export interface KernelOptions {
  root: Component
  modules?: Record<string, unknown>
  modulesOptions?: Record<string, unknown>
  moduleDefs?: unknown[]
  sectionOrder?: string[]
  managers?: Record<string, unknown>
  managerRegistry?: Record<string, new (options: unknown) => EntityManager>
  storageResolver?: (config: unknown, entityName: string) => unknown
  managerResolver?: (config: unknown, entityName: string, context: unknown) => EntityManager
  authAdapter?: AuthAdapter | null
  entityAuthAdapter?: EntityAuthAdapter | string | Record<string, unknown> | null
  authTypes?: Record<string, unknown>
  pages?: Pages
  homeRoute?: HomeRoute
  coreRoutes?: RouteRecordRaw[]
  basePath?: string
  hashMode?: boolean
  app?: AppConfig
  features?: Features
  primevue?: PrimeVueConfig
  layouts?: LayoutComponents
  security?: SecurityConfig
  warmup?: boolean
  eventRouter?: RoutesConfig
  sse?: SSEConfig
  debugBar?: DebugBarConfig
  toast?: Record<string, unknown>
  debug?: boolean
  onAuthExpired?: (payload: unknown) => void
}

// Debug imports are dynamic to enable tree-shaking in production
let QdadmDebugBar: Component | null = null

/**
 * Internal layout components type
 */
interface InternalLayoutComponents {
  list: Component | null
  form: Component | null
  dashboard: Component | null
  base: Component | null
}

/**
 * Axios-like client interface
 */
interface AxiosLikeClient {
  interceptors: {
    request: {
      use(
        onFulfilled: (config: AxiosRequestConfig) => AxiosRequestConfig,
        onRejected: (error: unknown) => Promise<unknown>
      ): void
    }
    response: {
      use(
        onFulfilled: (response: unknown) => unknown,
        onRejected: (error: unknown) => Promise<unknown>
      ): void
    }
  }
}

interface AxiosRequestConfig {
  headers?: Record<string, string>
  url?: string
  [key: string]: unknown
}

interface AxiosError {
  response?: { status: number }
  config?: { url?: string }
  message: string
}

export class Kernel {
  options: KernelOptions
  vueApp: App | null = null
  router: Router | null = null
  signals: SignalBus | null = null
  orchestrator: Orchestrator | null = null
  zoneRegistry: ZoneRegistry | null = null
  hookRegistry: HookRegistry | null = null
  deferred: DeferredRegistry | null = null
  eventRouter: EventRouter | null = null
  sseBridge: SSEBridge | null = null
  layoutComponents: InternalLayoutComponents | null = null
  securityChecker: SecurityChecker | null = null
  permissionRegistry: PermissionRegistry | null = null
  moduleLoader: ModuleLoader | null = null
  activeStack: ActiveStack | null = null
  stackHydrator: StackHydrator | null = null

  /** Pending provides from modules (applied after vueApp creation) */
  _pendingProvides: Map<string | symbol, unknown> = new Map()

  /** Pending components from modules */
  _pendingComponents: Map<string, Component> = new Map()

  /** App key for force remount on auth changes */
  _appKey: Ref<number> = ref(0)

  /** Configured API client */
  private _apiClient: AxiosLikeClient | null = null

  /** Auth impersonation cleanup function */
  private _authImpersonationCleanup: (() => void) | null = null

  constructor(options: KernelOptions) {
    // Auto-inject DebugModule if debugBar.module is provided
    if (options.debugBar?.module) {
      const DebugModuleClass = options.debugBar.module
      const { module: _, component: __, ...debugModuleOptions } = options.debugBar
      // Enable by default when using debugBar shorthand
      if (debugModuleOptions.enabled === undefined) {
        debugModuleOptions.enabled = true
      }
      // Mark as kernel-managed to prevent zone block registration
      debugModuleOptions._kernelManaged = true
      const debugModule = new DebugModuleClass(debugModuleOptions)
      options.moduleDefs = options.moduleDefs || []
      options.moduleDefs.push(debugModule)
      // Store component for root wrapper
      QdadmDebugBar = options.debugBar.component || null
      // Enable debug mode
      if (!options.debug) {
        options.debug = true
      }
    }

    this.options = options
  }

  /**
   * Resolve entityAuthAdapter through authFactory
   */
  private _resolveEntityAuthAdapter(): void {
    const { entityAuthAdapter, authTypes } = this.options

    if (entityAuthAdapter == null) return

    const context = {
      authTypes: authTypes || {},
      CompositeAuthAdapter,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.options.entityAuthAdapter = authFactory(entityAuthAdapter, context as any)
  }

  /**
   * Create and configure the Vue app
   *
   * Note: This method is synchronous for backward compatibility.
   */
  createApp(): App {
    this._resolveEntityAuthAdapter()
    this._createSignalBus()
    this._createHookRegistry()
    this._createZoneRegistry()
    this._createActiveStack()
    this._createDeferredRegistry()
    this._createOrchestrator()
    this._createStackHydrator()
    this._createPermissionRegistry()
    this._setupSecurity()
    this._registerAuthDeferred()
    this._initModules()
    this._loadModulesSync()
    this._createRouter()
    this._setupStackSync()
    this._setupAuthGuard()
    this._setupAuthExpiredHandler()
    this._setupAuthImpersonation()
    this._setupAuthInvalidation()
    this._wireModules()
    this._createEventRouter()
    this._createSSEBridge()
    this._createLayoutComponents()
    this._createVueApp()
    this._installPlugins()
    this._fireWarmups()
    return this.vueApp!
  }

  /**
   * Create and configure the Vue app asynchronously
   */
  async createAppAsync(): Promise<App> {
    this._resolveEntityAuthAdapter()
    this._createSignalBus()
    this._createHookRegistry()
    this._createZoneRegistry()
    this._createActiveStack()
    this._createDeferredRegistry()
    this._createOrchestrator()
    this._createStackHydrator()
    this._createPermissionRegistry()
    this._setupSecurity()
    this._registerAuthDeferred()
    this._initModules()
    await this._loadModules()
    this._createRouter()
    this._setupStackSync()
    this._setupAuthGuard()
    this._setupAuthExpiredHandler()
    this._setupAuthImpersonation()
    this._setupAuthInvalidation()
    await this._wireModulesAsync()
    this._createEventRouter()
    this._createSSEBridge()
    this._createLayoutComponents()
    this._createVueApp()
    this._installPlugins()
    this._fireWarmups()
    return this.vueApp!
  }

  /**
   * Register auth:ready deferred if auth is configured
   */
  private _registerAuthDeferred(): void {
    const { authAdapter } = this.options
    if (!authAdapter) return

    this.deferred!.queue('auth:ready', () => {
      return new Promise((resolve) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.signals!.once('auth:login', (event: any) => {
          resolve(event.data?.user)
        })
      })
    })
  }

  /**
   * Setup handler for auth:expired signal
   */
  private _setupAuthExpiredHandler(): void {
    const { authAdapter, onAuthExpired } = this.options
    if (!authAdapter) return

    this.signals!.on('auth:expired', async (payload: { data: unknown }) => {
      const debug = this.options.debug ?? false
      if (debug) {
        console.warn('[Kernel] auth:expired received:', payload)
      }

      if (authAdapter.logout) {
        authAdapter.logout()
      }

      const payloadData = typeof payload.data === 'object' && payload.data !== null ? payload.data : {}
      await this.signals!.emit('auth:logout', { reason: 'expired', ...payloadData })

      if (this.router!.currentRoute.value.name !== 'login') {
        this.router!.push({ name: 'login', query: { expired: '1' } })
      }

      if (onAuthExpired) {
        onAuthExpired(payload)
      }
    })
  }

  /**
   * Setup authAdapter to react to impersonation signals
   */
  private _setupAuthImpersonation(): void {
    const { authAdapter } = this.options
    if (!authAdapter?.connectSignals) return

    const debug = this.options.debug ?? false
    if (debug) {
      console.debug('[Kernel] Wiring authAdapter.connectSignals() for impersonation')
    }

    this._authImpersonationCleanup = authAdapter.connectSignals(this.signals!)
  }

  /**
   * Setup auth invalidation - remount entire app on auth changes
   */
  private _setupAuthInvalidation(): void {
    const debug = this.options.debug ?? false
    const authSignals = [
      'auth:login',
      'auth:logout',
      'auth:impersonate',
      'auth:impersonate:stop',
    ]

    for (const signal of authSignals) {
      this.signals!.on(signal, () => {
        if (debug) {
          console.debug(`[Kernel] ${signal} → invalidateApp()`)
        }
        this.invalidateApp()
      })
    }
  }

  /**
   * Force full app remount
   */
  invalidateApp(): void {
    this._appKey.value++
  }

  /**
   * Fire entity cache warmups
   */
  private _fireWarmups(): void {
    const warmup = this.options.warmup ?? true
    if (!warmup) return

    this.orchestrator!.fireWarmups()
  }

  /**
   * Initialize legacy modules from glob import
   */
  private _initModules(): void {
    if (this.options.sectionOrder) {
      setSectionOrder(this.options.sectionOrder)
    }
    if (this.options.modules) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initModules(this.options.modules as any, {
        ...this.options.modulesOptions,
        zones: this.zoneRegistry,
        signals: this.signals,
        hooks: this.hookRegistry,
        deferred: this.deferred,
      } as any)
    }
  }

  /**
   * Create KernelContext for module connection
   */
  private _createModuleContext(module: ModuleLike): KernelContext {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createKernelContext(this as any, module as any)
  }

  /**
   * Load new-style modules synchronously
   */
  private _loadModulesSync(): void {
    const { moduleDefs } = this.options
    if (!moduleDefs?.length) return

    this.moduleLoader = createModuleLoader()

    for (const mod of moduleDefs) {
      this.moduleLoader.add(mod as ModuleLike)
    }

    // Access private method for sorting
    const sorted = (this.moduleLoader as unknown as { _topologicalSort(): string[] })._topologicalSort()
    const registered = (this.moduleLoader as unknown as { _registered: Map<string, ModuleLike> })._registered
    const loaded = (this.moduleLoader as unknown as { _loaded: Map<string, ModuleLike> })._loaded
    const loadOrder = (this.moduleLoader as unknown as { _loadOrder: string[] })._loadOrder

    for (const name of sorted) {
      const module = registered.get(name)
      if (!module) continue

      const ctx = this._createModuleContext(module)

      if (!module.enabled(ctx as unknown as Parameters<typeof module.enabled>[0])) {
        continue
      }

      if (typeof module.loadStyles === 'function') {
        const styleResult = module.loadStyles()
        if (styleResult instanceof Promise) {
          styleResult.catch((err) => {
            console.warn(`[Kernel] Module '${name}' styles failed:`, err)
          })
        }
      }

      const result = module.connect(ctx as unknown as Parameters<typeof module.connect>[0])

      if (result instanceof Promise) {
        result.catch((err) => {
          console.error(`[Kernel] Async module '${name}' failed:`, err)
        })
      }

      loaded.set(name, module)
      loadOrder.push(name)
    }
  }

  /**
   * Load new-style modules asynchronously
   */
  private async _loadModules(): Promise<void> {
    const { moduleDefs } = this.options
    if (!moduleDefs?.length) return

    this.moduleLoader = createModuleLoader()

    for (const mod of moduleDefs) {
      this.moduleLoader.add(mod as ModuleLike)
    }

    const sorted = (this.moduleLoader as unknown as { _topologicalSort(): string[] })._topologicalSort()
    const registered = (this.moduleLoader as unknown as { _registered: Map<string, ModuleLike> })._registered
    const loaded = (this.moduleLoader as unknown as { _loaded: Map<string, ModuleLike> })._loaded
    const loadOrder = (this.moduleLoader as unknown as { _loadOrder: string[] })._loadOrder

    for (const name of sorted) {
      const module = registered.get(name)
      if (!module) continue

      const ctx = this._createModuleContext(module)

      if (!module.enabled(ctx as unknown as Parameters<typeof module.enabled>[0])) {
        continue
      }

      if (typeof module.loadStyles === 'function') {
        await module.loadStyles()
      }

      await module.connect(ctx as unknown as Parameters<typeof module.connect>[0])

      loaded.set(name, module)
      loadOrder.push(name)
    }
  }

  /**
   * Wire modules that need orchestrator (phase 2)
   */
  private _wireModules(): void {
    if (!this.moduleLoader) return

    const result = this.signals!.emit('kernel:ready', { ready: true })

    if (result instanceof Promise) {
      result.catch((err) => {
        console.error('[Kernel] kernel:ready handler failed:', err)
      })
    }
  }

  /**
   * Wire modules that need orchestrator (phase 2) - async version
   */
  private async _wireModulesAsync(): Promise<void> {
    if (!this.moduleLoader) return

    await this.signals!.emit('kernel:ready', { ready: true })
  }

  /**
   * Create Vue Router
   */
  private _createRouter(): void {
    const { pages, homeRoute, coreRoutes, basePath } = this.options

    if (!pages?.layout) {
      throw new Error('[Kernel] pages.layout is required')
    }

    let homeRouteConfig: RouteRecordRaw
    if (typeof homeRoute === 'object' && homeRoute?.component) {
      homeRouteConfig = {
        path: '',
        name: homeRoute.name || '_home',
        component: homeRoute.component,
      }
    } else {
      homeRouteConfig = {
        path: '',
        name: '_home',
        redirect: { name: (homeRoute as string) || 'home' },
      }
    }

    const moduleRoutes = getRoutes() as RouteRecordRaw[]

    const publicRoutes = moduleRoutes.filter(
      (r) => r.meta?.public || r.meta?.requiresAuth === false
    )
    const protectedRoutes = moduleRoutes.filter(
      (r) => !r.meta?.public && r.meta?.requiresAuth !== false
    )

    if (pages.login) {
      publicRoutes.unshift({
        path: '/login',
        name: 'login',
        component: pages.login,
        meta: { public: true },
      })
    }

    const layoutChildren: RouteRecordRaw[] = [
      homeRouteConfig,
      ...(coreRoutes || []),
      ...protectedRoutes,
    ]

    let routes: RouteRecordRaw[]

    if (pages.shell) {
      routes = [
        {
          path: '/',
          name: '_shell',
          component: pages.shell,
          children: [
            ...publicRoutes,
            {
              path: '',
              name: '_layout',
              component: pages.layout,
              meta: { requiresAuth: true },
              children: layoutChildren,
            },
          ],
        },
      ]
    } else {
      routes = [
        ...publicRoutes,
        {
          path: '/',
          name: '_layout',
          component: pages.layout,
          meta: { requiresAuth: true },
          children: layoutChildren,
        },
      ]
    }

    const notFoundComponent =
      pages.notFound || (() => import('../components/pages/NotFoundPage.vue'))
    const notFoundRoute: RouteRecordRaw = {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: notFoundComponent,
      meta: { public: true },
    }

    routes.push(notFoundRoute)

    const { hashMode } = this.options
    const history = hashMode
      ? createWebHashHistory(basePath)
      : createWebHistory(basePath)

    this.router = createRouter({
      history,
      routes,
    })
  }

  /**
   * Setup auth guard on router
   */
  private _setupAuthGuard(): void {
    const { authAdapter } = this.options
    if (!authAdapter) return

    let wasEverAuthenticated = authAdapter.isAuthenticated()

    const debug = this.options.debug ?? false
    this.signals!.on('auth:session-lost', () => {
      if (debug) {
        console.warn('[Kernel] auth:session-lost received, emitting toast:warn')
      }
      this.orchestrator!.toast.warn(
        'Session lost',
        'Your session has expired. Please log in again.',
        'Kernel'
      )
    })

    this.router!.beforeEach((to, _from, next) => {
      if (authAdapter.isAuthenticated()) {
        wasEverAuthenticated = true
      }

      const isPublic = to.matched.some(
        (record) =>
          record.meta.public === true || record.meta.requiresAuth === false
      )

      if (isPublic) {
        next()
        return
      }

      const requiresAuth = to.matched.some(
        (record) => record.meta.requiresAuth === true
      )

      if (requiresAuth && !authAdapter.isAuthenticated()) {
        if (wasEverAuthenticated) {
          const debug = this.options.debug ?? false
          if (debug) {
            console.warn(
              '[Kernel] Session lost detected, emitting auth:session-lost'
            )
          }
          this.signals!.emit('auth:session-lost', {
            reason: 'token_missing',
            redirectTo: 'login',
          })
          wasEverAuthenticated = false
        }

        const loginRoute = this.router!.hasRoute('login')
          ? { name: 'login', query: { session_lost: '1' } }
          : '/'
        next(loginRoute)
        return
      }

      const entity = to.meta?.entity as string | undefined
      if (entity && this.orchestrator) {
        try {
          const manager = this.orchestrator.get(entity)
          if (manager && !manager.canRead()) {
            console.warn(
              `[qdadm] Access denied to ${to.path} (entity: ${entity})`
            )
            this.orchestrator.toast.error(
              'Access Denied',
              `You don't have permission to access ${manager.labelPlural || entity}`,
              'Kernel'
            )
            this.signals!.emit('auth:access-denied', {
              path: to.path,
              entity,
              manager,
            })
            next({ path: '/' })
            return
          }
        } catch {
          // Entity not registered - allow navigation
        }
      }

      next()
    })
  }

  /**
   * Setup activeStack synchronization with router
   */
  private _setupStackSync(): void {
    this.router!.afterEach((to) => {
      this._rebuildActiveStack(to)
    })
  }

  /**
   * Rebuild activeStack from route
   */
  private _rebuildActiveStack(route: RouteLocationNormalized): void {
    const entityConfig = route.meta?.entity as string | undefined
    if (!entityConfig) {
      this.activeStack!.clear()
      return
    }

    interface StackLevel {
      entity: string
      param: string
      foreignKey: string | null
      id: string | null
    }

    const levels: StackLevel[] = []

    interface ParentMeta {
      entity: string
      param: string
      foreignKey?: string
      parent?: ParentMeta
    }

    let parentConfig = route.meta?.parent as ParentMeta | undefined
    while (parentConfig) {
      const id = (route.params[parentConfig.param] as string) ?? null
      levels.unshift({
        entity: parentConfig.entity,
        param: parentConfig.param,
        foreignKey: null,
        id,
      })
      parentConfig = parentConfig.parent ?? undefined
    }

    const manager = this.orchestrator?.get(entityConfig)
    const idField = manager?.idField ?? 'id'
    const currentId = (route.params[idField] as string) ?? null
    const currentForeignKey =
      (route.meta?.parent as ParentMeta | undefined)?.foreignKey ?? null

    if (currentId) {
      levels.push({
        entity: entityConfig,
        param: idField,
        foreignKey: currentForeignKey,
        id: currentId,
      })
    }

    this.activeStack!.set(levels)
  }

  /**
   * Create signal bus for event-driven communication
   */
  private _createSignalBus(): void {
    const debug = this.options.debug ?? false
    this.signals = createSignalBus({ debug })
  }

  /**
   * Create hook registry for Drupal-inspired extensibility
   */
  private _createHookRegistry(): void {
    const debug = this.options.debug ?? false
    this.hookRegistry = createHookRegistry({
      kernel: this.signals!.getKernel(),
      debug,
    })
  }

  /**
   * Create orchestrator with managers and signal bus
   */
  private _createOrchestrator(): void {
    const factoryContext = {
      storageResolver: this.options.storageResolver || defaultStorageResolver,
      managerResolver: this.options.managerResolver,
      managerRegistry: this.options.managerRegistry || {},
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const managers = createManagers(this.options.managers || {}, factoryContext) as any

    this.orchestrator = new Orchestrator({
      managers,
      signals: this.signals,
      hooks: this.hookRegistry,
      deferred: this.deferred,
      entityAuthAdapter: (this.options.entityAuthAdapter as EntityAuthAdapter) || null,
    })

    if (this.options.toast) {
      this.orchestrator.setToastConfig(this.options.toast)
    }
  }

  /**
   * Create PermissionRegistry early so modules can register permissions
   */
  private _createPermissionRegistry(): void {
    this.permissionRegistry = new PermissionRegistry()
    this._registerCorePermissions()
  }

  /**
   * Register core system permissions provided by the framework
   */
  private _registerCorePermissions(): void {
    this.permissionRegistry!.register('auth', {
      impersonate: 'Impersonate other users',
      manage: 'Manage authentication settings',
    })

    this.permissionRegistry!.register('admin', {
      access: 'Access admin panel',
      config: 'Edit system configuration',
    })
  }

  /**
   * Setup security layer (role hierarchy, permissions)
   */
  private _setupSecurity(): void {
    const { security, entityAuthAdapter } = this.options

    if (!this.permissionRegistry) {
      this.permissionRegistry = new PermissionRegistry()
    }

    if (!security) return

    let roleGranter = security.roleGranter
    if (!roleGranter && (security.role_permissions || security.role_hierarchy)) {
      roleGranter = new StaticRoleGranterAdapter({
        role_hierarchy: security.role_hierarchy || {},
        role_permissions: security.role_permissions || {},
        role_labels: security.role_labels || {},
      })
    }

    this.securityChecker = createSecurityChecker({
      roleGranter: roleGranter || undefined,
      getCurrentUser: () =>
        (entityAuthAdapter as EntityAuthAdapter | null)?.getCurrentUser?.() || null,
    })

    // Store entity_permissions config (augment securityChecker for EntityManager to use)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(this.securityChecker as any).entityPermissions = security.entity_permissions ?? false

    const adapter = entityAuthAdapter as EntityAuthAdapter | null
    if (adapter?.setSecurityChecker) {
      adapter.setSecurityChecker(this.securityChecker)
    }

    if (roleGranter?.install) {
      const ctx = {
        orchestrator: this.orchestrator,
        signals: this.signals,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      roleGranter.install(ctx as any)
    }
  }

  /**
   * Create zone registry for extensible UI composition
   */
  private _createZoneRegistry(): void {
    const debug = this.options.debug ?? false
    this.zoneRegistry = createZoneRegistry({ debug })
  }

  /**
   * Create active stack for navigation state
   */
  private _createActiveStack(): void {
    this.activeStack = new ActiveStack(this.signals!)
  }

  /**
   * Create stack hydrator for async data loading
   */
  private _createStackHydrator(): void {
    this.stackHydrator = new StackHydrator(
      this.activeStack!,
      this.orchestrator!,
      this.signals!
    )
  }

  /**
   * Create deferred registry for async service loading
   */
  private _createDeferredRegistry(): void {
    const debug = this.options.debug ?? false
    this.deferred = createDeferredRegistry({
      kernel: this.signals?.getKernel() || null,
      debug,
    })
  }

  /**
   * Create EventRouter for declarative signal routing
   */
  private _createEventRouter(): void {
    const { eventRouter: routes } = this.options
    if (!routes || Object.keys(routes).length === 0) return

    const debug = this.options.debug ?? false
    this.eventRouter = createEventRouter({
      signals: this.signals!,
      orchestrator: this.orchestrator,
      routes,
      debug,
    })
  }

  /**
   * Create SSEBridge for Server-Sent Events to SignalBus integration
   */
  private _createSSEBridge(): void {
    const { sse, authAdapter } = this.options
    if (!sse?.url) return

    const debug = this.options.debug ?? false

    const getToken = authAdapter?.getToken
      ? () => authAdapter.getToken!()
      : () => localStorage.getItem('auth_token')

    this.sseBridge = createSSEBridge({
      signals: this.signals!,
      url: sse.url,
      reconnectDelay: sse.reconnectDelay ?? 5000,
      signalPrefix: sse.signalPrefix ?? 'sse',
      autoConnect: sse.autoConnect ?? false,
      withCredentials: sse.withCredentials ?? false,
      tokenParam: sse.tokenParam ?? 'token',
      getToken,
      debug,
    })

    if (sse.events?.length) {
      this.signals!.once('sse:connected', () => {
        this.sseBridge!.registerEvents(sse.events!)
      })
    }
  }

  /**
   * Create layout components map for useLayoutResolver
   */
  private _createLayoutComponents(): void {
    const layouts = this.options.layouts || {}
    this.layoutComponents = {
      list: layouts.list || layouts.ListLayout || null,
      form: layouts.form || layouts.FormLayout || null,
      dashboard: layouts.dashboard || layouts.DashboardLayout || null,
      base: layouts.base || layouts.BaseLayout || null,
    }
  }

  /**
   * Create Vue app instance
   */
  private _createVueApp(): void {
    if (!this.options.root) {
      throw new Error('[Kernel] root component is required')
    }

    const OriginalRoot = this.options.root
    const DebugBarComponent =
      this.options.debugBar?.component && QdadmDebugBar ? QdadmDebugBar : null
    const hasPrimeVue = !!this.options.primevue?.plugin
    const appKey = this._appKey

    const WrappedRoot = defineComponent({
      name: 'QdadmRootWrapper',
      setup() {
        return () => {
          const children = [h(OriginalRoot, { key: appKey.value })]

          if (hasPrimeVue) {
            children.push(h(Toast))
            children.push(h(ToastListener))
          }

          if (DebugBarComponent) {
            children.push(h(DebugBarComponent))
          }

          return h(
            'div',
            { id: 'qdadm-root', style: 'display: contents' },
            children
          )
        }
      },
    })

    this.vueApp = createApp(WrappedRoot)
  }

  /**
   * Install all plugins on Vue app
   */
  private _installPlugins(): void {
    const app = this.vueApp!
    const { authAdapter, features, primevue } = this.options

    app.use(createPinia())

    if (primevue?.plugin) {
      const pvConfig = {
        theme: {
          preset: primevue.theme,
          options: {
            darkModeSelector: '.dark-mode',
            ...primevue.options,
          },
        },
      }
      app.use(primevue.plugin as { install: (app: App, options: unknown) => void }, pvConfig)
      app.use(ToastService)
      app.use(ConfirmationService)
      app.directive('tooltip', Tooltip)
    }

    app.use(this.router!)

    for (const [key, value] of this._pendingProvides) {
      app.provide(key, value)
    }
    this._pendingProvides.clear()

    for (const [name, component] of this._pendingComponents) {
      app.component(name, component)
    }
    this._pendingComponents.clear()

    const { homeRoute } = this.options
    const homeRouteName =
      typeof homeRoute === 'object' ? homeRoute?.name : homeRoute

    app.provide('qdadmZoneRegistry', this.zoneRegistry)
    app.provide('qdadmActiveStack', this.activeStack)
    app.provide('qdadmStackHydrator', this.stackHydrator)

    if (this.options.debug && typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__qdadm = {
        kernel: this,
        orchestrator: this.orchestrator,
        signals: this.signals,
        hooks: this.hookRegistry,
        zones: this.zoneRegistry,
        activeStack: this.activeStack,
        stackHydrator: this.stackHydrator,
        deferred: this.deferred,
        router: this.router,
        get: (name: string) => this.orchestrator!.get(name),
        managers: () => this.orchestrator!.getRegisteredNames(),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__qdadmZones = this.zoneRegistry
      console.debug(
        '[qdadm] Debug mode: window.__qdadm exposed (orchestrator, signals, hooks, zones, deferred, router)'
      )
    }

    app.provide('qdadmSignals', this.signals)

    if (this.sseBridge) {
      app.provide('qdadmSSEBridge', this.sseBridge)
    }

    app.provide('qdadmHooks', this.hookRegistry)
    app.provide('qdadmDeferred', this.deferred)
    app.provide('qdadmLayoutComponents', this.layoutComponents)

    if (this.securityChecker) {
      app.provide('qdadmSecurityChecker', this.securityChecker)
    }
    if (this.permissionRegistry) {
      app.provide('qdadmPermissionRegistry', this.permissionRegistry)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qdadmOptions: any = {
      orchestrator: this.orchestrator,
      authAdapter,
      router: this.router,
      toast: app.config.globalProperties.$toast,
      app: this.options.app,
      homeRoute: homeRouteName,
      features: {
        auth: !!authAdapter,
        poweredBy: true,
        ...features,
      },
    }
    app.use(createQdadm(qdadmOptions) as unknown as { install: (app: App) => void })
  }

  /**
   * Get the Vue Router instance
   */
  getRouter(): Router | null {
    return this.router
  }

  /**
   * Get the Vue app instance
   */
  getApp(): App | null {
    return this.vueApp
  }

  /**
   * Get the Orchestrator instance
   */
  getOrchestrator(): Orchestrator | null {
    return this.orchestrator
  }

  /**
   * Get the SignalBus instance
   */
  getSignals(): SignalBus | null {
    return this.signals
  }

  /**
   * Get the ZoneRegistry instance
   */
  getZoneRegistry(): ZoneRegistry | null {
    return this.zoneRegistry
  }

  /**
   * Get the HookRegistry instance
   */
  getHookRegistry(): HookRegistry | null {
    return this.hookRegistry
  }

  /**
   * Shorthand accessor for hook registry
   */
  get hooks(): HookRegistry | null {
    return this.hookRegistry
  }

  /**
   * Get the DeferredRegistry instance
   */
  getDeferredRegistry(): DeferredRegistry | null {
    return this.deferred
  }

  /**
   * Get the EventRouter instance
   */
  getEventRouter(): EventRouter | null {
    return this.eventRouter
  }

  /**
   * Get the SSEBridge instance
   */
  getSSEBridge(): SSEBridge | null {
    return this.sseBridge
  }

  /**
   * Shorthand accessor for SSE bridge
   */
  get sse(): SSEBridge | null {
    return this.sseBridge
  }

  /**
   * Get the layout components map
   */
  getLayoutComponents(): InternalLayoutComponents | null {
    return this.layoutComponents
  }

  /**
   * Shorthand accessor for layout components
   */
  get layouts(): InternalLayoutComponents | null {
    return this.layoutComponents
  }

  /**
   * Get the SecurityChecker instance
   */
  getSecurityChecker(): SecurityChecker | null {
    return this.securityChecker
  }

  /**
   * Shorthand accessor for security checker
   */
  get security(): SecurityChecker | null {
    return this.securityChecker
  }

  /**
   * Get the ModuleLoader instance
   */
  getModuleLoader(): ModuleLoader | null {
    return this.moduleLoader
  }

  /**
   * Shorthand accessor for module loader
   */
  get modules(): ModuleLoader | null {
    return this.moduleLoader
  }

  /**
   * Get the DebugModule instance if loaded
   */
  getDebugModule(): DebugModule | null {
    const loaded = (this.moduleLoader as unknown as { _loaded?: Map<string, unknown> })?._loaded
    return (loaded?.get('debug') as DebugModule) ?? null
  }

  /**
   * Shorthand accessor for debug bridge
   */
  get debugBar(): unknown {
    const debugModule = this.getDebugModule()
    return debugModule?.getBridge?.() ?? null
  }

  /**
   * Setup an axios client with automatic auth and error handling
   */
  setupApiClient(client: AxiosLikeClient): AxiosLikeClient {
    const { authAdapter } = this.options
    const signals = this.signals!
    const debug = this.options.debug ?? false

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

    client.interceptors.response.use(
      (response) => response,
      async (error: unknown) => {
        const axiosError = error as AxiosError
        const status = axiosError.response?.status
        const url = axiosError.config?.url

        await signals.emit('api:error', {
          status,
          message: axiosError.message,
          url,
          error: axiosError,
        })

        if (status === 401 || status === 403) {
          if (debug) {
            console.warn(
              `[Kernel] API ${status} error on ${url}, emitting auth:expired`
            )
          }
          await signals.emit('auth:expired', { status, url })
        }

        return Promise.reject(error)
      }
    )

    this._apiClient = client
    return client
  }

  /**
   * Get the configured API client
   */
  getApiClient(): AxiosLikeClient | null {
    return this._apiClient
  }

  /**
   * Shorthand accessor for API client
   */
  get api(): AxiosLikeClient | null {
    return this._apiClient
  }
}
