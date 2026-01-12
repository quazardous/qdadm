/**
 * DeferredRegistry - Named promise registry for loose coupling
 *
 * Enables async dependencies between services/components:
 * - Services queue work during warmup
 * - Components await dependencies without tight coupling
 * - External signals (SSE) can resolve promises
 *
 * Key insight: await() can be called BEFORE queue() - the promise
 * is created on first access and resolved when the task completes.
 *
 * @example
 * ```ts
 * // During app boot - queue lazy services
 * deferred.queue('users-service', () => usersService.init())
 * deferred.queue('config', () => configService.load())
 *
 * // In component - await dependencies (can be called before queue!)
 * const config = await deferred.await('config')
 *
 * // Wait for multiple with Promise.all
 * const [users, config] = await Promise.all([
 *   deferred.await('users-service'),
 *   deferred.await('config')
 * ])
 *
 * // External resolution (SSE, webhooks)
 * deferred.resolve('job-123', { status: 'done', data: result })
 * deferred.reject('job-456', new Error('Failed'))
 * ```
 */

/**
 * Status of a deferred entry
 */
export type DeferredStatus = 'pending' | 'running' | 'completed' | 'failed'

/**
 * Deferred entry stored in the registry
 */
export interface DeferredEntry<T = unknown> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
  status: DeferredStatus
  value: T | Error | undefined
  timestamp: number
}

/**
 * Kernel interface for event emission
 */
export interface DeferredKernel {
  emit: (event: string, data: unknown) => void
}

/**
 * DeferredRegistry options
 */
export interface DeferredRegistryOptions {
  kernel?: DeferredKernel | null
  debug?: boolean
}

/**
 * Entry info returned by entries()
 */
export interface DeferredEntryInfo {
  key: string
  status: DeferredStatus
  timestamp: number
}

export class DeferredRegistry {
  private _entries: Map<string, DeferredEntry>
  private _kernel: DeferredKernel | null
  private _debug: boolean

  /**
   * @param options - Registry options
   */
  constructor(options: DeferredRegistryOptions = {}) {
    this._entries = new Map()
    this._kernel = options.kernel || null
    this._debug = options.debug || false
  }

  /**
   * Get or create a deferred entry for a key
   * @param key - Unique identifier
   * @returns Deferred entry
   */
  private _getOrCreate<T = unknown>(key: string): DeferredEntry<T> {
    if (!this._entries.has(key)) {
      let resolve!: (value: T) => void
      let reject!: (error: Error) => void
      const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
      })

      const entry: DeferredEntry<T> = {
        promise,
        resolve,
        reject,
        status: 'pending',
        value: undefined,
        timestamp: Date.now(),
      }

      this._entries.set(key, entry as DeferredEntry)

