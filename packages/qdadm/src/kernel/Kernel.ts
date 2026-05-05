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
  ref,
  type App,
  type Component,
  type Ref,
} from 'vue'
import type { Router, RouteLocationNormalized } from 'vue-router'

import type { Orchestrator } from '../orchestrator/Orchestrator'
import type { SignalBus } from './SignalBus'
import type { ZoneRegistry } from '../zones/ZoneRegistry'
import type { HookRegistry } from '../hooks/HookRegistry'
import type { SecurityChecker } from '../entity/auth/SecurityChecker'
import type { PermissionRegistry } from '../security/PermissionRegistry'
import type { ModuleLoader, ModuleLike } from './ModuleLoader'
import type { KernelContext } from './KernelContext'
import type { DeferredRegistry } from '../deferred/DeferredRegistry.js'
import type { EventRouter } from './EventRouter'
import type { SSEBridge } from './SSEBridge'
import type { ActiveStack } from '../chain/ActiveStack.js'
import type { StackHydrator } from '../chain/StackHydrator.js'
import { NotificationModule } from '../notifications/NotificationModule'
import type { NotificationStore } from '../notifications/NotificationStore'

// Import types from dedicated types file
import type {
  DebugModule,
  KernelOptions,
  InternalLayoutComponents,
  AxiosLikeClient,
} from './Kernel.types'

// Re-export public types
export type {
  AuthAdapter,
  AppConfig,
  Features,
  Pages,
  LayoutComponents,
  PrimeVueConfig,
  SecurityConfig,
  SSEConfig,
  DebugBarConfig,
  NotificationsConfig,
  HomeRoute,
  KernelOptions,
} from './Kernel.types'

// Prototype-patched method groups
import { applyAuthMethods } from './Kernel.auth'
import { applyRoutingMethods } from './Kernel.routing'
import { applyModuleMethods } from './Kernel.modules'
import { applyRegistryMethods } from './Kernel.registries'
import { setQdadmDebugBar, applyVueMethods } from './Kernel.vue'
import { applyApiMethods } from './Kernel.api'
import { applyI18nMethods } from './Kernel.i18n'
import type { I18n } from '../i18n/I18n'

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
  notificationStore: NotificationStore | null = null
  i18nInstance: I18n | null = null

  /** Pending provides from modules (applied after vueApp creation) */
  _pendingProvides: Map<string | symbol, unknown> = new Map()

  /** Pending components from modules */
  _pendingComponents: Map<string, Component> = new Map()

  /** App key for force remount on auth changes */
  _appKey: Ref<number> = ref(0)

  /** Configured API client */
  _apiClient: AxiosLikeClient | null = null

  /** Auth impersonation cleanup function */
  _authImpersonationCleanup: (() => void) | null = null

  constructor(options: KernelOptions) {
    // Auto-inject DebugModule if debugBar.module is provided
    if (options.debugBar?.module) {
      const DebugModuleClass = options.debugBar.module
      const { module: _module, component: _component, ...debugModuleOptions } = options.debugBar
      void _module // Intentionally unused - destructuring to omit
      void _component // Intentionally unused - destructuring to omit
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
      setQdadmDebugBar(options.debugBar.component || null)
      // Enable debug mode
      if (!options.debug) {
        options.debug = true
      }
    }

    // Auto-inject NotificationModule if notifications config is provided
    if (options.notifications?.enabled) {
      const notificationModule = new NotificationModule()
      options.moduleDefs = options.moduleDefs || []
      options.moduleDefs.push(notificationModule)
    }

    this.options = options
  }

  /**
   * Create and configure the Vue app
   *
   * Note: This method is synchronous for backward compatibility.
   */
  createApp(): App {
    this._resolveEntityAuthAdapter()
    this._createSignalBus()
    this._createI18n()
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
    this._createI18n()
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

  // --- Accessors ---

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
   * Get the NotificationStore instance
   */
  getNotificationStore(): NotificationStore | null {
    return this.notificationStore
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
   * I18n subsystem accessor
   */
  get i18n(): I18n | null {
    return this.i18nInstance
  }

  /**
   * Build the merged context every qdadm debug collector expects.
   *
   * Used by hosts that own a shared `DebugBridge` (passed via
   * `debugBar.bridge`) and need to install it themselves with a
   * context covering both qdadm internals and host-side data. Hosts
   * should `Object.assign({}, kernel.getDebugContext(), { … })` to
   * weave in their own keys (e.g. cms) before calling
   * `bridge.install()`.
   *
   * Returning a flat object keeps the surface stable as Kernel
   * internals evolve — the host pokes nothing.
   */
  getDebugContext(): Record<string, unknown> {
    return {
      signals: this.signals,
      router: this.router,
      orchestrator: this.orchestrator,
      zones: this.zoneRegistry,
      hooks: this.hookRegistry,
      activeStack: this.activeStack,
      stackHydrator: this.stackHydrator,
      i18n: this.i18nInstance,
    }
  }
}

// Declare prototype-patched methods
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Kernel {
  // Auth (Kernel.auth.ts)
  _resolveEntityAuthAdapter(): void
  _registerAuthDeferred(): void
  _setupAuthExpiredHandler(): void
  _setupAuthImpersonation(): void
  _setupAuthInvalidation(): void
  invalidateApp(): void

  // Routing (Kernel.routing.ts)
  _createRouter(): void
  _setupAuthGuard(): void
  _setupStackSync(): void
  _rebuildActiveStack(route: RouteLocationNormalized): void

  // Modules (Kernel.modules.ts)
  _initModules(): void
  _createModuleContext(module: ModuleLike): KernelContext
  _loadModulesSync(): void
  _loadModules(): Promise<void>
  _wireModules(): void
  _wireModulesAsync(): Promise<void>
  _fireWarmups(): void

  // i18n (Kernel.i18n.ts)
  _createI18n(): void
  _bootstrapI18n(): Promise<void>

  // Registries (Kernel.registries.ts)
  _createSignalBus(): void
  _createHookRegistry(): void
  _createOrchestrator(): void
  _createPermissionRegistry(): void
  _registerCorePermissions(): void
  _setupSecurity(): void
  _createZoneRegistry(): void
  _createActiveStack(): void
  _createStackHydrator(): void
  _createDeferredRegistry(): void
  _createEventRouter(): void
  _createSSEBridge(): void

  // Vue (Kernel.vue.ts)
  _createLayoutComponents(): void
  _createVueApp(): void
  _installPlugins(): void

  // API (Kernel.api.ts)
  setupApiClient(client: AxiosLikeClient): AxiosLikeClient
  getApiClient(): AxiosLikeClient | null
  readonly api: AxiosLikeClient | null
}

// Apply prototype patches
applyAuthMethods(Kernel)
applyRoutingMethods(Kernel)
applyModuleMethods(Kernel)
applyRegistryMethods(Kernel)
applyVueMethods(Kernel)
applyApiMethods(Kernel)
applyI18nMethods(Kernel)
