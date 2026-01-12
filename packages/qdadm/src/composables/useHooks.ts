/**
 * useHooks - Access the hook registry for Drupal-inspired extensibility
 *
 * Provides access to the HookRegistry created by Kernel during bootstrap.
 * Components can register and invoke hooks without direct imports.
 *
 * @returns The hook registry instance or null if not available
 *
 * @example
 * // Register a lifecycle hook
 * const hooks = useHooks()
 * hooks.register('entity:presave', async (event) => {
 *   event.data.entity.updated_at = Date.now()
 * }, { priority: 10 })
 *
 * @example
 * // Register an alter hook
 * const hooks = useHooks()
 * hooks.register('list:alter', (config) => {
 *   config.columns.push({ field: 'custom' })
 *   return config
 * })
 *
 * @example
 * // Invoke hooks
 * const hooks = useHooks()
 *
 * // Lifecycle hook (fire-and-forget)
 * await hooks.invoke('entity:presave', { entity, manager })
 *
 * // Alter hook (chained transforms)
 * const config = await hooks.alter('list:alter', baseConfig)
 *
 * @example
 * // Auto-cleanup on unmount
 * import { onUnmounted } from 'vue'
 *
 * const hooks = useHooks()
 * const unbind = hooks.register('entity:created', handler)
 * onUnmounted(() => unbind())
 */
import { inject } from 'vue'
import type { HookRegistry } from '../hooks/HookRegistry'

export function useHooks(): HookRegistry | null {
  const hooks = inject<HookRegistry | null>('qdadmHooks', null)

  if (!hooks) {
    console.warn(
      '[qdadm] useHooks: hook registry not available. Ensure Kernel is initialized.'
    )
    return null
  }

  return hooks
}
