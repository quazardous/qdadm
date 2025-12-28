/**
 * useZoneRegistry - Access the zone registry for extensible UI composition
 *
 * Provides reactive access to the ZoneRegistry created by Kernel during bootstrap.
 * Components can register/unregister blocks and query zones reactively.
 *
 * **Reactivity**: The registry is reactive. When blocks are added, removed, or modified,
 * components using `getBlocks()` will automatically re-render.
 *
 * @returns {object} - Object with registry methods and reactive helpers
 * @throws {Error} If zone registry is not available (Kernel not initialized)
 *
 * @example
 * // Basic access to zones (reactive)
 * import { useZoneRegistry } from 'qdadm'
 * import { ZONES } from 'qdadm/zones'
 *
 * const { getBlocks, registerBlock, unregisterBlock } = useZoneRegistry()
 *
 * // Get blocks (reactive - component re-renders when blocks change)
 * const headerBlocks = computed(() => getBlocks(ZONES.HEADER))
 *
 * @example
 * // Register/unregister blocks at component lifecycle
 * import { useZoneRegistry } from 'qdadm'
 * import { ZONES } from 'qdadm/zones'
 * import AdBanner from './AdBanner.vue'
 *
 * const { registerBlock, unregisterBlock } = useZoneRegistry()
 *
 * onMounted(() => {
 *   registerBlock(ZONES.SIDEBAR, {
 *     id: 'ad-banner',
 *     component: AdBanner,
 *     weight: 50,
 *     props: { variant: 'compact' }
 *   })
 * })
 *
 * onUnmounted(() => {
 *   unregisterBlock(ZONES.SIDEBAR, 'ad-banner')
 * })
 *
 * @example
 * // Conditional block registration based on feature flag
 * import { useZoneRegistry } from 'qdadm'
 * import { watch } from 'vue'
 *
 * const { registerBlock, unregisterBlock } = useZoneRegistry()
 *
 * watch(featureEnabled, (enabled) => {
 *   if (enabled) {
 *     registerBlock('sidebar', { id: 'feature-widget', component: FeatureWidget })
 *   } else {
 *     unregisterBlock('sidebar', 'feature-widget')
 *   }
 * }, { immediate: true })
 *
 * @example
 * // Direct registry access
 * const { registry } = useZoneRegistry()
 * const zones = registry.listZones()
 * console.log('Available zones:', zones)
 */
import { inject, computed } from 'vue'

export function useZoneRegistry() {
  const registry = inject('qdadmZoneRegistry')

  if (!registry) {
    throw new Error('[qdadm] Zone registry not provided. Ensure Kernel is initialized.')
  }

  // Get the reactive version ref for tracking changes
  const version = registry.getVersionRef()

  /**
   * Get blocks for a zone (reactive)
   *
   * This function depends on the registry's version counter,
   * so it will return fresh data when blocks change.
   *
   * @param {string} zoneName - Zone name
   * @returns {BlockConfig[]} - Array of block configs
   */
  function getBlocks(zoneName) {
    // Access version.value to create reactive dependency
    // eslint-disable-next-line no-unused-expressions
    version.value
    return registry.getBlocks(zoneName)
  }

  /**
   * Create a computed ref for a zone's blocks
   *
   * Convenience method for creating a reactive computed ref
   * that updates when the zone's blocks change.
   *
   * @param {string} zoneName - Zone name
   * @returns {import('vue').ComputedRef<BlockConfig[]>} - Computed ref of blocks
   *
   * @example
   * const headerBlocks = useBlocks(ZONES.HEADER)
   * // headerBlocks.value is reactive array
   */
  function useBlocks(zoneName) {
    return computed(() => {
      // Access version to create dependency
      // eslint-disable-next-line no-unused-expressions
      version.value
      return registry.getBlocks(zoneName)
    })
  }

  /**
   * Register a block in a zone
   *
   * Proxy to registry.registerBlock() for convenience.
   *
   * @param {string} zoneName - Target zone name
   * @param {BlockConfig} blockConfig - Block configuration
   * @returns {ZoneRegistry} - The registry (for chaining)
   */
  function registerBlock(zoneName, blockConfig) {
    return registry.registerBlock(zoneName, blockConfig)
  }

  /**
   * Unregister a block from a zone
   *
   * Proxy to registry.unregisterBlock() for convenience.
   *
   * @param {string} zoneName - Zone name
   * @param {string} blockId - Block ID to unregister
   * @returns {boolean} - True if block was found and removed
   */
  function unregisterBlock(zoneName, blockId) {
    return registry.unregisterBlock(zoneName, blockId)
  }

  return {
    // Direct registry access for advanced usage
    registry,

    // Reactive helpers
    getBlocks,
    useBlocks,

    // Block management
    registerBlock,
    unregisterBlock,

    // Passthrough common methods
    defineZone: registry.defineZone.bind(registry),
    hasBlocks: registry.hasBlocks.bind(registry),
    hasZone: registry.hasZone.bind(registry),
    getDefault: registry.getDefault.bind(registry),
    listZones: registry.listZones.bind(registry),
    getZoneInfo: registry.getZoneInfo.bind(registry),
    inspect: registry.inspect.bind(registry)
  }
}
