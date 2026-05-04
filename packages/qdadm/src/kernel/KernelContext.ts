/**
 * KernelContext - Fluent API wrapper for module registration.
 *
 * Provides a chainable interface for modules to register entities, routes,
 * navigation items, zones, blocks, signal handlers, hooks, permissions and
 * translations.
 *
 * The class shell here keeps the constructor + service getters; the fluent
 * registration methods live in dedicated patch modules following the same
 * pattern as `Kernel.ts`:
 *
 *   - KernelContext.entities.ts    — entity, userEntity
 *   - KernelContext.routing.ts     — routes, navItem, routeFamily, crud, childPage
 *   - KernelContext.zones.ts       — zone, block, provide, component
 *   - KernelContext.events.ts      — on, hook, defer
 *   - KernelContext.permissions.ts — permissions, entityPermissions
 *   - KernelContext.i18n.ts        — messages, aliases, messagesProvider
 *
 * Usage in a module:
 * ```ts
 * class UsersModule extends Module {
 *   async connect(ctx: KernelContext) {
 *     ctx
 *       .entity('users', { storage: 'api:/api/users' })
 *       .routes('users', [
 *         { path: '', name: 'users', component: UserList },
 *         { path: ':id', name: 'users-edit', component: UserEdit }
 *       ])
 *       .navItem({ section: 'Admin', route: 'users', icon: 'pi pi-users', label: 'Users' })
 *       .zone('users-list-header')
 *       .block('users-list-header', { component: UserStats, weight: 10 })
 *       .on('users:created', (event) => console.log('User created:', event))
 *   }
 * }
 * ```
 */

import type { App, Component } from 'vue'
import type { Router, RouteRecordRaw } from 'vue-router'
import type { ListenerOptions } from '@quazardous/quarkernel'
import type { SignalBus } from './SignalBus'
import type { Orchestrator } from '../orchestrator/Orchestrator'
import type { HookRegistry } from '../hooks/HookRegistry'
import type { ZoneRegistry } from '../zones/ZoneRegistry'
import type { DeferredRegistry } from '../deferred/DeferredRegistry.js'
import type { SecurityChecker } from '../entity/auth/SecurityChecker'
import type { PermissionRegistry } from '../security/PermissionRegistry'
import type { EntityManager } from '../entity/EntityManager'
import type { I18n } from '../i18n/I18n'
import type { AliasPattern, MessagesBundle, TranslationProvider } from '../i18n/types'

// Internal types (shared with patch modules, not exported here).
import type {
  AuthAdapter,
  DeferredFactory,
  HookHandler,
  KernelInterface,
  ModuleWithCleanup,
  SignalHandler,
} from './KernelContext.types'

// Public types — re-exported to keep the existing barrel API stable.
export type {
  BlockConfig,
  ChildPageOptions,
  CrudOptions,
  CrudPages,
  NavItem,
  ParentConfig,
  PermissionMeta,
  PermissionOptions,
  RouteOptions,
  UserEntityOptions,
  ZoneOptions,
} from './KernelContext.types'
import type {
  BlockConfig,
  ChildPageOptions,
  CrudOptions,
  CrudPages,
  NavItem,
  PermissionMeta,
  PermissionOptions,
  RouteOptions,
  UserEntityOptions,
  ZoneOptions,
} from './KernelContext.types'

// Prototype-patched method groups
import { applyEntityMethods } from './KernelContext.entities'
import { applyRoutingMethods } from './KernelContext.routing'
import { applyZoneMethods } from './KernelContext.zones'
import { applyEventMethods } from './KernelContext.events'
import { applyPermissionMethods } from './KernelContext.permissions'
import { applyI18nMethods } from './KernelContext.i18n'

export class KernelContext {
  // Marked public so the patch modules (which read this.* via Self=any) can
  // see them. They were `private` in the previous monolithic file but were
  // already accessed across patch boundaries the moment we split.
  _kernel: KernelInterface
  _module: ModuleWithCleanup | null

