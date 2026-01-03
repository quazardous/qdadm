<script setup>
/**
 * Zone - Renders blocks registered in a zone from ZoneRegistry
 *
 * Reads blocks from the injected ZoneRegistry and renders them
 * sorted by weight. Supports default content when no blocks registered.
 *
 * **Reactivity**: The Zone component automatically re-renders when blocks
 * are added, removed, or modified in the registry at runtime.
 *
 * Handles wrapped blocks by building nested component structures:
 * - Outer wrappers (lower weight) wrap inner wrappers
 * - Innermost component is the original block
 *
 * Usage:
 * <Zone name="header" />
 * <Zone name="sidebar" :default-component="DefaultSidebar" />
 * <Zone name="main"><RouterView /></Zone>
 */
import { computed, inject, h, defineComponent, useSlots } from 'vue'

const props = defineProps({
  /**
   * Zone name (required) - must match a zone in ZoneRegistry
   */
  name: {
    type: String,
    required: true
  },
  /**
   * Default component to render when no blocks are registered
   */
  defaultComponent: {
    type: Object,
    default: null
  },
  /**
   * Props to pass to all blocks
   */
  blockProps: {
    type: Object,
    default: () => ({})
  }
})

const slots = useSlots()
const hasDefaultSlot = computed(() => !!slots.default)

const registry = inject('qdadmZoneRegistry')

// Get the reactive version ref for tracking changes
const version = registry?.getVersionRef?.()

const blocks = computed(() => {
  if (!registry) {
    if (import.meta.env.DEV) {
      console.warn(`[Zone] ZoneRegistry not injected. Zone "${props.name}" will render nothing.`)
    }
    return []
  }
  // Access version.value to create reactive dependency
  // This ensures the computed re-evaluates when blocks change
  if (version) {
    // eslint-disable-next-line no-unused-expressions
    version.value
  }
  return registry.getBlocks(props.name)
})

const hasBlocks = computed(() => blocks.value.length > 0)

const showDefault = computed(() => {
  return !hasBlocks.value && (props.defaultComponent || registry?.getDefault(props.name))
})

const showSlot = computed(() => {
  return !hasBlocks.value && !showDefault.value && hasDefaultSlot.value
})

const defaultComp = computed(() => {
  return props.defaultComponent || registry?.getDefault(props.name)
})

/**
 * Create a wrapper component that renders nested wrappers around inner content
 *
 * This creates a functional component that builds the nested structure
 * once per block, avoiding the infinite re-render issue.
 *
 * Slot content from the Zone is passed to the innermost block component,
 * allowing the block to render Zone's children (e.g., form fields).
 *
 * @param {object} block - Block config with wrappers array
 * @param {object} mergedProps - Props to pass to the innermost component
 * @param {Function} slotFn - Slot function to pass to innermost component
 * @returns {object} - Vue component definition
 */
function createWrappedComponent(block, mergedProps, slotFn) {
  return defineComponent({
    name: 'WrappedBlock',
    render() {
      // Start with the innermost component (the original block)
      // Pass Zone's slot content to allow block to render it
      const innerSlots = slotFn ? { default: slotFn } : {}
      let current = h(block.component, mergedProps, innerSlots)

      // Build from inside out: last wrapper in array wraps the innermost
      // Wrappers are already sorted by weight (lower = outer)
      // So we reverse to build from inside out
      const reversedWrappers = [...block.wrappers].reverse()

      for (const wrapper of reversedWrappers) {
        const inner = current
        current = h(wrapper.component, wrapper.props || {}, {
          default: () => inner
        })
      }

      return current
    }
  })
}

/**
 * Computed map of wrapped block components
 * Memoizes the wrapped components to avoid re-creating them on every render
 *
 * Note: Slot function is passed to allow Zone's children to be rendered
 * inside the innermost block component.
 */
const wrappedComponents = computed(() => {
  const map = new Map()
  // Get slot function to pass to innermost block
  const slotFn = slots.default
  for (const block of blocks.value) {
    if (block.wrappers && block.wrappers.length > 0) {
      const key = block.id || block.weight
      const mergedProps = { ...props.blockProps, ...block.props }
      map.set(key, createWrappedComponent(block, mergedProps, slotFn))
    }
  }
  return map
})

/**
 * Get the wrapped component for a block
 */
function getWrappedComponent(block) {
  const key = block.id || block.weight
  return wrappedComponents.value.get(key)
}
</script>

<template>
  <div :data-zone="name" class="qdadm-zone">
    <template v-if="hasBlocks">
      <template v-for="block in blocks" :key="block.id || block.weight">
        <!-- Render wrapped blocks using memoized component -->
        <component
          v-if="block.wrappers"
          :is="getWrappedComponent(block)"
        />
        <!-- Render simple blocks directly, passing Zone's slot content -->
        <component
          v-else
          :is="block.component"
          v-bind="{ ...blockProps, ...block.props }"
        >
          <slot />
        </component>
      </template>
    </template>
    <component
      v-else-if="showDefault"
      :is="defaultComp"
      v-bind="blockProps"
    >
      <slot />
    </component>
    <slot v-else-if="showSlot" />
  </div>
</template>
