/**
 * useStackHydrator - Access hydrated navigation stack
 *
 * Provides async-hydrated levels with entity data and labels.
 * Each level has its own promise for fine-grained control.
 *
 * Listens to SignalBus events for reactivity:
 * - stack:hydrated - when hydration completes (batched)
 *
 * @example
 * const hydrator = useStackHydrator()
 *
 * // Reactive usage (shows loading state, updates when ready)
 * const parentLabel = computed(() =>
 *   hydrator.parent.value?.hydrated
 *     ? hydrator.parent.value.label
 *     : 'Loading...'
 * )
 *
 * // Await specific level
 * await hydrator.getParent()?.promise
 *
 * // Await all levels
 * await Promise.all(hydrator.getLevels().map(l => l.promise))
 */

import { inject, ref, computed, onUnmounted } from 'vue'

export function useStackHydrator() {
  const hydrator = inject('qdadmStackHydrator')
  const signalBus = inject('qdadmSignals')

  if (!hydrator) {
    console.warn('[useStackHydrator] StackHydrator not provided')
    return createEmptyHydrator()
  }

  // Reactive state - updated via SignalBus
  const levels = ref(hydrator.getLevels())

  // Subscribe to hydration changes (batched signal)
  // QuarKernel passes (event, ctx) where event.data contains the payload
  let unsubscribe = null
  if (signalBus) {
    unsubscribe = signalBus.on('stack:hydrated', (event) => {
      const newLevels = event.data?.levels
      if (newLevels) {
        // Create new array reference to trigger reactivity
        levels.value = [...newLevels]
      }
    })
  }

  // Cleanup on unmount
  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe()
    }
  })

  // Computed accessors
  const current = computed(() => levels.value.at(-1) ?? null)
  const parent = computed(() => levels.value.at(-2) ?? null)
  const root = computed(() => levels.value[0] ?? null)

  return {
    // Computed refs (reactive)
    levels,
    current,
    parent,
    root,

    // Sync accessors (for immediate access + promise)
    getLevel: (i) => hydrator.getLevel(i),
    getLevelByEntity: (e) => hydrator.getLevelByEntity(e),
    getCurrent: () => hydrator.getCurrent(),
    getParent: () => hydrator.getParent(),
    getLevels: () => hydrator.getLevels(),

    // Manual data setters (for pages that load their own data)
    setCurrentData: (data) => hydrator.setCurrentData(data),
    setEntityData: (entity, data) => hydrator.setEntityData(entity, data),
  }
}

/**
 * Fallback when StackHydrator not available
 */
function createEmptyHydrator() {
  return {
    levels: computed(() => []),
    current: computed(() => null),
    parent: computed(() => null),
    root: computed(() => null),
    getLevel: () => null,
    getLevelByEntity: () => null,
    getCurrent: () => null,
    getParent: () => null,
    getLevels: () => [],
    setCurrentData: () => {},
    setEntityData: () => {},
  }
}

export default useStackHydrator
