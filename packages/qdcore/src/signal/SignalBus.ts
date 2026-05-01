/**
 * SignalBus - Generic event dispatcher built on QuarKernel.
 *
 * Framework-agnostic; no qdadm or qdcms specifics. Provides:
 * - Wildcard subscriptions (`entity:*`, `*:created`, `**`)
 * - Async serial emission with error boundary
 * - Convenience for namespaced signal names (`buildSignal`, `emitEntity`)
 *
 * Naming conventions are left to the consumer; this module only provides
 * the dispatch primitive and a `name:action` helper.
 */

import {
  createKernel,
  type Kernel as QuarKernel,
  type ListenerFunction as ListenerCallback,
  type ListenerOptions,
} from '@quazardous/quarkernel'

/**
 * Standard action verbs used in `name:action` signal names.
 */
export const SIGNAL_ACTIONS = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
} as const

export type SignalAction = (typeof SIGNAL_ACTIONS)[keyof typeof SIGNAL_ACTIONS]

/**
 * Build a `name:action` signal name (e.g. `('books', 'created') -> 'books:created'`).
 */
export function buildSignal(name: string, action: SignalAction | string): string {
  return `${name}:${action}`
}

/**
 * SignalBus constructor options.
 */
export interface SignalBusOptions {
  debug?: boolean
}

/**
 * Generic payload shape for namespaced lifecycle signals
 * (e.g. emitted by `emitEntity` / equivalent helpers).
 */
export interface NamespacedSignalPayload {
  entity: string
  data: unknown
}

/** Backwards-compatible alias kept for qdadm consumers. */
export type EntitySignalPayload = NamespacedSignalPayload

/**
 * Generic event dispatcher. Wraps a QuarKernel instance.
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

  /** Emit a signal with payload. */
  async emit(signal: string, payload?: unknown): Promise<void> {
    return this._kernel.emit(signal, payload)
  }

  /** Subscribe to a signal. Returns an unbind function. */
  on(signal: string, handler: ListenerCallback, options: ListenerOptions = {}): () => void {
    return this._kernel.on(signal, handler, options)
  }

  /** Unsubscribe from a signal. */
  off(signal: string, handler: ListenerCallback): void {
    this._kernel.off(signal, handler)
  }

  /**
   * Subscribe to a signal once.
   *
   * Two styles, dispatched by argument shape:
   * - **Callback** — `once(signal, handler, options?) → () => void` (unbind).
   *   Sugar for `on(signal, handler, { once: true })`.
   * - **Promise** — `once(signal, { timeout? })? → Promise<event>` (resolves
   *   on first emission, rejects on timeout). Passes through to quarkernel.
   */
  once(signal: string, handler: ListenerCallback, options?: ListenerOptions): () => void
  once(signal: string, options?: { timeout?: number }): Promise<unknown>
  once(
    signal: string,
    handlerOrOptions?: ListenerCallback | { timeout?: number },
    options: ListenerOptions = {}
  ): (() => void) | Promise<unknown> {
    if (typeof handlerOrOptions === 'function') {
      return this._kernel.on(signal, handlerOrOptions, { ...options, once: true })
    }
    return this._kernel.once(signal, handlerOrOptions)
  }

  /**
   * Convenience: emit a namespaced lifecycle signal.
   * Builds `entity:{action}` and sends `{ entity: entityName, data }` as payload.
   * Naming convention is `entity:` for backwards compatibility with qdadm CRUD signals,
   * but consumers can use `emit(buildSignal(ns, action), payload)` for any other namespace.
   */
  async emitEntity(entityName: string, action: SignalAction, data: unknown): Promise<void> {
    const signal = buildSignal('entity', action)
    await this.emit(signal, { entity: entityName, data } satisfies NamespacedSignalPayload)
  }

  /** Listener count for a signal (or total when omitted). */
  listenerCount(signal?: string): number {
    return (this._kernel as unknown as { listenerCount: (s?: string) => number }).listenerCount(signal)
  }

  /** All registered signal names. */
  signalNames(): string[] {
    return (this._kernel as unknown as { eventNames: () => string[] }).eventNames()
  }

  /** Remove all listeners (optionally for a specific signal). */
  offAll(signal?: string): void {
    ;(this._kernel as unknown as { offAll: (s?: string) => void }).offAll(signal)
  }

  /** Toggle debug mode. */
  debug(enabled: boolean): void {
    this._kernel.debug(enabled)
  }

  /** Underlying QuarKernel instance — exposed for advanced consumers (e.g. HookRegistry). */
  getKernel(): QuarKernel {
    return this._kernel
  }
}

export function createSignalBus(options: SignalBusOptions = {}): SignalBus {
  return new SignalBus(options)
}
