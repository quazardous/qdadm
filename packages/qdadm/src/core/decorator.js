/**
 * EntityManager Decorator Pattern Utilities
 *
 * Decorators wrap an EntityManager to add cross-cutting concerns
 * (auditing, caching, soft-delete) without modifying the base class.
 *
 * Key concepts:
 * - Decorators receive a manager and return an enhanced manager
 * - Decorators compose: first wraps closest to base, last wraps outermost
 * - Each decorator intercepts CRUD operations, adds behavior, delegates to wrapped manager
 *
 * @example
 * // Single decorator
 * const auditedBooks = createDecoratedManager(booksManager, [
 *   withAuditLog(console.log)
 * ])
 *
 * @example
 * // Stacked decorators (order matters: audit wraps cache wraps base)
 * const enhancedBooks = createDecoratedManager(booksManager, [
 *   withCache({ ttl: 60000 }),
 *   withAuditLog(logger.info)
 * ])
 */

/**
 * Apply a chain of decorators to an EntityManager
 *
 * Decorators are applied in order: first decorator wraps the base manager,
 * second wraps the first, etc. This means the last decorator in the array
 * is the outermost layer (executed first on method calls).
 *
 * @param {EntityManager} manager - Base EntityManager to decorate
 * @param {Function[]} decorators - Array of decorator functions
 * @returns {EntityManager} - Decorated manager
 *
 * @example
 * // Decorator function signature
 * const myDecorator = (options) => (manager) => {
 *   return {
 *     ...manager,
 *     async create(data) {
 *       // Pre-processing
 *       const result = await manager.create(data)
 *       // Post-processing
 *       return result
 *     }
 *   }
 * }
 */
export function createDecoratedManager(manager, decorators = []) {
  if (!manager) {
    throw new Error('[createDecoratedManager] Manager is required')
  }
  if (!Array.isArray(decorators)) {
    throw new Error('[createDecoratedManager] Decorators must be an array')
  }

  // Apply decorators in sequence (first wraps base, last is outermost)
  return decorators.reduce((decorated, decorator) => {
    if (typeof decorator !== 'function') {
      throw new Error('[createDecoratedManager] Each decorator must be a function')
    }
    return decorator(decorated)
  }, manager)
}

/**
 * Audit log decorator factory
 *
 * Logs CRUD operations with timestamps. Useful for tracking changes,
 * debugging, or audit trails.
 *
 * @param {Function} logger - Logging function (receives action, details)
 * @param {object} [options] - Options
 * @param {boolean} [options.includeData=false] - Include record data in logs
 * @returns {Function} Decorator function
 *
 * @example
 * const auditedManager = createDecoratedManager(manager, [
 *   withAuditLog(console.log)
 * ])
 *
 * @example
 * // With custom logger
 * const auditedManager = createDecoratedManager(manager, [
 *   withAuditLog((action, details) => {
 *     auditService.log({ action, ...details, timestamp: new Date() })
 *   }, { includeData: true })
 * ])
 */
export function withAuditLog(logger, options = {}) {
  if (typeof logger !== 'function') {
    throw new Error('[withAuditLog] Logger must be a function')
  }

  const { includeData = false } = options

  return (manager) => {
    const entityName = manager.name

    const logAction = (action, details) => {
      logger(action, {
        entity: entityName,
        timestamp: new Date().toISOString(),
        ...details
      })
    }

    return {
      // Preserve all manager properties and methods
      ...manager,
      // Ensure name is accessible (might be a getter)
      get name() { return manager.name },

      async create(data) {
        const result = await manager.create(data)
        const logDetails = { id: result?.[manager.idField] }
        if (includeData) logDetails.data = data
        logAction('create', logDetails)
        return result
      },

      async update(id, data) {
        const result = await manager.update(id, data)
        const logDetails = { id }
        if (includeData) logDetails.data = data
        logAction('update', logDetails)
        return result
      },

      async patch(id, data) {
        const result = await manager.patch(id, data)
        const logDetails = { id }
        if (includeData) logDetails.data = data
        logAction('patch', logDetails)
        return result
      },

      async delete(id) {
        await manager.delete(id)
        logAction('delete', { id })
      }
    }
  }
}

