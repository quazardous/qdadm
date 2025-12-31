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
 * ```js
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
 * @typedef {'pending' | 'running' | 'completed' | 'failed'} DeferredStatus
 */

/**
 * @typedef {object} DeferredEntry
 * @property {Promise} promise - The deferred promise
 * @property {function} resolve - Resolve function
 * @property {function} reject - Reject function
 * @property {DeferredStatus} status - Current status
 * @property {any} value - Resolved value or error
 * @property {number} timestamp - Creation timestamp
 */

export class DeferredRegistry {
  /**
   * @param {object} options
   * @param {object} [options.kernel] - Optional QuarKernel for event emission
   * @param {boolean} [options.debug=false] - Enable debug logging
   */
  constructor(options = {}) {
    this._entries = new Map()
    this._kernel = options.kernel || null
    this._debug = options.debug || false
  }

  /**
   * Get or create a deferred entry for a key
   * @param {string} key - Unique identifier
   * @returns {DeferredEntry}
   */
  _getOrCreate(key) {
    if (!this._entries.has(key)) {
      let resolve, reject
      const promise = new Promise((res, rej) => {
        resolve = res
        reject = rej
      })

      const entry = {
        promise,
        resolve,
        reject,
        status: 'pending',
        value: undefined,
        timestamp: Date.now()
      }

      this._entries.set(key, entry)

      if (this._debug) {
        console.debug(`[deferred] Created entry: ${key}`)
      }
    }

    return this._entries.get(key)
  }

  /**
   * Get the promise for a key (creates if doesn't exist)
   * Can be called BEFORE queue() - promise resolves when task completes
   *
   * @param {string} key - Unique identifier
   * @returns {Promise<any>}
   */
  await(key) {
    return this._getOrCreate(key).promise
  }

  /**
   * Queue a task for execution
   * If already running/completed, returns existing promise (deduplication)
   *
   * @param {string} key - Unique identifier
   * @param {function(): Promise<any>} executor - Async function to execute
   * @returns {Promise<any>} Promise that resolves with task result
   */
  queue(key, executor) {
    const entry = this._getOrCreate(key)

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
      .then(value => {
        entry.status = 'completed'
        entry.value = value
        entry.resolve(value)
        this._emit('deferred:completed', { key, value })

        if (this._debug) {
          console.debug(`[deferred] Completed: ${key}`)
        }
      })
      .catch(error => {
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
   * @param {string} key - Unique identifier
   * @param {any} value - Value to resolve with
   * @returns {boolean} True if resolved, false if already settled
   */
  resolve(key, value) {
    const entry = this._getOrCreate(key)

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
   * @param {string} key - Unique identifier
   * @param {Error} error - Error to reject with
   * @returns {boolean} True if rejected, false if already settled
   */
  reject(key, error) {
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
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this._entries.has(key)
  }

  /**
   * Get the status of a deferred
   * @param {string} key
   * @returns {DeferredStatus|null} Status or null if not found
   */
  status(key) {
    return this._entries.get(key)?.status || null
  }

  /**
   * Get the resolved value (only if completed)
   * @param {string} key
   * @returns {any} Value or undefined
   */
  value(key) {
    const entry = this._entries.get(key)
    return entry?.status === 'completed' ? entry.value : undefined
  }

  /**
   * Check if a deferred is settled (completed or failed)
   * @param {string} key
   * @returns {boolean}
   */
  isSettled(key) {
    const status = this.status(key)
    return status === 'completed' || status === 'failed'
  }

  /**
   * Get all keys in the registry
   * @returns {string[]}
   */
  keys() {
    return Array.from(this._entries.keys())
  }

  /**
   * Get all entries with their status
   * @returns {Array<{key: string, status: DeferredStatus, timestamp: number}>}
   */
  entries() {
    return Array.from(this._entries.entries()).map(([key, entry]) => ({
      key,
      status: entry.status,
      timestamp: entry.timestamp
    }))
  }

  /**
   * Clear a specific entry (for cleanup/retry)
   * @param {string} key
   * @returns {boolean} True if cleared
   */
  clear(key) {
    return this._entries.delete(key)
  }

  /**
   * Clear all entries
   */
  clearAll() {
    this._entries.clear()
  }

  /**
   * Emit event via kernel (if provided)
   * @private
   */
  _emit(event, data) {
    if (this._kernel) {
      this._kernel.emit(event, data)
    }
  }

  /**
   * Set kernel for event emission
   * @param {object} kernel - QuarKernel instance
   */
  setKernel(kernel) {
    this._kernel = kernel
  }

  /**
   * Enable/disable debug mode
   * @param {boolean} enabled
   */
  debug(enabled) {
    this._debug = enabled
  }
}

/**
 * Factory function
 * @param {object} options
 * @returns {DeferredRegistry}
 */
export function createDeferredRegistry(options = {}) {
  return new DeferredRegistry(options)
}
