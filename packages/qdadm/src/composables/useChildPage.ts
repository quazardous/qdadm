/**
 * useChildPage - Composable for non-entity child pages on entity items
 *
 * Provides parent entity context for custom child pages registered via ctx.childPage().
 * The parent data is loaded automatically via the StackHydrator (triggered by the
 * Kernel's activeStack rebuild from route.meta.parent).
 *
 * @example
 * // In a child page component (e.g., BookInfo.vue)
 * const { parentData, parentLoading, parentManager } = useChildPage()
 *
 * // parentData is reactive - null while loading, then the parent entity record
 * // parentManager gives access to the parent EntityManager (labels, fields, etc.)
 */
import { computed, inject, type ComputedRef } from 'vue'
import { useRoute } from 'vue-router'
import { useStackHydrator, type StackHydratorReturn } from '../chain/useStackHydrator'

/**
 * Parent config from route meta
 */
interface ParentConfig {
  entity: string
  param: string
  foreignKey?: string
}

/**
 * Entity manager interface (subset used by child pages)
 */
interface EntityManager {
  idField: string
  label?: string
  labelPlural?: string
  routePrefix?: string
  getEntityLabel: (data: unknown) => string
  getEntityBadges?: (data: unknown) => Array<{ label: string; severity?: string }>
}

/**
 * Orchestrator interface
 */
interface Orchestrator {
  get: (entityName: string) => EntityManager | null
}

/**
 * Return type for useChildPage
 */
export interface UseChildPageReturn {
  /** Parent config from route.meta.parent */
  parentConfig: ComputedRef<ParentConfig | null>
  /** Parent entity name */
  parentEntity: ComputedRef<string | null>
  /** Parent entity ID from route params */
  parentId: ComputedRef<string | null>
  /** Hydrated parent entity data (null while loading) */
  parentData: ComputedRef<unknown | null>
  /** Whether parent data is still loading */
  parentLoading: ComputedRef<boolean>
  /** Parent entity manager */
  parentManager: ComputedRef<EntityManager | null>
  /** Stack hydrator for advanced usage */
  hydrator: StackHydratorReturn
}

export function useChildPage(): UseChildPageReturn {
  const route = useRoute()
  const hydrator = useStackHydrator()
  const orchestrator = inject<Orchestrator | null>('qdadmOrchestrator', null)

  const parentConfig = computed<ParentConfig | null>(
    () => (route.meta?.parent as ParentConfig) || null
  )

  const parentEntity = computed(() => parentConfig.value?.entity || null)

  const parentId = computed(() => {
    if (!parentConfig.value) return null
    return (route.params[parentConfig.value.param] as string) || null
  })

  const parentData = computed(() => {
    if (!parentEntity.value || !parentId.value) return null
    const level = hydrator.levels.value.find(
      (l) => l.entity === parentEntity.value && String(l.id) === String(parentId.value)
    )
    return level?.data || null
  })

  const parentLoading = computed(() => {
    if (!parentEntity.value || !parentId.value) return false
    const level = hydrator.levels.value.find(
      (l) => l.entity === parentEntity.value && String(l.id) === String(parentId.value)
    )
    return level ? !level.hydrated : true
  })

  const parentManager = computed(() => {
    if (!parentEntity.value) return null
    return orchestrator?.get(parentEntity.value) || null
  })

  return {
    parentConfig,
    parentEntity,
    parentId,
    parentData,
    parentLoading,
    parentManager,
    hydrator,
  }
}
