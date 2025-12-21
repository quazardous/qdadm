/**
 * useManager - Access EntityManager by name
 *
 * @param {string} entityName - Entity name (e.g., 'jobs', 'stories')
 * @returns {EntityManager|null} - The entity manager or null if not found
 *
 * @example
 * const jobs = useManager('jobs')
 * const severity = jobs.getSeverity('status', 'completed')
 */
import { inject } from 'vue'

export function useManager(entityName) {
  const orchestrator = inject('qdadmOrchestrator')
  if (!orchestrator) {
    console.warn('[qdadm] useManager: orchestrator not available')
    return null
  }
  return orchestrator.get(entityName)
}
