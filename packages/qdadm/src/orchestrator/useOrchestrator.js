/**
 * useOrchestrator - Composable to access the Orchestrator
 *
 * Usage:
 * ```js
 * const { orchestrator, getManager } = useOrchestrator()
 *
 * // Get a specific manager
 * const usersManager = getManager('users')
 *
 * // Use it
 * const { items } = await usersManager.list({ page: 1 })
 * ```
 */
import { inject } from 'vue'

export function useOrchestrator() {
  const orchestrator = inject('qdadmOrchestrator')

  if (!orchestrator) {
    throw new Error(
      '[qdadm] Orchestrator not provided.\n' +
      'Possible causes:\n' +
      '1. Kernel not initialized - ensure createKernel().createApp() is called before mounting\n' +
      '2. Component used outside of qdadm app context\n' +
      '3. Missing entityFactory in Kernel options'
    )
  }

  /**
   * Get an EntityManager by name
   * @param {string} name - Entity name
   * @returns {EntityManager}
   */
  function getManager(name) {
    return orchestrator.get(name)
  }

  /**
   * Check if a manager exists
   * @param {string} name - Entity name
   * @returns {boolean}
   */
  function hasManager(name) {
    return orchestrator.has(name)
  }

  return {
    orchestrator,
    getManager,
    hasManager
  }
}

/**
 * useEntity - Shorthand composable to get a specific EntityManager
 *
 * Usage:
 * ```js
 * const users = useEntity('users')
 * const { items } = await users.list()
 * ```
 */
export function useEntity(name) {
  const { getManager } = useOrchestrator()
  return getManager(name)
}
