/**
 * useActiveStack - Access sync navigation stack
 *
 * Provides reactive access to the navigation stack levels.
 * Stack is rebuilt by Kernel on route change (single source of truth).
 *
 * IMPORTANT: Stack only contains levels WITH IDs.
 * - /bots/bot-xyz/commands → stack = [bots(id:bot-xyz)]
 * - /bots/bot-xyz/commands/cmd-123 → stack = [bots(id:bot-xyz), commands(id:cmd-123)]
 *
 * For hydrated data (labels, entity data), use useStackHydrator.
 *
 * Listens to SignalBus events for reactivity:
 * - stack:change - when stack levels change
 */

import { inject, ref, computed, onUnmounted, type ComputedRef, type Ref } from 'vue'
import type { ActiveStack, StackLevel } from './ActiveStack'
import type { SignalBus } from '../kernel/SignalBus'

/**
 * Return type for useActiveStack composable
 */
export interface UseActiveStackReturn {
  /** Reactive levels array */
  levels: Ref<StackLevel[]>
  /** Current (deepest) level */
  current: ComputedRef<StackLevel | null>
  /** Parent level */
  parent: ComputedRef<StackLevel | null>
  /** Root level */
  root: ComputedRef<StackLevel | null>
  /** Stack depth */
  depth: ComputedRef<number>
  /** Get level by index */
  getLevel: (index: number) => StackLevel | null
  /** Get level by entity name */
  getLevelByEntity: (entity: string) => StackLevel | null
  /** Get current level (sync) */
  getCurrent: () => StackLevel | null
  /** Get parent level (sync) */
  getParent: () => StackLevel | null
  /** Get all levels (sync) */
  getLevels: () => StackLevel[]
}

export function useActiveStack(): UseActiveStackReturn {
  const activeStack = inject<ActiveStack | undefined>('qdadmActiveStack')
  const signalBus = inject<SignalBus | undefined>('qdadmSignals')

  if (!activeStack) {
    console.warn('[useActiveStack] ActiveStack not provided')
    return createEmptyStack()
  }

  // Reactive state - updated via SignalBus
  const levels = ref<StackLevel[]>([...activeStack.getLevels()])

  // Subscribe to stack changes
  // QuarKernel passes (event, ctx) where event.data contains the payload
  let unsubscribe: (() => void) | null = null
  if (signalBus) {
    unsubscribe = signalBus.on('stack:change', (event) => {
      const newLevels = (event.data as { levels?: StackLevel[] })?.levels
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
  const depth = computed(() => levels.value.length)

  return {
    // Computed refs (reactive)
    levels,
    current,
    parent,
    root,
    depth,

    // Sync accessors (direct from vanilla JS instance)
    getLevel: (i: number) => activeStack.getLevel(i),
    getLevelByEntity: (e: string) => activeStack.getLevelByEntity(e),
    getCurrent: () => activeStack.getCurrent(),
    getParent: () => activeStack.getParent(),
    getLevels: () => activeStack.getLevels(),
  }
}

/**
 * Fallback when ActiveStack not available
 */
function createEmptyStack(): UseActiveStackReturn {
  return {
    levels: ref([]),
    current: computed(() => null),
    parent: computed(() => null),
    root: computed(() => null),
    depth: computed(() => 0),
    getLevel: () => null,
    getLevelByEntity: () => null,
    getCurrent: () => null,
    getParent: () => null,
    getLevels: () => [],
  }
}

export default useActiveStack
