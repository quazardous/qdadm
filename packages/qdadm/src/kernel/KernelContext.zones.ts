/**
 * Patch KernelContext prototype with UI extensibility methods:
 *   - zone(name, options)        — define a zone slot
 *   - block(zoneName, config)    — register a block in a zone
 *   - provide(key, value)        — Vue dependency injection
 *   - component(name, component) — global Vue component registration
 *
 * provide/component fall back to the kernel's _pendingProvides /
 * _pendingComponents maps when the Vue app isn't created yet, so modules can
 * call them during connect().
 */

import type { Component } from 'vue'
import type { BlockConfig, ZoneOptions } from './KernelContext.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Self = any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyZoneMethods(KernelContextClass: { prototype: any }): void {
  const proto = KernelContextClass.prototype as Self

  proto.zone = function (this: Self, name: string, options: ZoneOptions = {}): Self {
    if (this._kernel.zoneRegistry) {
      this._kernel.zoneRegistry.defineZone(name, options)
    }
    return this
  }

  proto.block = function (this: Self, zoneName: string, config: BlockConfig): Self {
    if (this._kernel.zoneRegistry) {
      this._kernel.zoneRegistry.registerBlock(zoneName, config)
    }
    return this
  }

  proto.provide = function (this: Self, key: string | symbol, value: unknown): Self {
    if (this._kernel.vueApp) {
      this._kernel.vueApp.provide(key, value)
    } else {
      this._kernel._pendingProvides.set(key, value)
    }
    return this
  }

  proto.component = function (this: Self, name: string, component: Component): Self {
    if (this._kernel.vueApp) {
      this._kernel.vueApp.component(name, component)
    } else {
      this._kernel._pendingComponents.set(name, component)
    }
    return this
  }
}
