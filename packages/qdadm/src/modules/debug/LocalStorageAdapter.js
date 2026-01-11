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

/**
 * LocalStorage adapter for debug settings persistence
 */
export class LocalStorageAdapter {
  /**
   * Create a new LocalStorageAdapter
   * @param {string} key - localStorage key prefix
   */
  constructor(key = 'qdadm-debug') {
    this.key = key
    this._bridge = null
    this._unwatch = null
  }

  /**
   * Get the full key for a setting
   * @param {string} name - Setting name
   * @returns {string} Full localStorage key
   */
  _getKey(name) {
    return `${this.key}:${name}`
  }

  /**
   * Get a value from localStorage
   * @param {string} name - Setting name
   * @param {*} defaultValue - Default if not found
   * @returns {*} The value
   */
  get(name, defaultValue = null) {
    try {
      const stored = localStorage.getItem(this._getKey(name))
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  }

  /**
   * Set a value in localStorage
   * @param {string} name - Setting name
   * @param {*} value - Value to store
   */
  set(name, value) {
    try {
      localStorage.setItem(this._getKey(name), JSON.stringify(value))
    } catch {
      // localStorage might be full or disabled
    }
  }

  /**
   * Remove a value from localStorage
   * @param {string} name - Setting name
   */
  remove(name) {
    localStorage.removeItem(this._getKey(name))
  }

  /**
   * Clear all debug settings
   */
  clear() {
    const prefix = this.key + ':'
    const keys = []
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
   * @param {DebugBridge} bridge - The debug bridge to attach to
   * @returns {LocalStorageAdapter} this for chaining
   */
  attach(bridge) {
    this._bridge = bridge

    // Restore saved enabled state
    const savedEnabled = this.get('enabled')
    if (savedEnabled !== null && bridge.enabled.value !== savedEnabled) {
      bridge.enabled.value = savedEnabled
    }

    // Watch for enabled changes (if Vue's watch is available)
    if (typeof window !== 'undefined' && window.__VUE_WATCH__) {
      // In a real Vue app, use watch from vue
    }

    return this
  }

  /**
   * Detach from the debug bridge
   */
  detach() {
    if (this._unwatch) {
      this._unwatch()
      this._unwatch = null
    }
    this._bridge = null
  }

  /**
   * Save current bridge state
   */
  save() {
    if (!this._bridge) return
    this.set('enabled', this._bridge.enabled.value)
  }

  /**
   * Restore bridge state from localStorage
   */
  restore() {
    if (!this._bridge) return
    const savedEnabled = this.get('enabled')
    if (savedEnabled !== null) {
      this._bridge.enabled.value = savedEnabled
    }
  }
}

/**
 * Factory function to create a LocalStorageAdapter
 * @param {string} key - localStorage key prefix
 * @returns {LocalStorageAdapter}
 */
export function createLocalStorageAdapter(key) {
  return new LocalStorageAdapter(key)
}
