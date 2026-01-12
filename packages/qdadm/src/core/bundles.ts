/**
 * Hook Bundle Pattern for qdadm
 *
 * A hook bundle is a function that registers multiple related hooks to implement
 * a complete feature (soft delete, audit trail, timestamps, versioning).
 *
 * Bundles are composable and can be applied to any entity via the hook system.
 * Unlike decorators that wrap a manager instance, bundles work globally through
 * hooks that react to entity lifecycle events.
 *
 * @example
 * // Define a custom bundle
 * const withMyFeature = createHookBundle('myFeature', (register, context) => {
 *   register('entity:presave', (event) => {
 *     event.data.entity.myField = 'value'
 *   })
 * })
 *
 * // Apply bundles to the kernel
 * const cleanup = applyBundles(kernel.hooks, [
 *   withSoftDelete(),
 *   withTimestamps(),
 *   withVersioning()
 * ])
 *
 * // Later: cleanup()  // Removes all bundle hooks
 */

import { HOOK_PRIORITY, type HookRegistry, type HookRegistrationOptions } from '../hooks/index'

/**
 * Bundle register function type
 */
export type BundleRegisterFn = (
  hookName: string,
  handler: (data: unknown) => unknown | Promise<unknown>,
  options?: HookRegistrationOptions
) => () => void

/**
 * Bundle context passed to setup function
 */
export interface BundleContext<T = Record<string, unknown>> {
  target: string
  options: T
  hooks: HookRegistry
}

/**
 * Bundle setup function type
 */
export type BundleSetupFn<T = Record<string, unknown>> = (
  register: BundleRegisterFn,
  context: BundleContext<T>
) => void

/**
 * Bundle instance
 */
export interface Bundle<T = Record<string, unknown>> {
  name: string
  options: T
  setup: BundleSetupFn<T>
}

/**
 * Bundle factory function type
 */
export type BundleFactory<T = Record<string, unknown>> = (options?: T) => Bundle<T>

/**
 * Apply bundle context
 */
export interface ApplyBundleContext {
  target?: string
}

/**
 * Create a hook bundle factory
 *
 * A bundle factory creates bundle instances with optional configuration.
 * The bundle itself registers hooks via the provided register function.
 *
 * @param name - Bundle name for identification and debugging
 * @param setup - Setup function: (register, context) => void
 * @returns Bundle factory: (options?) => Bundle
 *
 * @example
 * const withAudit = createHookBundle('audit', (register, context) => {
 *   const { logger = console.log } = context.options
 *
 *   register('entity:postsave', (event) => {
 *     logger('Saved:', event.data.entity)
 *   }, { priority: HOOK_PRIORITY.LOW })
 * })
 *
 * // Usage: withAudit({ logger: myLogger })
 */
export function createHookBundle<T = Record<string, unknown>>(
  name: string,
  setup: BundleSetupFn<T>
): BundleFactory<T> {
  if (!name || typeof name !== 'string') {
    throw new Error('[createHookBundle] Bundle name must be a non-empty string')
  }
  if (typeof setup !== 'function') {
    throw new Error('[createHookBundle] Setup must be a function')
  }

  // Return the bundle factory
  return function bundleFactory(options: T = {} as T): Bundle<T> {
    // Return the bundle instance (applied by applyBundle)
    return {
      name,
      options,
      setup,
    }
  }
}

/**
 * Apply a single bundle to a HookRegistry
 *
 * Registers all hooks defined by the bundle and returns a cleanup function.
 *
 * @param hooks - HookRegistry instance
 * @param bundle - Bundle instance from bundle factory
 * @param context - Additional context
 * @returns Cleanup function to remove all bundle hooks
 *
 * @example
 * const cleanup = applyBundle(kernel.hooks, withTimestamps())
 * // ... later
 * cleanup()
 */
export function applyBundle<T>(
  hooks: HookRegistry,
  bundle: Bundle<T>,
  context: ApplyBundleContext = {}
): () => void {
  if (!hooks || typeof hooks.register !== 'function') {
    throw new Error('[applyBundle] First argument must be a HookRegistry')
  }
  if (!bundle || !bundle.setup) {
    throw new Error('[applyBundle] Second argument must be a bundle instance')
  }

  const { target = '*' } = context
  const unbindFns: Array<() => void> = []

  // Create a register function that tracks all registrations
  const register: BundleRegisterFn = (hookName, handler, options = {}) => {
    // Prefix handler ID with bundle name for debugging
    const id = options.id
      ? `${bundle.name}:${options.id}`
      : `${bundle.name}:${hookName.replace(/:/g, '-')}`

    const unbind = hooks.register(hookName, handler, {
      ...options,
      id,
    })
    unbindFns.push(unbind)
    return unbind
  }

  // Execute bundle setup with context
  bundle.setup(register, {
    target,
    options: bundle.options,
    hooks,
  })

  // Return cleanup function
  return () => {
    for (const unbind of unbindFns) {
      unbind()
    }
    unbindFns.length = 0
  }
}

