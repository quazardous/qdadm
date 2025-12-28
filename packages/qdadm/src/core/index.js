/**
 * Core Module
 *
 * Extension and helper utilities for qdadm modules.
 */

export {
  extendModule,
  ExtensionBuilder,
} from './extension.js'

export {
  createDecoratedManager,
  withAuditLog as withAuditLogDecorator,
  withSoftDelete as withSoftDeleteDecorator,
  withTimestamps as withTimestampsDecorator,
  withValidation,
} from './decorator.js'

export {
  createHookBundle,
  applyBundle,
  applyBundles,
  withSoftDelete,
  withTimestamps,
  withVersioning,
  withAuditLog,
} from './bundles.js'
