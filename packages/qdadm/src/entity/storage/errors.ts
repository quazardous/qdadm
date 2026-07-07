/**
 * Storage error types (#1192) — moved out of MemoryStorage so sibling
 * adapters no longer cross-import from one another.
 */

/** Error with an HTTP-like status code, thrown by storage adapters. */
export class StorageError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'StorageError'
    this.status = status
  }
}
