/**
 * Orchestrator - Manager of EntityManagers
 *
 * Central registry that creates and distributes EntityManagers.
 * Uses a factory function provided by the consuming application.
 * Entity configs can be declared by modules via registry.addEntity().
 *
 * Usage:
 * ```js
 * // Dashboard provides a factory that receives (name, config)
 * const entityFactory = (entityName, entityConfig) => {
 *   // entityConfig comes from registry.addEntity() or is undefined
 *   if (entityConfig instanceof EntityManager) {
 *     return entityConfig  // Module provided a custom manager
 *   }
 *   return new EntityManager({
 *     name: entityName,
 *     storage: new ApiStorage({
 *       endpoint: entityConfig?.endpoint || `/${entityName}`,
 *       client
 *     })
 *   })
 * }
 *
 * const orchestrator = new Orchestrator({ entityFactory })
 *
 * // Get managers (created lazily)
 * const usersManager = orchestrator.get('users')
 * ```
 */
import { getEntityConfig } from '../module/moduleRegistry'
import type { EntityManager, EntityManagerOptions } from '../entity/EntityManager'
import type { EntityRecord } from '../types'
import type { SignalBus } from '../kernel/SignalBus'
import type { HookRegistry } from '../hooks/HookRegistry'
import type { EntityAuthAdapter } from '../entity/auth/EntityAuthAdapter'

/**
 * DeferredRegistry interface (minimal for Orchestrator needs)
 */
export interface DeferredRegistry {
  has(key: string): boolean
  await(key: string): Promise<unknown>
  queue<T>(key: string, fn: () => Promise<T>): Promise<T>
}

/**
 * Entity factory function type
 */
export type EntityFactory = (
  entityName: string,
  entityConfig: EntityManagerOptions | EntityManager | undefined
) => EntityManager | null

/**
 * Toast options
 */
export interface ToastOptions {
  life?: number
  emitter?: string
}

/**
 * Toast config for default life durations
 */
export interface ToastConfig {
  success?: number
  error?: number
  warn?: number
  info?: number
}

/**
 * Toast helper interface
 */
export interface ToastHelper {
  success(summary: string, detail?: string, options?: string | ToastOptions): void
  error(summary: string, detail?: string, options?: string | ToastOptions): void
  warn(summary: string, detail?: string, options?: string | ToastOptions): void
  info(summary: string, detail?: string, options?: string | ToastOptions): void
}

/**
 * Orchestrator constructor options
 */
export interface OrchestratorOptions {
  entityFactory?: EntityFactory | null
  managers?: Record<string, EntityManager>
  signals?: SignalBus | null
  hooks?: HookRegistry | null
  deferred?: DeferredRegistry | null
  entityAuthAdapter?: EntityAuthAdapter | null
}

export class Orchestrator {
  private _entityFactory: EntityFactory | null
  private _managers: Map<string, EntityManager>
  private _signals: SignalBus | null
  private _hooks: HookRegistry | null
  private _deferred: DeferredRegistry | null
  private _entityAuthAdapter: EntityAuthAdapter | null
  private _toastConfig: ToastConfig = {}
  private _toastHelper: ToastHelper | null = null

  // Kernel options (set by Kernel after construction, avoids circular reference)
  kernelOptions?: {
    defaultEntityCacheTtlMs?: number
  }

  constructor(options: OrchestratorOptions = {}) {
    const {
      entityFactory = null,
      // Optional: pre-registered managers (for special cases)
      managers = {},
      // SignalBus instance for event-driven communication
      signals = null,
      // HookRegistry instance for lifecycle hooks
      hooks = null,
      // DeferredRegistry instance for async warmup
      deferred = null,
      // Optional: AuthAdapter for entity permission checks (scope/silo)
      entityAuthAdapter = null,
    } = options

    this._entityFactory = entityFactory
    this._managers = new Map()
    this._signals = signals
    this._hooks = hooks
    this._deferred = deferred
    this._entityAuthAdapter = entityAuthAdapter

    // Register pre-provided managers
    for (const [name, manager] of Object.entries(managers)) {
      this.register(name, manager)
    }
  }

