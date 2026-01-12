/**
 * useDeferred - Access the DeferredRegistry from components
 *
 * Provides loose async coupling between services and components.
 * Components can await dependencies without knowing when they're loaded.
 *
 * @example
 * ```ts
 * import { useDeferred } from 'qdadm/composables'
 *
 * // In a component
 * const deferred = useDeferred()
 *
 * // Await a single dependency
 * const config = await deferred.await('config')
 *
 * // Await multiple dependencies
 * const [users, settings] = await Promise.all([
 *   deferred.await('users-service'),
 *   deferred.await('settings')
 * ])
 *
 * // Check status without waiting
 * if (deferred.isSettled('config')) {
 *   const config = deferred.value('config')
 * }
 * ```
 */

import { inject, ref, type Ref } from 'vue'
import type { DeferredRegistry } from '../deferred/DeferredRegistry'

/**
 * Injection key for DeferredRegistry
 */
export const DEFERRED_INJECTION_KEY = 'qdadmDeferred'

/**
 * Get the DeferredRegistry instance
 * @returns The DeferredRegistry instance
 */
export function useDeferred(): DeferredRegistry {
  const deferred = inject<DeferredRegistry | null>(DEFERRED_INJECTION_KEY)

  if (!deferred) {
    throw new Error(
      '[useDeferred] DeferredRegistry not found. ' +
        'Make sure you are using the Kernel to bootstrap your app.'
    )
  }

  return deferred
}

/**
 * Return type for useDeferredValue
 */
export interface UseDeferredValueReturn<T> {
  data: Ref<T | null>
  loading: Ref<boolean>
  error: Ref<Error | null>
}

/**
 * Helper: await a deferred value in setup
 * Returns a ref that updates when the deferred resolves
 *
 * @example
 * ```ts
 * const { data: config, loading, error } = useDeferredValue('config')
 * ```
 *
 * @param key - Deferred key
 * @returns Object with data, loading, and error refs
 */
export function useDeferredValue<T = unknown>(key: string): UseDeferredValueReturn<T> {
  const deferred = useDeferred()
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(true)
  const error = ref<Error | null>(null)

  deferred
    .await<T>(key)
    .then((value) => {
      data.value = value
      loading.value = false
    })
    .catch((err: Error) => {
      error.value = err
      loading.value = false
    })

  return { data, loading, error }
}