/**
 * Soft delete decorator factory
 *
 * Converts delete() to update with deleted_at timestamp.
 * Useful for audit trails, undo functionality, or legal compliance.
 *
 * @param {object} [options] - Options
 * @param {string} [options.field='deleted_at'] - Field name for deletion timestamp
 * @param {Function} [options.timestamp] - Custom timestamp function (default: ISO string)
 * @returns {Function} Decorator function
 *
 * @example
 * const softDeleteManager = createDecoratedManager(manager, [
 *   withSoftDelete()
 * ])
 *
 * // Instead of deleting, sets deleted_at
 * await softDeleteManager.delete(1)
 * // Record: { id: 1, ..., deleted_at: '2024-01-01T00:00:00.000Z' }
 *
 * @example
 * // Custom field and timestamp
 * const softDeleteManager = createDecoratedManager(manager, [
 *   withSoftDelete({
 *     field: 'removed_at',
 *     timestamp: () => Date.now()
 *   })
 * ])
 */
export function withSoftDelete(options = {}) {
  const {
    field = 'deleted_at',
    timestamp = () => new Date().toISOString()
  } = options

  return (manager) => ({
    ...manager,
    get name() { return manager.name },

    async delete(id) {
      // Convert delete to update with soft-delete field
      return manager.patch(id, { [field]: timestamp() })
    }
  })
}

/**
 * Timestamp decorator factory
 *
 * Automatically adds created_at and updated_at timestamps to records.
 *
 * @param {object} [options] - Options
 * @param {string} [options.createdAtField='created_at'] - Field for creation timestamp
 * @param {string} [options.updatedAtField='updated_at'] - Field for update timestamp
 * @param {Function} [options.timestamp] - Custom timestamp function
 * @returns {Function} Decorator function
 *
 * @example
 * const timestampedManager = createDecoratedManager(manager, [
 *   withTimestamps()
 * ])
 *
 * await timestampedManager.create({ title: 'Test' })
 * // Record: { title: 'Test', created_at: '...', updated_at: '...' }
 *
 * await timestampedManager.update(1, { title: 'Updated' })
 * // Record: { title: 'Updated', updated_at: '...' }
 */
export function withTimestamps(options = {}) {
  const {
    createdAtField = 'created_at',
    updatedAtField = 'updated_at',
    timestamp = () => new Date().toISOString()
  } = options

  return (manager) => ({
    ...manager,
    get name() { return manager.name },

    async create(data) {
      const now = timestamp()
      return manager.create({
        ...data,
        [createdAtField]: now,
        [updatedAtField]: now
      })
    },

    async update(id, data) {
      return manager.update(id, {
        ...data,
        [updatedAtField]: timestamp()
      })
    },

    async patch(id, data) {
      return manager.patch(id, {
        ...data,
        [updatedAtField]: timestamp()
      })
    }
  })
}

/**
 * Validation decorator factory
 *
 * Validates data before create/update operations.
 * Throws ValidationError if validation fails.
 *
 * @param {Function} validator - Validation function (data, context) => errors | null
 * @param {object} [options] - Options
 * @param {boolean} [options.onUpdate=true] - Validate on update
 * @param {boolean} [options.onPatch=true] - Validate on patch
 * @returns {Function} Decorator function
 *
 * @example
 * const validatedManager = createDecoratedManager(manager, [
 *   withValidation((data) => {
 *     const errors = {}
 *     if (!data.title) errors.title = 'Title is required'
 *     if (data.price < 0) errors.price = 'Price must be positive'
 *     return Object.keys(errors).length ? errors : null
 *   })
 * ])
 *
 * await validatedManager.create({ price: -5 })
 * // Throws: ValidationError { errors: { title: '...', price: '...' } }
 */
export function withValidation(validator, options = {}) {
  if (typeof validator !== 'function') {
    throw new Error('[withValidation] Validator must be a function')
  }

  const {
    onUpdate = true,
    onPatch = true
  } = options

  return (manager) => {
    const validate = (data, context) => {
      const errors = validator(data, context)
      if (errors && Object.keys(errors).length > 0) {
        const error = new Error('Validation failed')
        error.name = 'ValidationError'
        error.errors = errors
        throw error
      }
    }

    return {
      ...manager,
      get name() { return manager.name },

      async create(data) {
        validate(data, { action: 'create', manager })
        return manager.create(data)
      },

      async update(id, data) {
        if (onUpdate) {
          validate(data, { action: 'update', id, manager })
        }
        return manager.update(id, data)
      },

      async patch(id, data) {
        if (onPatch) {
          validate(data, { action: 'patch', id, manager })
        }
        return manager.patch(id, data)
      }
    }
  }
}