  /**
   * Set the SignalBus instance
   */
  setSignals(signals: SignalBus): void {
    this._signals = signals
  }

  /**
   * Get the SignalBus instance
   */
  get signals(): SignalBus | null {
    return this._signals
  }

  /**
   * Set toast configuration (life defaults per severity)
   */
  setToastConfig(config: ToastConfig): void {
    this._toastConfig = { ...this._toastConfig, ...config }
    this._toastHelper = null // Reset helper to pick up new config
  }

  /**
   * Toast helper - wraps signal-based toasts
   *
   * Usage:
   *   orchestrator.toast.success('Saved', 'Item saved successfully')
   *   orchestrator.toast.error('Error', 'Failed to save', 'MyComponent')
   *   orchestrator.toast.warn('Warning', 'Check your input', { life: 10000, emitter: 'Custom' })
   *
   * Third param can be:
   * - string: treated as emitter
   * - object: { life, emitter }
   */
  get toast(): ToastHelper {
    if (!this._toastHelper) {
      // Default life values per severity (can be overridden via setToastConfig)
      const defaults: Required<ToastConfig> = {
        success: 3000,
        error: 5000,
        warn: 5000,
        info: 3000,
        ...this._toastConfig,
      }

      const emit = (
        severity: keyof ToastConfig,
        summary: string,
        detail?: string,
        options?: string | ToastOptions
      ): void => {
        if (this._signals) {
          // Options can be string (emitter) or object { life, emitter }
          const opts: ToastOptions =
            typeof options === 'string' ? { emitter: options } : options || {}
          this._signals.emit(`toast:${severity}`, {
            summary,
            detail,
            life: opts.life ?? defaults[severity],
            emitter: opts.emitter,
          })
        }
      }

      this._toastHelper = {
        success: (summary, detail, options) => emit('success', summary, detail, options),
        error: (summary, detail, options) => emit('error', summary, detail, options),
        warn: (summary, detail, options) => emit('warn', summary, detail, options),
        info: (summary, detail, options) => emit('info', summary, detail, options),
      }
    }
    return this._toastHelper
  }

  /**
   * Set the entity AuthAdapter for permission checks
   * This adapter will be injected into all newly registered managers
   * (unless they already have their own adapter)
   */
  setEntityAuthAdapter(adapter: EntityAuthAdapter): void {
    this._entityAuthAdapter = adapter
  }

  /**
   * Get the entity AuthAdapter
   */
  get entityAuthAdapter(): EntityAuthAdapter | null {
    return this._entityAuthAdapter
  }

  /**
   * Set the HookRegistry instance
   */
  setHooks(hooks: HookRegistry): void {
    this._hooks = hooks
  }

  /**
   * Get the HookRegistry instance
   */
  get hooks(): HookRegistry | null {
    return this._hooks
  }

  /**
   * Set the DeferredRegistry instance
   */
  setDeferred(deferred: DeferredRegistry): void {
    this._deferred = deferred
  }

  /**
   * Get the DeferredRegistry instance
   */
  get deferred(): DeferredRegistry | null {
    return this._deferred
  }

  /**
   * Set the entity factory
   */
  setFactory(factory: EntityFactory): void {
    this._entityFactory = factory
  }

  /**
   * Register an EntityManager manually
   * Use this for special managers that don't follow the factory pattern
   */
  register(name: string, manager: EntityManager): void {
    this._managers.set(name, manager)
    // Pass signals reference to manager for event emission
    if (this._signals && manager.setSignals) {
      manager.setSignals(this._signals)
    }
    // Pass hooks reference to manager for lifecycle hooks
    if (this._hooks && manager.setHooks) {
      manager.setHooks(this._hooks)
    }
    // Inject entityAuthAdapter if provided and manager doesn't have one
    // Manager's own adapter takes precedence (allows per-entity customization)
    const managerWithAuth = manager as EntityManager & { _authAdapter?: unknown }
    if (this._entityAuthAdapter && !managerWithAuth._authAdapter) {
      manager.authAdapter = this._entityAuthAdapter
    }
    if (manager.onRegister) {
      manager.onRegister(this)
    }
  }

