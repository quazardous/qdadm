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
