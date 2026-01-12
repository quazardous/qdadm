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

import {
  createKernel,
  type QuarKernel,
  type ListenerCallback,
  type ListenerOptions,
} from '@quazardous/quarkernel'

/**
 * Signal names for entity operations
 */
export const SIGNALS = {
  // Generic entity lifecycle signals
  ENTITY_CREATED: 'entity:created',
  ENTITY_UPDATED: 'entity:updated',
  ENTITY_DELETED: 'entity:deleted',

  // Auth lifecycle signals
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_EXPIRED: 'auth:expired', // Emitted on 401/403 API responses

  // API error signals
  API_ERROR: 'api:error', // Emitted on any API error { status, message, url }

  // Pattern for entity-specific signals
  // Use buildSignal(entityName, action) for these
} as const

/**
 * Actions for entity signals
 */
export const SIGNAL_ACTIONS = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
} as const

export type SignalAction = (typeof SIGNAL_ACTIONS)[keyof typeof SIGNAL_ACTIONS]

/**
 * Build an entity-specific signal name
 */
export function buildSignal(entityName: string, action: SignalAction): string {
  return `${entityName}:${action}`
}

/**
 * SignalBus constructor options
 */
export interface SignalBusOptions {
  debug?: boolean
}

/**
 * Entity signal payload
 */
export interface EntitySignalPayload {
  entity: string
  data: unknown
}

/**
 * SignalBus class - wraps QuarKernel for qdadm
 */
export class SignalBus {
  private _kernel: QuarKernel

  constructor(options: SignalBusOptions = {}) {
    this._kernel = createKernel({
      delimiter: ':',
      wildcard: true,
      errorBoundary: true,
      debug: options.debug ?? false,
    })
  }

  /**
   * Emit a signal with payload
   */
  async emit(signal: string, payload?: unknown): Promise<void> {
    return this._kernel.emit(signal, payload)
  }

  /**
   * Subscribe to a signal
   * @returns Unbind function
   */
  on(signal: string, handler: ListenerCallback, options: ListenerOptions = {}): () => void {
    return this._kernel.on(signal, handler, options)
  }

  /**
   * Unsubscribe from a signal
   */
  off(signal: string, handler: ListenerCallback): void {
    this._kernel.off(signal, handler)
  }

  /**
   * Subscribe to a signal once
   */
  once(signal: string, handler: ListenerCallback, options: ListenerOptions = {}): () => void {
    return this._kernel.once(signal, handler, options)
  }

  /**
   * Emit an entity lifecycle signal
   */
  async emitEntity(entityName: string, action: SignalAction, data: unknown): Promise<void> {
    const signal = buildSignal('entity', action)
    await this.emit(signal, { entity: entityName, data })
  }

  /**
   * Get listener count for a signal
   */
  listenerCount(signal?: string): number {
    return (this._kernel as unknown as { listenerCount: (s?: string) => number }).listenerCount(signal)
  }

  /**
   * Get all registered signal names
   */
  signalNames(): string[] {
    return (this._kernel as unknown as { eventNames: () => string[] }).eventNames()
  }

  /**
   * Remove all listeners
   */
  offAll(signal?: string): void {
    ;(this._kernel as unknown as { offAll: (s?: string) => void }).offAll(signal)
  }

  /**
   * Enable/disable debug mode
   */
  debug(enabled: boolean): void {
    this._kernel.debug(enabled)
  }

  /**
   * Get the underlying QuarKernel instance
   * Used for sharing the kernel with HookRegistry
   */
  getKernel(): QuarKernel {
    return this._kernel
  }
}

/**
 * Factory function to create a SignalBus instance
 */
export function createSignalBus(options: SignalBusOptions = {}): SignalBus {
  return new SignalBus(options)
}
