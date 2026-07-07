/**
 * Patch KernelContext prototype with event-bus / hook / deferred methods:
 *   - on(signal, handler, options)    — signal subscription, auto-cleaned on
 *                                        module disconnect
 *   - hook(hookName, handler, options) — hook registration
 *   - defer(name, factory)             — queue a deferred task
 */

import type { ListenerOptions } from '@quazardous/quarkernel'
import type {
  DeferredFactory,
  HookHandler,
  SignalHandler,
} from './KernelContext.types'
import type { KernelContext } from './KernelContext'

// #1196 Phase B — this-typing against the real KernelContext shape (was Self = any)
type Self = KernelContext

export function applyEventMethods(KernelContextClass: { prototype: KernelContext }): void {
  const proto = KernelContextClass.prototype

  proto.on = function (
    this: Self,
    signal: string,
    handler: SignalHandler,
    options: ListenerOptions = {}
  ): Self {
    if (this._kernel.signals) {
      const cleanup = this._kernel.signals.on(signal, handler, options)
      // Register cleanup with module for automatic unsubscribe on disconnect
      if (this._module && typeof this._module._addSignalCleanup === 'function') {
        this._module._addSignalCleanup(cleanup)
      }
    }
    return this
  }

  proto.hook = function (
    this: Self,
    hookName: string,
    handler: HookHandler,
    options: Record<string, unknown> = {}
  ): Self {
    if (this._kernel.hookRegistry) {
      this._kernel.hookRegistry.register(hookName, handler, options)
    }
    return this
  }

  proto.defer = function (this: Self, name: string, factory: DeferredFactory): Self {
    if (this._kernel.deferred) {
      this._kernel.deferred.queue(name, factory)
    }
    return this
  }
}
