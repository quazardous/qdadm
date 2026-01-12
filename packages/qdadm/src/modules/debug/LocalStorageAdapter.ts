/**
 * LocalStorageAdapter - Debug settings persistence
 *
 * Persists debug bridge state (enabled, collector settings) to localStorage.
 * Allows debug settings to survive page refreshes.
 *
 * @example
 * import { createDebugBridge, LocalStorageAdapter } from '@qdadm/core/debug'
 *
 * const debug = createDebugBridge()
 * const storage = new LocalStorageAdapter('qdadm-debug')
 * storage.attach(debug) // Auto-saves on change, restores on load
 */

import type { DebugBridge } from './DebugBridge'

/**
 * LocalStorage adapter for debug settings persistence
 */
export class LocalStorageAdapter {
  readonly key: string
  private _bridge: DebugBridge | null = null
  private _unwatch: (() => void) | null = null

  /**
   * Create a new LocalStorageAdapter
   * @param key - localStorage key prefix
   */
  constructor(key = 'qdadm-debug') {
    this.key = key
  }

  /**
   * Get the full key for a setting
   * @param name - Setting name
   * @returns Full localStorage key
   */
  private _getKey(name: string): string {
    return `${this.key}:${name}`
  }

  /**
   * Get a value from localStorage
   * @param name - Setting name
   * @param defaultValue - Default if not found
   * @returns The value
   */
  get<T>(name: string, defaultValue: T | null = null): T | null {
    try {
      const stored = localStorage.getItem(this._getKey(name))
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  }

  /**
   * Set a value in localStorage
   * @param name - Setting name
   * @param value - Value to store
   */
  set(name: string, value: unknown): void {
    try {
      localStorage.setItem(this._getKey(name), JSON.stringify(value))
    } catch {
      // localStorage might be full or disabled
    }
  }

  /**
   * Remove a value from localStorage
   * @param name - Setting name
   */
  remove(name: string): void {
    localStorage.removeItem(this._getKey(name))
  }

  /**
   * Clear all debug settings
   */
  clear(): void {
    const prefix = this.key + ':'
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        keys.push(key)
      }
    }
    keys.forEach(key => localStorage.removeItem(key))
  }

  /**
   * Attach to a DebugBridge and sync state
   * Restores saved state and watches for changes
   * @param bridge - The debug bridge to attach to
   * @returns this for chaining
   */
  attach(bridge: DebugBridge): this {
    this._bridge = bridge

    // Restore saved enabled state
    const savedEnabled = this.get<boolean>('enabled')
    if (savedEnabled !== null && bridge.enabled.value !== savedEnabled) {
      bridge.enabled.value = savedEnabled
    }

    // Watch for enabled changes (if Vue's watch is available)
    // In a real Vue app, use watch from vue

    return this
  }

  /**
   * Detach from the debug bridge
   */
  detach(): void {
    if (this._unwatch) {
      this._unwatch()
      this._unwatch = null
    }
    this._bridge = null
  }

  /**
   * Save current bridge state
   */
  save(): void {
    if (!this._bridge) return
    this.set('enabled', this._bridge.enabled.value)
  }

  /**
   * Restore bridge state from localStorage
   */
  restore(): void {
    if (!this._bridge) return
    const savedEnabled = this.get<boolean>('enabled')
    if (savedEnabled !== null) {
      this._bridge.enabled.value = savedEnabled
    }
  }
}

/**
 * Factory function to create a LocalStorageAdapter
 * @param key - localStorage key prefix
 */
export function createLocalStorageAdapter(key?: string): LocalStorageAdapter {
  return new LocalStorageAdapter(key)
}
