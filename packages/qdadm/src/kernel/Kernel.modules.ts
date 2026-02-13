import { initModules, setSectionOrder } from '../module/moduleRegistry'
import { createModuleLoader, type ModuleLike } from './ModuleLoader'
import { createKernelContext, type KernelContext } from './KernelContext'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Self = any

/**
 * Patch Kernel prototype with module-related methods.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyModuleMethods(KernelClass: { prototype: any }): void {
  const proto = KernelClass.prototype as Self

  /**
   * Fire entity cache warmups
   */
  proto._fireWarmups = function (this: Self): void {
    const warmup = this.options.warmup ?? true
    if (!warmup) return

    this.orchestrator!.fireWarmups()
  }

  /**
   * Initialize legacy modules from glob import
   */
  proto._initModules = function (this: Self): void {
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
  proto._createModuleContext = function (this: Self, module: ModuleLike): KernelContext {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createKernelContext(this as any, module as any)
  }

  /**
   * Load new-style modules synchronously
   */
  proto._loadModulesSync = function (this: Self): void {
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
  proto._loadModules = async function (this: Self): Promise<void> {
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
  proto._wireModules = function (this: Self): void {
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
  proto._wireModulesAsync = async function (this: Self): Promise<void> {
    if (!this.moduleLoader) return

    await this.signals!.emit('kernel:ready', { ready: true })
  }
}
