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
 * Base entity manager interface for decorators
 */
export interface DecoratorEntityManager {
  name: string
  idField: string
  create: (data: Record<string, unknown>) => Promise<Record<string, unknown>>
  update: (id: unknown, data: Record<string, unknown>) => Promise<Record<string, unknown>>
  patch: (id: unknown, data: Record<string, unknown>) => Promise<Record<string, unknown>>
  delete: (id: unknown) => Promise<void>
  [key: string]: unknown
}

/**
 * Decorator function type
 */
export type ManagerDecorator = (manager: DecoratorEntityManager) => DecoratorEntityManager

/**
 * Apply a chain of decorators to an EntityManager
 *
 * Decorators are applied in order: first decorator wraps the base manager,
 * second wraps the first, etc. This means the last decorator in the array
 * is the outermost layer (executed first on method calls).
 *
 * @param manager - Base EntityManager to decorate
 * @param decorators - Array of decorator functions
 * @returns Decorated manager
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
export function createDecoratedManager(
  manager: DecoratorEntityManager,
  decorators: ManagerDecorator[] = []
): DecoratorEntityManager {
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
 * Audit log action details
 */
export interface AuditLogDetails {
  entity: string
  timestamp: string
  id?: unknown
  data?: Record<string, unknown>
}

/**
 * Audit log function type
 */
export type AuditLogger = (action: string, details: AuditLogDetails) => void

/**
 * Audit log decorator options
 */
export interface AuditLogDecoratorOptions {
  includeData?: boolean
}

/**
 * Audit log decorator factory
 *
 * Logs CRUD operations with timestamps. Useful for tracking changes,
 * debugging, or audit trails.
 *
 * @param logger - Logging function (receives action, details)
 * @param options - Options
 * @returns Decorator function
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
export function withAuditLog(
  logger: AuditLogger,
  options: AuditLogDecoratorOptions = {}
): ManagerDecorator {
  if (typeof logger !== 'function') {
    throw new Error('[withAuditLog] Logger must be a function')
  }

  const { includeData = false } = options

  return (manager: DecoratorEntityManager): DecoratorEntityManager => {
    const entityName = manager.name

    const logAction = (action: string, details: Partial<AuditLogDetails>) => {
      logger(action, {
        entity: entityName,
        timestamp: new Date().toISOString(),
        ...details,
      } as AuditLogDetails)
    }

    return {
      // Preserve all manager properties and methods
      ...manager,
      // Ensure name is accessible (might be a getter)
      get name() {
        return manager.name
      },

      async create(data: Record<string, unknown>) {
        const result = await manager.create(data)
        const logDetails: Partial<AuditLogDetails> = { id: result?.[manager.idField] }
        if (includeData) logDetails.data = data
        logAction('create', logDetails)
        return result
      },

      async update(id: unknown, data: Record<string, unknown>) {
        const result = await manager.update(id, data)
        const logDetails: Partial<AuditLogDetails> = { id }
        if (includeData) logDetails.data = data
        logAction('update', logDetails)
        return result
      },

      async patch(id: unknown, data: Record<string, unknown>) {
        const result = await manager.patch(id, data)
        const logDetails: Partial<AuditLogDetails> = { id }
        if (includeData) logDetails.data = data
        logAction('patch', logDetails)
        return result
      },

      async delete(id: unknown) {
        await manager.delete(id)
        logAction('delete', { id })
      },
    }
  }
}

/**
 * Soft delete decorator options
 */
export interface SoftDeleteDecoratorOptions {
  field?: string
  timestamp?: () => string | number
}

/**
 * Soft delete decorator factory
 *
 * Converts delete() to update with deleted_at timestamp.
 * Useful for audit trails, undo functionality, or legal compliance.
 *
 * @param options - Options
 * @returns Decorator function
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
export function withSoftDelete(options: SoftDeleteDecoratorOptions = {}): ManagerDecorator {
  const { field = 'deleted_at', timestamp = () => new Date().toISOString() } = options

  return (manager: DecoratorEntityManager): DecoratorEntityManager => ({
    ...manager,
    get name() {
      return manager.name
    },

    async delete(id: unknown) {
      // Convert delete to update with soft-delete field
      await manager.patch(id, { [field]: timestamp() })
    },
  })
}

/**
 * Timestamp decorator options
 */
export interface TimestampDecoratorOptions {
  createdAtField?: string
  updatedAtField?: string
  timestamp?: () => string
}

/**
 * Timestamp decorator factory
 *
 * Automatically adds created_at and updated_at timestamps to records.
 *
 * @param options - Options
 * @returns Decorator function
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
export function withTimestamps(options: TimestampDecoratorOptions = {}): ManagerDecorator {
  const {
    createdAtField = 'created_at',
    updatedAtField = 'updated_at',
    timestamp = () => new Date().toISOString(),
  } = options

  return (manager: DecoratorEntityManager): DecoratorEntityManager => ({
    ...manager,
    get name() {
      return manager.name
    },

    async create(data: Record<string, unknown>) {
      const now = timestamp()
      return manager.create({
        ...data,
        [createdAtField]: now,
        [updatedAtField]: now,
      })
    },

    async update(id: unknown, data: Record<string, unknown>) {
      return manager.update(id, {
        ...data,
        [updatedAtField]: timestamp(),
      })
    },

    async patch(id: unknown, data: Record<string, unknown>) {
      return manager.patch(id, {
        ...data,
        [updatedAtField]: timestamp(),
      })
    },
  })
}

/**
 * Validation context
 */
export interface ValidationContext {
  action: 'create' | 'update' | 'patch'
  id?: unknown
  manager: DecoratorEntityManager
}

/**
 * Validation errors
 */
export type ValidationErrors = Record<string, string>

/**
 * Validator function type
 */
export type ValidatorFn = (
  data: Record<string, unknown>,
  context: ValidationContext
) => ValidationErrors | null

/**
 * Validation error
 */
export interface ValidationError extends Error {
  name: 'ValidationError'
  errors: ValidationErrors
}

/**
 * Validation decorator options
 */
export interface ValidationDecoratorOptions {
  onUpdate?: boolean
  onPatch?: boolean
}

/**
 * Validation decorator factory
 *
 * Validates data before create/update operations.
 * Throws ValidationError if validation fails.
 *
 * @param validator - Validation function (data, context) => errors | null
 * @param options - Options
 * @returns Decorator function
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
export function withValidation(
  validator: ValidatorFn,
  options: ValidationDecoratorOptions = {}
): ManagerDecorator {
  if (typeof validator !== 'function') {
    throw new Error('[withValidation] Validator must be a function')
  }

  const { onUpdate = true, onPatch = true } = options

  return (manager: DecoratorEntityManager): DecoratorEntityManager => {
    const validate = (data: Record<string, unknown>, context: ValidationContext) => {
      const errors = validator(data, context)
      if (errors && Object.keys(errors).length > 0) {
        const error = new Error('Validation failed') as ValidationError
        error.name = 'ValidationError'
        error.errors = errors
        throw error
      }
    }

    return {
      ...manager,
      get name() {
        return manager.name
      },

      async create(data: Record<string, unknown>) {
        validate(data, { action: 'create', manager })
        return manager.create(data)
      },

      async update(id: unknown, data: Record<string, unknown>) {
        if (onUpdate) {
          validate(data, { action: 'update', id, manager })
        }
        return manager.update(id, data)
      },

      async patch(id: unknown, data: Record<string, unknown>) {
        if (onPatch) {
          validate(data, { action: 'patch', id, manager })
        }
        return manager.patch(id, data)
      },
    }
  }
}
