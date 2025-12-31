/**
 * useDeferred - Access the DeferredRegistry from components
 *
 * Provides loose async coupling between services and components.
 * Components can await dependencies without knowing when they're loaded.
 *
 * @example
 * ```js
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

import { inject } from 'vue'

/**
 * Injection key for DeferredRegistry
 */
export const DEFERRED_INJECTION_KEY = 'qdadmDeferred'

/**
 * Get the DeferredRegistry instance
 * @returns {import('../deferred/DeferredRegistry.js').DeferredRegistry}
 */
export function useDeferred() {
  const deferred = inject(DEFERRED_INJECTION_KEY)

  if (!deferred) {
    throw new Error(
      '[useDeferred] DeferredRegistry not found. ' +
      'Make sure you are using the Kernel to bootstrap your app.'
    )
  }

  return deferred
}

/**
 * Helper: await a deferred value in setup
 * Returns a ref that updates when the deferred resolves
 *
 * @example
 * ```js
 * const { data: config, loading, error } = useDeferredValue('config')
 * ```
 *
 * @param {string} key - Deferred key
 * @returns {{ data: Ref, loading: Ref<boolean>, error: Ref<Error|null> }}
 */
export function useDeferredValue(key) {
  const deferred = useDeferred()
  const data = ref(null)
  const loading = ref(true)
  const error = ref(null)

  deferred.await(key)
    .then(value => {
      data.value = value
      loading.value = false
    })
    .catch(err => {
      error.value = err
      loading.value = false
    })

  return { data, loading, error }
}

import { ref } from 'vue'
