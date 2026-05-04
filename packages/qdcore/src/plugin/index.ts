/**
 * @quazardous/qdcore/plugin — public exports.
 *
 * The agnostic plugin layer. See `./types.ts` for the design rationale.
 * Higher layers (qdcms, qdadm) extend `Plugin` with their own scope shape.
 */

export {
  PluginError,
  PluginConflictError,
  PluginDependencyError,
  PluginValidationError,
} from './types'

export type {
  PluginId,
  PluginPrefix,
  PluginVersion,
  PluginDependency,
  PluginManifest,
  PluginLifecycleEvent,
  PluginLifecycleHooks,
  Plugin,
  PluginContext,
  PluginState,
  PluginEntry,
  PluginRegistry,
} from './types'

export {
  isValidPluginId,
  isValidPluginPrefix,
  isValidSemver,
  validateManifest,
} from './validation'

export { InMemoryPluginRegistry } from './InMemoryPluginRegistry'