  constructor(kernel: KernelInterface, module: ModuleWithCleanup | null) {
    this._kernel = kernel
    this._module = module
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Getters for kernel services
  // ─────────────────────────────────────────────────────────────────────────────

  /** Vue app instance */
  get app(): App | null {
    return this._kernel.vueApp
  }

  /** Vue router instance */
  get router(): Router | null {
    return this._kernel.router
  }

  /** SignalBus instance */
  get signals(): SignalBus | null {
    return this._kernel.signals
  }

  /** Orchestrator instance (entity managers) */
  get orchestrator(): Orchestrator | null {
    return this._kernel.orchestrator
  }

  /** ZoneRegistry instance */
  get zones(): ZoneRegistry | null {
    return this._kernel.zoneRegistry
  }

  /** HookRegistry instance */
  get hooks(): HookRegistry | null {
    return this._kernel.hookRegistry
  }

  /** DeferredRegistry instance */
  get deferred(): DeferredRegistry | null {
    return this._kernel.deferred
  }

  /** Whether running in development mode */
  get isDev(): boolean {
    return (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV ?? false
  }

  /** Debug mode from kernel options */
  get debug(): boolean {
    return this._kernel.options?.debug ?? false
  }

  /** Auth adapter */
  get authAdapter(): AuthAdapter | null {
    return this._kernel.options?.authAdapter ?? null
  }

  /** Security checker (role hierarchy, permissions) */
  get security(): SecurityChecker | null {
    return this._kernel.securityChecker
  }

  /** Permission registry */
  get permissionRegistry(): PermissionRegistry | null {
    return this._kernel.permissionRegistry
  }

  /** Auth adapter shortcut */
  get auth(): AuthAdapter | null {
    return this._kernel.options?.authAdapter ?? null
  }

  /** ActiveStack instance (sync navigation context) */
  get activeStack(): unknown {
    return this._kernel.activeStack ?? null
  }

  /** StackHydrator instance (async data loading) */
  get stackHydrator(): unknown {
    return this._kernel.stackHydrator ?? null
  }

  /** I18n subsystem */
  get i18n(): I18n | null {
    return this._kernel.i18nInstance ?? null
  }
}

// Declare prototype-patched methods (declaration merging)
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface KernelContext {
  // Entities (KernelContext.entities.ts)
  entity(name: string, config: string | Record<string, unknown> | EntityManager): this
  userEntity(options: UserEntityOptions): this

  // Routing (KernelContext.routing.ts)
  routes(basePath: string, routes: RouteRecordRaw[], opts?: RouteOptions): this
  navItem(item: NavItem): this
  routeFamily(base: string, prefixes: string[]): this
  crud(entity: string, pages: CrudPages, options?: CrudOptions): this
  childPage(parentRouteName: string, pageName: string, options: ChildPageOptions): this

  // Zones / Vue (KernelContext.zones.ts)
  zone(name: string, options?: ZoneOptions): this
  block(zoneName: string, config: BlockConfig): this
  provide(key: string | symbol, value: unknown): this
  component(name: string, component: Component): this

  // Events (KernelContext.events.ts)
  on(signal: string, handler: SignalHandler, options?: ListenerOptions): this
  hook(hookName: string, handler: HookHandler, options?: Record<string, unknown>): this
  defer(name: string, factory: DeferredFactory): this

  // Permissions (KernelContext.permissions.ts)
  permissions(
    namespace: string,
    permissions: Record<string, string | PermissionMeta>,
    options?: PermissionOptions
  ): this
  entityPermissions(
    entity: string,
    permissions: Record<string, string | PermissionMeta>
  ): this

  // i18n (KernelContext.i18n.ts)
  messages(locale: string, bundle: MessagesBundle): this
  aliases(patterns: AliasPattern[]): this
  messagesProvider(provider: TranslationProvider): this
}

// Apply prototype patches
applyEntityMethods(KernelContext)
applyRoutingMethods(KernelContext)
applyZoneMethods(KernelContext)
applyEventMethods(KernelContext)
applyPermissionMethods(KernelContext)
applyI18nMethods(KernelContext)

/**
 * Factory function to create a KernelContext instance.
 */
export function createKernelContext(
  kernel: KernelInterface,
  module: ModuleWithCleanup | null
): KernelContext {
  return new KernelContext(kernel, module)
}
