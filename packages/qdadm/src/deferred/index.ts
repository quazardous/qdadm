/**
 * Deferred Module
 *
 * Named promise registry for loose async coupling between services and components.
 */

export {
  DeferredRegistry,
  createDeferredRegistry,
  type DeferredStatus,
  type DeferredEntry,
  type DeferredKernel,
  type DeferredRegistryOptions,
  type DeferredEntryInfo,
} from './DeferredRegistry'
