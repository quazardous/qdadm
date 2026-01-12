/**
 * useSignals - Access the signal bus for event-driven communication
 *
 * Provides access to the SignalBus created by Kernel during bootstrap.
 * Components can subscribe to signals without direct imports.
 *
 * @returns The signal bus instance or null if not available
 *
 * @example
 * // Basic usage
 * const signals = useSignals()
 * signals.on('entity:created', (payload) => {
 *   console.log('Entity created:', payload.entity, payload.data)
 * })
 *
 * @example
 * // Subscribe to specific entity
 * const signals = useSignals()
 * signals.on('books:updated', ({ data }) => {
 *   refreshBookList()
 * })
 *
 * @example
 * // Wildcard subscription
 * const signals = useSignals()
 * signals.on('*:deleted', ({ entity, data }) => {
 *   showDeletedNotification(entity)
 * })
 *
 * @example
 * // Auto-cleanup on unmount
 * import { onUnmounted } from 'vue'
 *
 * const signals = useSignals()
 * const unbind = signals.on('entity:created', handler)
 * onUnmounted(() => unbind())
 */
import { inject } from 'vue'
import type { SignalBus } from '../kernel/SignalBus'

export function useSignals(): SignalBus | null {
  const signals = inject<SignalBus | null>('qdadmSignals', null)

  if (!signals) {
    console.warn(
      '[qdadm] useSignals: signal bus not available. Ensure Kernel is initialized.'
    )
    return null
  }

  return signals
}
