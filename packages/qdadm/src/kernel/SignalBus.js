/**
 * SignalBus - Wrapper around QuarKernel for qdadm event-driven architecture
 *
 * Provides a clean API for entity lifecycle events and cross-component communication.
 * Uses QuarKernel's wildcard support for flexible event subscriptions.
 *
 * Signal naming conventions:
 * - Generic CRUD: entity:created, entity:updated, entity:deleted
 * - Entity-specific: {entityName}:created, {entityName}:updated, {entityName}:deleted
 *
 * Wildcard subscriptions (via QuarKernel):
 * - 'entity:*' matches entity:created, entity:updated, entity:deleted
 * - 'books:*' matches books:created, books:updated, books:deleted
 * - '*:created' matches any entity creation
 */

import { createKernel } from '@quazardous/quarkernel'

/**
 * Signal names for entity operations
 */
export const SIGNALS = {
  // Generic entity lifecycle signals
  ENTITY_CREATED: 'entity:created',
  ENTITY_UPDATED: 'entity:updated',
  ENTITY_DELETED: 'entity:deleted',

  // Pattern for entity-specific signals
  // Use buildSignal(entityName, action) for these
}

/**
 * Actions for entity signals
 */
export const SIGNAL_ACTIONS = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
}

/**
 * Build an entity-specific signal name
 * @param {string} entityName - Entity name (e.g., 'books', 'users')
 * @param {string} action - Action from SIGNAL_ACTIONS
 * @returns {string} Signal name (e.g., 'books:created')
 */
export function buildSignal(entityName, action) {
  return `${entityName}:${action}`
}

/**
 * SignalBus class - wraps QuarKernel for qdadm
 */
export class SignalBus {
  /**
   * @param {object} options - QuarKernel options
   * @param {boolean} options.debug - Enable debug logging
   */
  constructor(options = {}) {
    this._kernel = createKernel({
      delimiter: ':',
      wildcard: true,
      errorBoundary: true,
      debug: options.debug ?? false,
    })
  }

  /**
   * Emit a signal with payload
   * @param {string} signal - Signal name
   * @param {*} payload - Signal payload (typically { entity, data, context })
   * @returns {Promise<void>}
   */
  async emit(signal, payload) {
    return this._kernel.emit(signal, payload)
  }

  /**
   * Subscribe to a signal
   * @param {string} signal - Signal name (supports wildcards via QuarKernel)
   * @param {Function} handler - Handler function (event, ctx) => void
   * @param {object} options - Listener options
   * @param {number} options.priority - Listener priority (higher = earlier)
   * @param {string} options.id - Unique listener ID
   * @param {string|string[]} options.after - Run after these listener IDs
   * @param {boolean} options.once - Remove after first call
   * @returns {Function} Unbind function
   */
  on(signal, handler, options = {}) {
    return this._kernel.on(signal, handler, options)
  }

  /**
   * Unsubscribe from a signal
   * @param {string} signal - Signal name
   * @param {Function} handler - Handler function to remove (optional, removes all if omitted)
   */
  off(signal, handler) {
    this._kernel.off(signal, handler)
  }

  /**
   * Subscribe to a signal once (Promise-based)
   * @param {string} signal - Signal name
   * @param {object} options - Options
   * @param {number} options.timeout - Timeout in ms
   * @returns {Promise<object>} Event object
   */
  once(signal, options = {}) {
    return this._kernel.once(signal, options)
  }

  /**
   * Emit an entity lifecycle signal
   * @param {string} entityName - Entity name
   * @param {string} action - Action from SIGNAL_ACTIONS
   * @param {object} data - Entity data
   * @returns {Promise<void>}
   */
  async emitEntity(entityName, action, data) {
    const specificSignal = buildSignal(entityName, action)
    const genericSignal = buildSignal('entity', action)

    // Emit both specific and generic signals
    // Specific first, then generic
    await this.emit(specificSignal, { entity: entityName, data })
    await this.emit(genericSignal, { entity: entityName, data })
  }

  /**
   * Get listener count for a signal
   * @param {string} signal - Signal name (optional, total if omitted)
   * @returns {number}
   */
  listenerCount(signal) {
    return this._kernel.listenerCount(signal)
  }

  /**
   * Get all registered signal names
   * @returns {string[]}
   */
  signalNames() {
    return this._kernel.eventNames()
  }

  /**
   * Remove all listeners
   * @param {string} signal - Signal name (optional, all if omitted)
   */
  offAll(signal) {
    this._kernel.offAll(signal)
  }

  /**
   * Enable/disable debug mode
   * @param {boolean} enabled
   */
  debug(enabled) {
    this._kernel.debug(enabled)
  }

  /**
   * Get the underlying QuarKernel instance
   * Used for sharing the kernel with HookRegistry
   * @returns {QuarKernel}
   */
  getKernel() {
    return this._kernel
  }
}

/**
 * Factory function to create a SignalBus instance
 * @param {object} options - SignalBus options
 * @returns {SignalBus}
 */
export function createSignalBus(options = {}) {
  return new SignalBus(options)
}