  /**
   * Check if a manager exists (registered or can be created via factory)
   */
  has(name: string): boolean {
    return this._managers.has(name) || !!this._entityFactory
  }

  /**
   * Check if a manager is actually registered (not just creatable)
   * Use this to check if ctx.entity() was called for this entity
   */
  isRegistered(name: string): boolean {
    return this._managers.has(name)
  }

  /**
   * Get an EntityManager by name
   * Creates it via factory if not already registered
   */
  get<T extends EntityRecord = EntityRecord>(name: string): EntityManager<T> | undefined {
    // Return existing manager
    if (this._managers.has(name)) {
      return this._managers.get(name) as unknown as EntityManager<T>
    }

    // Get entity config from module registry (if declared)
    const entityConfig = getEntityConfig(name) as
      | EntityManagerOptions
      | EntityManager
      | undefined

    // If config is already an EntityManager, use it directly
    if (entityConfig && typeof (entityConfig as EntityManager).get === 'function') {
      this.register(name, entityConfig as EntityManager)
      return entityConfig as unknown as EntityManager<T>
    }

    // Create via factory
    if (this._entityFactory) {
      const manager = this._entityFactory(name, entityConfig)
      if (manager) {
        this.register(name, manager)
        return manager as unknown as EntityManager<T>
      }
    }

    // Build helpful error message
    const registered = this.getRegisteredNames()
    const hint =
      registered.length > 0
        ? `\nRegistered entities: ${registered.join(', ')}\n`
        : '\nNo entities registered yet.\n'

    const suggestion = `
Possible causes:
1. Entity "${name}" not declared in any module (ctx.entity('${name}', {...}))
2. Module not loaded (check moduleDefs in config/modules.js)
3. Typo in entity name

Example fix in your module:
  ctx.entity('${name}', {
    name: '${name}',
    labelField: 'name',
    fields: { ... },
    storage: yourStorage
  })`

    throw new Error(`[Orchestrator] No manager for entity "${name}"${hint}${suggestion}`)
  }

  /**
   * Get all registered manager names
   */
  getRegisteredNames(): string[] {
    return Array.from(this._managers.keys())
  }

  /**
   * Fire warmup for all managers (fire-and-forget)
   *
   * Triggers cache preloading for all managers with warmupEnabled.
   * Each manager registers its warmup in the DeferredRegistry, allowing
   * pages to await specific entities before rendering.
   *
   * IMPORTANT: This is fire-and-forget by design. Don't await this method.
   * Components await what they need via DeferredRegistry:
   *   `await deferred.await('entity:books:cache')`
   *
   * @returns For debugging/logging only
   *
   * @example
   * ```js
   * // At boot (fire-and-forget)
   * orchestrator.fireWarmups()
   *
   * // In component - await specific entity cache
   * await deferred.await('entity:books:cache')
   * const { items } = await booksManager.list()  // Uses local cache
   * ```
   */
  fireWarmups(): Map<string, boolean | Error | null> {
    const results = new Map<string, boolean | Error | null>()

    for (const [name, manager] of this._managers) {
      if (manager.warmup && manager.warmupEnabled) {
        // Fire each warmup - they register themselves in DeferredRegistry
        manager
          .warmup()
          .then((result) => {
            results.set(name, result)
          })
          .catch((error: Error) => {
            console.warn(`[Orchestrator] Warmup failed for ${name}:`, error.message)
            results.set(name, error)
          })
      }
    }

    return results
  }

  /**
   * Dispose all managers
   */
  dispose(): void {
    for (const [, manager] of this._managers) {
      if (manager.onDispose) {
        manager.onDispose()
      }
    }
    this._managers.clear()
  }
}

/**
 * Factory function to create an Orchestrator
 */
export function createOrchestrator(options?: OrchestratorOptions): Orchestrator {
  return new Orchestrator(options)
}