/**
 * Apply multiple bundles to a HookRegistry
 *
 * Convenience function to apply multiple bundles at once.
 *
 * @param hooks - HookRegistry instance
 * @param bundles - Array of bundle instances
 * @param context - Context passed to each bundle
 * @returns Combined cleanup function
 *
 * @example
 * const cleanup = applyBundles(kernel.hooks, [
 *   withTimestamps(),
 *   withSoftDelete({ field: 'deleted_at' }),
 *   withVersioning()
 * ])
 */
export function applyBundles(
  hooks: HookRegistry,
  bundles: Bundle[],
  context: ApplyBundleContext = {}
): () => void {
  if (!Array.isArray(bundles)) {
    throw new Error('[applyBundles] Bundles must be an array')
  }

  const cleanupFns = bundles.map((bundle) => applyBundle(hooks, bundle, context))

  return () => {
    for (const cleanup of cleanupFns) {
      cleanup()
    }
  }
}

// ============================================================================
// Built-in Bundles
// ============================================================================

/**
 * Entity manager interface for bundles
 */
interface BundleEntityManager {
  name: string
  idField?: string
  patch: (id: unknown, data: Record<string, unknown>) => Promise<unknown>
}

/**
 * Entity event data structure
 */
interface EntityEventData {
  entity: Record<string, unknown>
  manager: BundleEntityManager
  isNew?: boolean
  originalEntity?: Record<string, unknown>
  cancel?: () => void
}

/**
 * Soft delete bundle options
 */
export interface SoftDeleteOptions {
  field?: string
  timestamp?: () => string
}

/**
 * withSoftDelete bundle
 *
 * Prevents actual deletion by setting a deleted_at timestamp instead.
 * Also provides list filtering to exclude deleted records by default.
 *
 * Hooks registered:
 * - `entity:predelete` - Intercepts delete, sets deleted_at via patch
 * - `list:alter` - Filters out deleted records (unless includeDeleted option)
 *
 * @param options - Options
 * @returns Bundle instance
 *
 * @example
 * applyBundle(hooks, withSoftDelete())
 * applyBundle(hooks, withSoftDelete({ field: 'removed_at' }))
 */
export const withSoftDelete = createHookBundle<SoftDeleteOptions>(
  'softDelete',
  (register, context) => {
    const { field = 'deleted_at', timestamp = () => new Date().toISOString() } = context.options

    // Intercept delete operations
    register(
      'entity:predelete',
      (event) => {
        const { entity, manager, cancel } = (event as { data: EntityEventData }).data

        // Get entity ID
        const id = entity[manager.idField || 'id']

        // Cancel the actual delete
        cancel?.()

        // Set soft-delete timestamp via patch
        manager.patch(id, { [field]: timestamp() })
      },
      { priority: HOOK_PRIORITY.FIRST, id: 'intercept' }
    )

    // Filter deleted records from lists by default
    register(
      'list:alter',
      (config) => {
        const cfg = config as Record<string, unknown>
        // Add default filter unless explicitly including deleted
        if (!cfg.includeDeleted) {
          if (!cfg.filters) {
            cfg.filters = []
          }
          // Add filter: field is null (not deleted)
          ;(cfg.filters as unknown[]).push({
            field,
            operator: 'is_null',
            value: true,
            _bundleManaged: true,
          })
        }
        return config
      },
      { priority: HOOK_PRIORITY.LOW, id: 'filter-list' }
    )
  }
)

/**
 * Timestamp bundle options
 */
export interface TimestampOptions {
  createdAtField?: string
  updatedAtField?: string
  timestamp?: () => string
}

/**
 * withTimestamps bundle
 *
 * Automatically manages created_at and updated_at timestamps.
 *
 * Hooks registered:
 * - `entity:presave` - Sets created_at on new records, updated_at on all saves
 *
 * @param options - Options
 * @returns Bundle instance
 *
 * @example
 * applyBundle(hooks, withTimestamps())
 * applyBundle(hooks, withTimestamps({ createdAtField: 'createdAt' }))
 */
export const withTimestamps = createHookBundle<TimestampOptions>(
  'timestamps',
  (register, context) => {
    const {
      createdAtField = 'created_at',
      updatedAtField = 'updated_at',
      timestamp = () => new Date().toISOString(),
    } = context.options

    register(
      'entity:presave',
      (event) => {
        const { entity, isNew } = (event as { data: EntityEventData }).data
        const now = timestamp()

        // Set created_at only on new records
        if (isNew && !entity[createdAtField]) {
          entity[createdAtField] = now
        }

        // Always update updated_at
        entity[updatedAtField] = now
      },
      { priority: HOOK_PRIORITY.HIGH, id: 'set-timestamps' }
    )
  }
)

/**
 * Versioning bundle options
 */
export interface VersioningOptions {
  field?: string
  validateOnUpdate?: boolean
}

