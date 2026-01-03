/**
 * ProtectedStorage - Storage wrapper that simulates API authentication
 *
 * Wraps any storage and checks authentication before each operation.
 * Throws 401-like errors when user is not authenticated.
 *
 * This simulates how a real backend API would protect endpoints.
 */

/**
 * API-like error with HTTP status code
 */
export class ApiError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Create a protected storage wrapper
 *
 * @param {object} storage - The underlying storage to wrap
 * @param {object} options - Protection options
 * @param {function} options.isAuthenticated - Function that returns true if user is authenticated
 * @param {string} [options.entityName] - Entity name for error messages
 * @returns {object} - Wrapped storage with auth checks
 */
export function createProtectedStorage(storage, { isAuthenticated, entityName = 'entity' }) {
  const checkAuth = () => {
    if (!isAuthenticated()) {
      throw new ApiError(`Unauthorized: Authentication required to access ${entityName}`, 401)
    }
  }

  // Create proxy that intercepts all methods
  return new Proxy(storage, {
    get(target, prop) {
      const value = target[prop]

      // Only wrap async methods that access data
      if (typeof value === 'function' && ['list', 'get', 'create', 'update', 'delete'].includes(prop)) {
        return async (...args) => {
          checkAuth()
          return value.apply(target, args)
        }
      }

      return value
    }
  })
}
