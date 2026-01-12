/**
 * useZoneRegistry - Access the zone registry for extensible UI composition
 *
 * Provides reactive access to the ZoneRegistry created by Kernel during bootstrap.
 * Components can register/unregister blocks and query zones reactively.
 *
 * **Reactivity**: The registry is reactive. When blocks are added, removed, or modified,
 * components using `getBlocks()` will automatically re-render.
 *
 * @returns Object with registry methods and reactive helpers
 * @throws Error if zone registry is not available (Kernel not initialized)
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
import { inject, computed, type ComputedRef, type Component, type Ref } from 'vue'

/**
 * Block configuration for zone registration
 */
export interface BlockConfig {
  /** Unique block identifier */
  id: string
  /** Vue component to render */
  component: Component
  /** Sort weight (lower = first) */
  weight?: number
  /** Props to pass to component */
  props?: Record<string, unknown>
  /** Additional config */
  [key: string]: unknown
}

/**
 * Zone definition
 */
export interface ZoneDefinition {
  /** Zone name */
  name: string
  /** Default component if no blocks registered */
  default?: Component
  /** Zone description */
  description?: string
}

/**
 * Zone info
 */
export interface ZoneInfo {
  name: string
  blockCount: number
  hasDefault: boolean
}

/**
 * Zone registry interface
 */
export interface ZoneRegistry {
  getVersionRef: () => Ref<number>
  getBlocks: (zoneName: string) => BlockConfig[]
  registerBlock: (zoneName: string, blockConfig: BlockConfig) => ZoneRegistry
  unregisterBlock: (zoneName: string, blockId: string) => boolean
  defineZone: (zoneName: string, definition?: ZoneDefinition) => ZoneRegistry
  hasBlocks: (zoneName: string) => boolean
  hasZone: (zoneName: string) => boolean
  getDefault: (zoneName: string) => Component | null
  listZones: () => string[]
  getZoneInfo: (zoneName: string) => ZoneInfo | null
  inspect: () => Record<string, BlockConfig[]>
}

/**
 * Return type for useZoneRegistry
 */
export interface UseZoneRegistryReturn {
  /** Direct registry access for advanced usage */
  registry: ZoneRegistry

  /** Get blocks for a zone (reactive) */
  getBlocks: (zoneName: string) => BlockConfig[]
  /** Create a computed ref for a zone's blocks */
  useBlocks: (zoneName: string) => ComputedRef<BlockConfig[]>

  /** Register a block in a zone */
  registerBlock: (zoneName: string, blockConfig: BlockConfig) => ZoneRegistry
  /** Unregister a block from a zone */
  unregisterBlock: (zoneName: string, blockId: string) => boolean

  /** Define a new zone */
  defineZone: (zoneName: string, definition?: ZoneDefinition) => ZoneRegistry
  /** Check if zone has any blocks */
  hasBlocks: (zoneName: string) => boolean
  /** Check if zone exists */
  hasZone: (zoneName: string) => boolean
  /** Get default component for zone */
  getDefault: (zoneName: string) => Component | null
  /** List all zone names */
  listZones: () => string[]
  /** Get zone info */
  getZoneInfo: (zoneName: string) => ZoneInfo | null
  /** Inspect all zones and blocks */
  inspect: () => Record<string, BlockConfig[]>
}

export function useZoneRegistry(): UseZoneRegistryReturn {
  const injectedRegistry = inject<ZoneRegistry | null>('qdadmZoneRegistry', null)

  if (!injectedRegistry) {
    throw new Error('[qdadm] Zone registry not provided. Ensure Kernel is initialized.')
  }

  // Non-null after check above
  const registry = injectedRegistry

  // Get the reactive version ref for tracking changes
  const version = registry.getVersionRef()

  /**
   * Get blocks for a zone (reactive)
   *
   * This function depends on the registry's version counter,
   * so it will return fresh data when blocks change.
   *
   * @param zoneName - Zone name
   * @returns Array of block configs
   */
  function getBlocks(zoneName: string): BlockConfig[] {
    // Access version.value to create reactive dependency
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    version.value
    return registry.getBlocks(zoneName)
  }

  /**
   * Create a computed ref for a zone's blocks
   *
   * Convenience method for creating a reactive computed ref
   * that updates when the zone's blocks change.
   *
   * @param zoneName - Zone name
   * @returns Computed ref of blocks
   *
   * @example
   * const headerBlocks = useBlocks(ZONES.HEADER)
   * // headerBlocks.value is reactive array
   */
  function useBlocks(zoneName: string): ComputedRef<BlockConfig[]> {
    return computed(() => {
      // Access version to create dependency
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      version.value
      return registry.getBlocks(zoneName)
    })
  }

  /**
   * Register a block in a zone
   *
   * Proxy to registry.registerBlock() for convenience.
   *
   * @param zoneName - Target zone name
   * @param blockConfig - Block configuration
   * @returns The registry (for chaining)
   */
  function registerBlock(zoneName: string, blockConfig: BlockConfig): ZoneRegistry {
    return registry.registerBlock(zoneName, blockConfig)
  }

  /**
   * Unregister a block from a zone
   *
   * Proxy to registry.unregisterBlock() for convenience.
   *
   * @param zoneName - Zone name
   * @param blockId - Block ID to unregister
   * @returns True if block was found and removed
   */
  function unregisterBlock(zoneName: string, blockId: string): boolean {
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
    inspect: registry.inspect.bind(registry),
  }
}
