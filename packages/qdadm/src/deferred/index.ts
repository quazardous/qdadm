/**
 * Deferred Module
 *
 * Named promise registry for loose async coupling between services and components.
 *
 * @experimental Shape may change in a minor release — see
 * docs/API_STABILITY.md.
 *
 * @module deferred
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