      if (this._debug) {
        console.debug(`[deferred] Created entry: ${key}`)
      }
    }

    return this._entries.get(key) as DeferredEntry<T>
  }

  /**
   * Get the promise for a key (creates if doesn't exist)
   * Can be called BEFORE queue() - promise resolves when task completes
   *
   * @param key - Unique identifier
   * @returns Promise that resolves when the deferred completes
   */
  await<T = unknown>(key: string): Promise<T> {
    return this._getOrCreate<T>(key).promise
  }

  /**
   * Queue a task for execution
   * If already running/completed, returns existing promise (deduplication)
   *
   * @param key - Unique identifier
   * @param executor - Async function to execute
   * @returns Promise that resolves with task result
   */
  queue<T = unknown>(key: string, executor: () => Promise<T> | T): Promise<T> {
    const entry = this._getOrCreate<T>(key)

    // Already started - return existing promise (idempotent)
    if (entry.status !== 'pending') {
      if (this._debug) {
        console.debug(`[deferred] Already ${entry.status}: ${key}`)
      }
      return entry.promise
    }

    entry.status = 'running'
    this._emit('deferred:started', { key })

    if (this._debug) {
      console.debug(`[deferred] Started: ${key}`)
    }

    // Execute and handle result
    Promise.resolve()
      .then(() => executor())
      .then((value) => {
        entry.status = 'completed'
        entry.value = value
        entry.resolve(value)
        this._emit('deferred:completed', { key, value })

        if (this._debug) {
          console.debug(`[deferred] Completed: ${key}`)
        }
      })
      .catch((error: Error) => {
        entry.status = 'failed'
        entry.value = error
        entry.reject(error)
        this._emit('deferred:failed', { key, error })

        if (this._debug) {
          console.debug(`[deferred] Failed: ${key}`, error)
        }
      })

    return entry.promise
  }

  /**
   * Resolve a deferred externally (for SSE, webhooks, etc.)
   * No-op if already completed/failed
   *
   * @param key - Unique identifier
   * @param value - Value to resolve with
   * @returns True if resolved, false if already settled
   */
  resolve<T = unknown>(key: string, value: T): boolean {
    const entry = this._getOrCreate<T>(key)

    if (entry.status === 'completed' || entry.status === 'failed') {
      if (this._debug) {
        console.debug(`[deferred] Cannot resolve (already ${entry.status}): ${key}`)
      }
      return false
    }

    entry.status = 'completed'
    entry.value = value
    entry.resolve(value)
    this._emit('deferred:completed', { key, value })

    if (this._debug) {
      console.debug(`[deferred] Resolved externally: ${key}`)
    }

    return true
  }

  /**
   * Reject a deferred externally (for SSE, webhooks, etc.)
   * No-op if already completed/failed
   *
   * @param key - Unique identifier
   * @param error - Error to reject with
   * @returns True if rejected, false if already settled
   */
  reject(key: string, error: Error): boolean {
    const entry = this._getOrCreate(key)

    if (entry.status === 'completed' || entry.status === 'failed') {
      if (this._debug) {
        console.debug(`[deferred] Cannot reject (already ${entry.status}): ${key}`)
      }
      return false
    }

    entry.status = 'failed'
    entry.value = error
    entry.reject(error)
    this._emit('deferred:failed', { key, error })

    if (this._debug) {
      console.debug(`[deferred] Rejected externally: ${key}`)
    }

    return true
  }

  /**
   * Check if a key exists in the registry
   * @param key - Unique identifier
   * @returns True if entry exists
   */
  has(key: string): boolean {
    return this._entries.has(key)
  }

  /**
   * Get the status of a deferred
   * @param key - Unique identifier
   * @returns Status or null if not found
   */
  status(key: string): DeferredStatus | null {
    return this._entries.get(key)?.status || null
  }

  /**
   * Get the resolved value (only if completed)
   * @param key - Unique identifier
   * @returns Value or undefined
   */
  value<T = unknown>(key: string): T | undefined {
    const entry = this._entries.get(key)
    return entry?.status === 'completed' ? (entry.value as T) : undefined
  }

  /**
   * Check if a deferred is settled (completed or failed)
   * @param key - Unique identifier
   * @returns True if settled
   */
  isSettled(key: string): boolean {
    const status = this.status(key)
    return status === 'completed' || status === 'failed'
  }

  /**
   * Get all keys in the registry
   * @returns Array of keys
   */
  keys(): string[] {
    return Array.from(this._entries.keys())
  }

  /**
   * Get all entries with their status
   * @returns Array of entry info
   */
  entries(): DeferredEntryInfo[] {
    return Array.from(this._entries.entries()).map(([key, entry]) => ({
      key,
      status: entry.status,
      timestamp: entry.timestamp,
    }))
  }

  /**
   * Clear a specific entry (for cleanup/retry)
   * @param key - Unique identifier
   * @returns True if cleared
   */
  clear(key: string): boolean {
    return this._entries.delete(key)
  }

  /**
   * Clear all entries
   */
  clearAll(): void {
    this._entries.clear()
  }

  /**
   * Emit event via kernel (if provided)
   * @private
   */
  private _emit(event: string, data: unknown): void {
    if (this._kernel) {
      this._kernel.emit(event, data)
    }
  }

  /**
   * Set kernel for event emission
   * @param kernel - Kernel instance with emit method
   */
  setKernel(kernel: DeferredKernel): void {
    this._kernel = kernel
  }

  /**
   * Enable/disable debug mode
   * @param enabled - Debug mode flag
   */
  debug(enabled: boolean): void {
    this._debug = enabled
  }
}

/**
 * Factory function
 * @param options - Registry options
 * @returns New DeferredRegistry instance
 */
export function createDeferredRegistry(options: DeferredRegistryOptions = {}): DeferredRegistry {
  return new DeferredRegistry(options)
}
