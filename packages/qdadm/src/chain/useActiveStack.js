/**
 * useActiveStack - Build navigation stack from route
 *
 * The route is the single source of truth:
 * - route.meta.entity → current entity
 * - route.meta.parent → parent chain config
 * - route.params → entity IDs
 *
 * Stack is rebuilt on every route change. Data is set by pages when they load.
 */

import { watch, inject, computed } from 'vue'
import { useRoute } from 'vue-router'

export function useActiveStack() {
  const route = useRoute()
  const activeStack = inject('qdadmActiveStack')
  const orchestrator = inject('qdadmOrchestrator')

  if (!activeStack) {
    console.warn('[useActiveStack] ActiveStack not provided')
    return createEmptyStack()
  }

  /**
   * Build stack from current route
   * Traverses route.meta.parent chain to build all levels
   */
  function rebuildStack() {
    const entity = route.meta?.entity
    if (!entity) {
      activeStack.clear()
      return
    }

    const levels = []
    const manager = orchestrator?.get(entity)

    // Build parent chain from route.meta.parent (traverse nested parents)
    let parentConfig = route.meta?.parent
    const parentLevels = []

    while (parentConfig) {
      const parentManager = orchestrator?.get(parentConfig.entity)
      const id = route.params[parentConfig.param] || null

      parentLevels.unshift({
        entity: parentConfig.entity,
        id,
        data: null,
        label: parentManager?.labelPlural || parentConfig.entity
      })

      // Traverse nested parent config (NOT manager.parent)
      parentConfig = parentConfig.parent || null
    }

    levels.push(...parentLevels)

    // Add current entity
    const idField = manager?.idField || 'id'
    const currentId = route.params[idField] || null

    levels.push({
      entity,
      id: currentId,
      data: null,
      label: manager?.labelPlural || entity
    })

    activeStack.set(levels)
  }

  /**
   * Set data for current level (called by useEntityItemPage/useForm)
   */
  function setCurrentData(data) {
    const levels = activeStack.levels.value
    if (levels.length === 0) return

    const index = levels.length - 1
    const level = levels[index]
    const manager = orchestrator?.get(level.entity)
    const label = manager?.getEntityLabel?.(data) || level.label

    activeStack.updateLevel(index, data, label)
  }

  /**
   * Set data for a level by entity name
   */
  function setEntityData(entity, data) {
    const manager = orchestrator?.get(entity)
    const label = manager?.getEntityLabel?.(data) || entity

    activeStack.updateByEntity(entity, data, label)
  }

  // Rebuild stack on route change
  watch(() => route.fullPath, rebuildStack, { immediate: true })

  return {
    // Computed refs from ActiveStack
    levels: activeStack.levels,
    current: activeStack.current,
    parent: activeStack.parent,
    root: activeStack.root,
    depth: activeStack.depth,

    // Data setters (called by pages)
    setCurrentData,
    setEntityData,

    // Manual rebuild
    rebuild: rebuildStack
  }
}

/**
 * Fallback when ActiveStack not available
 */
function createEmptyStack() {
  return {
    levels: computed(() => []),
    current: computed(() => null),
    parent: computed(() => null),
    root: computed(() => null),
    depth: computed(() => 0),
    setCurrentData: () => {},
    setEntityData: () => {},
    rebuild: () => {}
  }
}

export default useActiveStack
