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

import { inject, ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import type { SignalBus } from '../kernel/SignalBus'

/**
 * Signal handler type (matches ListenerCallback from quarkernel)
 */
type SignalHandler = (event: unknown) => void | Promise<void>

/**
 * Hydrated level data
 */
export interface HydratedLevel {
  entity: string
  id: string | number
  data: unknown | null
  label: string | null
  hydrated: boolean
  promise: Promise<unknown>
}

/**
 * Stack hydrator interface (from StackHydrator class)
 */
interface StackHydratorClass {
  getLevels: () => HydratedLevel[]
  getLevel: (index: number) => HydratedLevel | null
  getLevelByEntity: (entity: string) => HydratedLevel | null
  getCurrent: () => HydratedLevel | null
  getParent: () => HydratedLevel | null
  setCurrentData: (data: unknown) => void
  setEntityData: (entity: string, data: unknown) => void
}

/**
 * Return type for useStackHydrator
 */
export interface StackHydratorReturn {
  // Computed refs (reactive)
  levels: Ref<HydratedLevel[]>
  current: ComputedRef<HydratedLevel | null>
  parent: ComputedRef<HydratedLevel | null>
  root: ComputedRef<HydratedLevel | null>

  // Sync accessors (for immediate access + promise)
  getLevel: (index: number) => HydratedLevel | null
  getLevelByEntity: (entity: string) => HydratedLevel | null
  getCurrent: () => HydratedLevel | null
  getParent: () => HydratedLevel | null
  getLevels: () => HydratedLevel[]

  // Manual data setters (for pages that load their own data)
  setCurrentData: (data: unknown) => void
  setEntityData: (entity: string, data: unknown) => void
}

export function useStackHydrator(): StackHydratorReturn {
  const hydrator = inject<StackHydratorClass | null>('qdadmStackHydrator', null)
  const signalBus = inject<SignalBus | null>('qdadmSignals', null)

  if (!hydrator) {
    console.warn('[useStackHydrator] StackHydrator not provided')
    return createEmptyHydrator()
  }

  // Reactive state - updated via SignalBus
  const levels = ref<HydratedLevel[]>(hydrator.getLevels())

  // Subscribe to hydration changes (batched signal)
  // QuarKernel passes (event, ctx) where event.data contains the payload
  let unsubscribe: (() => void) | null = null
  if (signalBus) {
    const handler = (event: unknown): void => {
      const eventData = event as { data?: { levels?: HydratedLevel[] } }
      const newLevels = eventData.data?.levels
      if (newLevels) {
        // Create new array reference to trigger reactivity
        levels.value = [...newLevels]
      }
    }
    unsubscribe = signalBus.on('stack:hydrated', handler)
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
    getLevel: (i: number) => hydrator.getLevel(i),
    getLevelByEntity: (e: string) => hydrator.getLevelByEntity(e),
    getCurrent: () => hydrator.getCurrent(),
    getParent: () => hydrator.getParent(),
    getLevels: () => hydrator.getLevels(),

    // Manual data setters (for pages that load their own data)
    setCurrentData: (data: unknown) => hydrator.setCurrentData(data),
    setEntityData: (entity: string, data: unknown) => hydrator.setEntityData(entity, data),
  }
}

/**
 * Fallback when StackHydrator not available
 */
function createEmptyHydrator(): StackHydratorReturn {
  return {
    levels: ref<HydratedLevel[]>([]),
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
