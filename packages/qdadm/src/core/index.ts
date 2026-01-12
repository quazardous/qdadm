/**
 * Core Module
 *
 * Extension and helper utilities for qdadm modules.
 */

export {
  extendModule,
  ExtensionBuilder,
  type ExtensionColumn,
  type ExtensionField,
  type ExtensionFilter,
  type ExtensionBlock,
  type ExtensionsConfig,
  type ExtensionContext,
  type CollectedExtensions,
} from './extension'

export {
  createDecoratedManager,
  withValidation,
  withAuditLog as withAuditLogDecorator,
  withSoftDelete as withSoftDeleteDecorator,
  withTimestamps as withTimestampsDecorator,
  type DecoratorEntityManager,
  type ManagerDecorator,
  type AuditLogDetails,
  type AuditLogger,
  type AuditLogDecoratorOptions,
  type SoftDeleteDecoratorOptions,
  type TimestampDecoratorOptions,
  type ValidationContext,
  type ValidationErrors,
  type ValidatorFn,
  type ValidationError,
  type ValidationDecoratorOptions,
} from './decorator'

export {
  createHookBundle,
  applyBundle,
  applyBundles,
  withSoftDelete,
  withTimestamps,
  withVersioning,
  withAuditLog,
  type BundleRegisterFn,
  type BundleContext,
  type BundleSetupFn,
  type Bundle,
  type BundleFactory,
  type ApplyBundleContext,
  type SoftDeleteOptions,
  type TimestampOptions,
  type VersioningOptions,
  type VersionConflictError,
  type AuditLogOptions,
  type AuditLogEntry,
} from './bundles'
