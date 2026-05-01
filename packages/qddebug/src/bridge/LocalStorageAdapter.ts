/**
 * LocalStorageAdapter - Debug settings persistence.
 *
 * Persists debug bridge state (enabled, collector settings) to localStorage,
 * so debug settings survive page refreshes.
 *
 * @example
 * import { createDebugBridge, LocalStorageAdapter } from '@quazardous/qddebug'
 *
 * const debug = createDebugBridge()
 * const storage = new LocalStorageAdapter('qdadm-debug')
 * storage.attach(debug)
 */

import type { DebugBridge } from './DebugBridge'

export class LocalStorageAdapter {
  readonly key: string
  private _bridge: DebugBridge | null = null
  private _unwatch: (() => void) | null = null

  constructor(key = 'qddebug') {
    this.key = key
  }

  private _getKey(name: string): string {
    return `${this.key}:${name}`
  }

  get<T>(name: string, defaultValue: T | null = null): T | null {
    try {
      const stored = localStorage.getItem(this._getKey(name))
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  }

  set(name: string, value: unknown): void {
    try {
      localStorage.setItem(this._getKey(name), JSON.stringify(value))
    } catch {
      // localStorage might be full or disabled
    }
  }

  remove(name: string): void {
    localStorage.removeItem(this._getKey(name))
  }

  clear(): void {
    const prefix = this.key + ':'
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
  }

  attach(bridge: DebugBridge): this {
    this._bridge = bridge
    const savedEnabled = this.get<boolean>('enabled')
    if (savedEnabled !== null && bridge.enabled.value !== savedEnabled) {
      bridge.enabled.value = savedEnabled
    }
    return this
  }

  detach(): void {
    if (this._unwatch) {
      this._unwatch()
      this._unwatch = null
    }
    this._bridge = null
  }

  save(): void {
    if (!this._bridge) return
    this.set('enabled', this._bridge.enabled.value)
  }

  restore(): void {
    if (!this._bridge) return
    const savedEnabled = this.get<boolean>('enabled')
    if (savedEnabled !== null) {
      this._bridge.enabled.value = savedEnabled
    }
  }
}

export function createLocalStorageAdapter(key?: string): LocalStorageAdapter {
  return new LocalStorageAdapter(key)
}