/**
 * Version conflict error
 */
export interface VersionConflictError extends Error {
  name: 'VersionConflictError'
  entityName: string
  expectedVersion: number
  actualVersion: number
}

/**
 * withVersioning bundle
 *
 * Implements optimistic locking via version field.
 * Increments version on each save and validates version matches for updates.
 *
 * Hooks registered:
 * - `entity:presave` - Increments version and validates for conflicts
 *
 * @param options - Options
 * @returns Bundle instance
 *
 * @example
 * applyBundle(hooks, withVersioning())
 * applyBundle(hooks, withVersioning({ field: '_version', validateOnUpdate: false }))
 */
export const withVersioning = createHookBundle<VersioningOptions>(
  'versioning',
  (register, context) => {
    const { field = 'version', validateOnUpdate = true } = context.options

    register(
      'entity:presave',
      async (event) => {
        const { entity, isNew, manager, originalEntity } = (event as { data: EntityEventData }).data

        if (isNew) {
          // New record: initialize version to 1
          entity[field] = 1
        } else {
          // Existing record: validate and increment version
          if (validateOnUpdate && originalEntity) {
            const currentVersion = entity[field] as number | undefined
            const originalVersion = originalEntity[field] as number | undefined

            // Check for version conflict
            if (currentVersion !== undefined && originalVersion !== undefined) {
              if (currentVersion !== originalVersion) {
                const error = new Error(
                  `Version conflict: expected ${originalVersion}, got ${currentVersion}`
                ) as VersionConflictError
                error.name = 'VersionConflictError'
                error.entityName = manager.name
                error.expectedVersion = originalVersion
                error.actualVersion = currentVersion
                throw error
              }
            }
          }

          // Increment version
          const currentVersion = (entity[field] as number) || 0
          entity[field] = currentVersion + 1
        }
      },
      { priority: HOOK_PRIORITY.HIGH, id: 'manage-version' }
    )
  }
)

/**
 * Audit log bundle options
 */
export interface AuditLogOptions {
  logger?: (entry: AuditLogEntry) => void
  includeData?: boolean
  includeDiff?: boolean
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  action: 'create' | 'update' | 'delete'
  timestamp: string
  entity: string
  id: unknown
  data?: Record<string, unknown>
  changes?: Record<string, { from: unknown; to: unknown }>
}

/**
 * withAuditLog bundle
 *
 * Logs all entity operations for audit trail.
 *
 * Hooks registered:
 * - `entity:postsave` - Logs create/update operations
 * - `entity:postdelete` - Logs delete operations
 *
 * @param options - Options
 * @returns Bundle instance
 *
 * @example
 * applyBundle(hooks, withAuditLog())
 * applyBundle(hooks, withAuditLog({ logger: auditService.log, includeData: true }))
 */
export const withAuditLog = createHookBundle<AuditLogOptions>('auditLog', (register, context) => {
  const { logger = console.log, includeData = false, includeDiff = false } = context.options

  const log = (action: AuditLogEntry['action'], details: Omit<AuditLogEntry, 'action' | 'timestamp'>) => {
    logger({
      action,
      timestamp: new Date().toISOString(),
      ...details,
    } as AuditLogEntry)
  }

  register(
    'entity:postsave',
    (event) => {
      const { entity, isNew, manager, originalEntity } = (event as { data: EntityEventData }).data
      const action: 'create' | 'update' = isNew ? 'create' : 'update'
      const id = entity[manager.idField || 'id']

      const details: Partial<AuditLogEntry> = {
        entity: manager.name,
        id,
      }

      if (includeData) {
        details.data = entity
      }

      if (includeDiff && !isNew && originalEntity) {
        details.changes = computeDiff(originalEntity, entity)
      }

      log(action, details as Omit<AuditLogEntry, 'action' | 'timestamp'>)
    },
    { priority: HOOK_PRIORITY.LAST, id: 'log-save' }
  )

  register(
    'entity:postdelete',
    (event) => {
      const { entity, manager } = (event as { data: EntityEventData }).data
      const id = entity[manager.idField || 'id']

      log('delete', {
        entity: manager.name,
        id,
        ...(includeData ? { data: entity } : {}),
      })
    },
    { priority: HOOK_PRIORITY.LAST, id: 'log-delete' }
  )
})

/**
 * Compute simple diff between two objects
 *
 * @param original - Original object
 * @param updated - Updated object
 * @returns Object with changed fields: { field: { from, to } }
 */
function computeDiff(
  original: Record<string, unknown>,
  updated: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {}
  const allKeys = new Set([...Object.keys(original), ...Object.keys(updated)])

  for (const key of allKeys) {
    const oldVal = original[key]
    const newVal = updated[key]

    // Simple equality check (handles primitives, not deep objects)
    if (oldVal !== newVal) {
      diff[key] = { from: oldVal, to: newVal }
    }
  }

  return diff
}
