import { createSignalBus } from './SignalBus'
import { createZoneRegistry } from '../zones/ZoneRegistry'
import { createHookRegistry } from '../hooks/HookRegistry'
import { createSecurityChecker } from '../entity/auth/SecurityChecker'
import { PermissionRegistry } from '../security/PermissionRegistry'
import { StaticRoleProvider } from '../security/StaticRolesProvider'
import { createManagers, type ManagerFactoryContext } from '../entity/factory.js'
import { defaultStorageResolver } from '../entity/storage/factory'
import { createDeferredRegistry } from '../deferred/DeferredRegistry.js'
import { createEventRouter } from './EventRouter'
import { createSSEBridge } from './SSEBridge'
import { ActiveStack } from '../chain/ActiveStack.js'
import { StackHydrator } from '../chain/StackHydrator.js'
import { Orchestrator } from '../orchestrator/Orchestrator'
import type { EntityAuthAdapter } from '../entity/auth/EntityAuthAdapter'
import type { Kernel } from './Kernel'
// #1196 Phase B — this-typing against the real Kernel shape (was Self = any)
type Self = Kernel

/**
 * Patch Kernel prototype with registry-related methods.
 */
export function applyRegistryMethods(KernelClass: { prototype: Kernel }): void {
  const proto = KernelClass.prototype

  /**
   * Create signal bus for event-driven communication.
   *
   * When `options.existingSignals` is provided (host shell already
   * owns a bus), reuse it instead of spinning up a fresh one. This
   * is what lets qdcms and qdadm share entity events when they're
   * mounted on the same Vue app.
   */
  proto._createSignalBus = function (this: Self): void {
    if (this.options.existingSignals) {
      this.signals = this.options.existingSignals
      return
    }
    const debug = this.options.debug ?? false
    this.signals = createSignalBus({ debug })
  }

  /**
   * Create hook registry for Drupal-inspired extensibility
   */
  proto._createHookRegistry = function (this: Self): void {
    const debug = this.options.debug ?? false
    this.hookRegistry = createHookRegistry({
      kernel: this.signals!.getKernel(),
      debug,
    })
  }

  /**
   * Create orchestrator with managers and signal bus
   */
  proto._createOrchestrator = function (this: Self): void {
    const factoryContext = {
      storageResolver: this.options.storageResolver || defaultStorageResolver,
      managerResolver: this.options.managerResolver,
      managerRegistry: this.options.managerRegistry || {},
    } as ManagerFactoryContext

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const managers = createManagers((this.options.managers || {}) as any, factoryContext)

    this.orchestrator = new Orchestrator({
      managers,
      signals: this.signals,
      hooks: this.hookRegistry,
      deferred: this.deferred,
      entityAuthAdapter: (this.options.entityAuthAdapter as EntityAuthAdapter) || null,
    })

    // Pass kernel options to orchestrator (avoid circular reference for Vue reactivity)
    this.orchestrator.kernelOptions = {
      defaultEntityCacheTtlMs: this.options.defaultEntityCacheTtlMs,
    }

    if (this.options.toast) {
      this.orchestrator.setToastConfig(this.options.toast)
    }
  }

  /**
   * Create PermissionRegistry early so modules can register permissions
   */
  proto._createPermissionRegistry = function (this: Self): void {
    this.permissionRegistry = new PermissionRegistry()
    this._registerCorePermissions()
  }

  /**
   * Register core system permissions provided by the framework
   */
  proto._registerCorePermissions = function (this: Self): void {
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
  proto._setupSecurity = function (this: Self): void {
    const { security, entityAuthAdapter } = this.options

    if (!this.permissionRegistry) {
      this.permissionRegistry = new PermissionRegistry()
    }

    if (!security) return

    // security configured but no user source: every isGranted() falls back
    // to permissive — a newcomer believes gating is on when it isn't (#1388)
    if (!entityAuthAdapter) {
      console.warn(
        '[Kernel] security is configured but entityAuthAdapter is not — entity ' +
          'permission checks default to PERMISSIVE (no current user to check). ' +
          'Pass entityAuthAdapter (e.g. `() => authAdapter.getUser()`) to enable gating.'
      )
    }

    let rolesProvider = security.rolesProvider
    if (!rolesProvider && (security.role_permissions || security.role_hierarchy)) {
      rolesProvider = new StaticRoleProvider({
        role_hierarchy: security.role_hierarchy || {},
        role_permissions: security.role_permissions || {},
        role_labels: security.role_labels || {},
      })
    }

    this.securityChecker = createSecurityChecker({
      rolesProvider: rolesProvider || undefined,
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

    if (rolesProvider?.install) {
      const ctx = {
        orchestrator: this.orchestrator,
        signals: this.signals,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rolesProvider.install(ctx as any)
    }
  }

  /**
   * Create zone registry for extensible UI composition
   */
  proto._createZoneRegistry = function (this: Self): void {
    const debug = this.options.debug ?? false
    this.zoneRegistry = createZoneRegistry({ debug })
  }

  /**
   * Create active stack for navigation state
   */
  proto._createActiveStack = function (this: Self): void {
    this.activeStack = new ActiveStack(this.signals!)
  }

  /**
   * Create stack hydrator for async data loading
   */
  proto._createStackHydrator = function (this: Self): void {
    this.stackHydrator = new StackHydrator(
      this.activeStack!,
      this.orchestrator!,
      this.signals!
    )
  }

  /**
   * Create deferred registry for async service loading
   */
  proto._createDeferredRegistry = function (this: Self): void {
    const debug = this.options.debug ?? false
    this.deferred = createDeferredRegistry({
      kernel: this.signals?.getKernel() || null,
      debug,
    })
  }

  /**
   * Create EventRouter for declarative signal routing
   */
  proto._createEventRouter = function (this: Self): void {
    const { eventRouter: routes } = this.options
    if (!routes || Object.keys(routes).length === 0) return

    const debug = this.options.debug ?? false
    this.eventRouter = createEventRouter({
      signals: this.signals!,
      routes,
      debug,
    })
  }

  /**
   * Create SSEBridge for Server-Sent Events to SignalBus integration
   */
  proto._createSSEBridge = function (this: Self): void {
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
}
