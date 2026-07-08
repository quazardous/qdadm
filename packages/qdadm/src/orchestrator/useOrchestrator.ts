/**
 * useOrchestrator - Composable to access the Orchestrator
 *
 * Usage:
 * ```ts
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
import type { Orchestrator } from './Orchestrator'
import type { EntityManager } from '../entity/EntityManager'
import type { EntityRecord } from '../types'
// Type-only circular import: QdadmManagerRegistry must live in the package
// entry (module augmentation does not merge through re-export aliases).
import type { QdadmManagerRegistry } from '../index'

/**
 * Return type for useOrchestrator
 *
 * `getManager` resolves through the consumer-augmentable
 * QdadmManagerRegistry first (#1253): a declared entity name returns its
 * concrete manager subclass; anything else falls back to the historical
 * `EntityManager<T>` signature.
 */
export interface UseOrchestratorReturn {
  orchestrator: Orchestrator
  getManager: {
    <K extends keyof QdadmManagerRegistry>(name: K): QdadmManagerRegistry[K]
    <T extends EntityRecord = EntityRecord>(name: string): EntityManager<T>
  }
  hasManager: (name: string) => boolean
}

export function useOrchestrator(): UseOrchestratorReturn {
  const injectedOrchestrator = inject<Orchestrator | undefined>('qdadmOrchestrator')

  if (!injectedOrchestrator) {
    throw new Error(
      '[qdadm] Orchestrator not provided.\n' +
      'Possible causes:\n' +
      '1. Kernel not initialized - ensure createKernel().createApp() is called before mounting\n' +
      '2. Component used outside of qdadm app context\n' +
      '3. Missing entityFactory in Kernel options'
    )
  }

  // Capture after null check for closure
  const orchestrator = injectedOrchestrator

  /**
   * Get an EntityManager by name
   * @param name - Entity name
   */
  function getManager<K extends keyof QdadmManagerRegistry>(name: K): QdadmManagerRegistry[K]
  function getManager<T extends EntityRecord = EntityRecord>(name: string): EntityManager<T>
  function getManager(name: string): unknown {
    return orchestrator.get(name)
  }

  /**
   * Check if a manager exists
   * @param name - Entity name
   */
  function hasManager(name: string): boolean {
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
 * ```ts
 * const users = useEntity('users')
 * const { items } = await users.list()
 * ```
 */
export function useEntity<K extends keyof QdadmManagerRegistry>(name: K): QdadmManagerRegistry[K]
export function useEntity<T extends EntityRecord = EntityRecord>(name: string): EntityManager<T>
export function useEntity(name: string): unknown {
  const { getManager } = useOrchestrator()
  return getManager(name)
}
