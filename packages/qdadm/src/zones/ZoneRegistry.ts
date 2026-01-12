/**
 * ZoneRegistry - Manages named zones and block registrations
 *
 * Inspired by Twig/Symfony block system. Zones are named slots in layouts
 * where blocks (components) can be injected with weight ordering.
 *
 * **Vue Reactivity**: The registry uses Vue's reactivity system internally.
 * When blocks are added, removed, or modified, zones automatically trigger
 * re-renders in components using them.
 *
 * Supports block operations:
 * - 'add' (default): Simply add block to zone
 * - 'replace': Substitute an existing block entirely
 * - 'extend': Insert block before/after an existing block
 * - 'wrap': Wrap an existing block with a decorator component
 *
 * Usage:
 * ```ts
 * const registry = new ZoneRegistry()
 *
 * // Define zones with optional defaults
 * registry.defineZone('header', { default: DefaultHeader })
 * registry.defineZone('sidebar')
 *
 * // Register blocks with weight (lower = first)
 * registry.registerBlock('header', { component: Logo, weight: 10, id: 'logo' })
 * registry.registerBlock('header', { component: UserMenu, weight: 90 })
 *
 * // Replace a block entirely
 * registry.registerBlock('header', {
 *   component: CustomLogo,
 *   operation: 'replace',
 *   replaces: 'logo'
 * })
 *
 * // Extend: insert after an existing block
 * registry.registerBlock('header', {
 *   component: ExtraMenuItem,
 *   operation: 'extend',
 *   after: 'logo'
 * })
 *
 * // Extend: insert before an existing block
 * registry.registerBlock('header', {
 *   component: Announcements,
 *   operation: 'extend',
 *   before: 'logo'
 * })
 *
 * // Wrap: decorate a block with before/after content
 * registry.registerBlock('header', {
 *   component: BorderWrapper,
 *   operation: 'wrap',
 *   wraps: 'logo'
 * })
 *
 * // Unregister blocks at runtime
 * registry.unregisterBlock('header', 'logo')
 *
 * // Get blocks sorted by weight
 * registry.getBlocks('header') // [Announcements, CustomLogo@10, ExtraMenuItem, UserMenu@90]
 * ```
 */

import { shallowRef, type ShallowRef, type Component } from 'vue'

/**
 * Block operation types
 */
export type BlockOperation = 'add' | 'replace' | 'extend' | 'wrap'

/**
 * Wrapper info for wrapped blocks
 */
export interface WrapperInfo {
  component: Component
  props?: Record<string, unknown>
  id?: string | null
}

/**
 * Block configuration
 */
export interface BlockConfig {
  /** Vue component to render */
  component: Component
  /** Ordering weight (lower = first) */
  weight?: number
  /** Props to pass to component */
  props?: Record<string, unknown>
  /** Unique identifier for duplicate detection */
  id?: string | null
  /** Block operation */
  operation?: BlockOperation
  /** Block ID to replace (required if operation='replace') */
  replaces?: string | null
  /** Block ID to insert before (for operation='extend') */
  before?: string | null
  /** Block ID to insert after (for operation='extend') */
  after?: string | null
  /** Block ID to wrap (required if operation='wrap') */
  wraps?: string | null
  /** Wrappers applied to this block */
  wrappers?: WrapperInfo[]
}

/**
 * Internal block representation with normalized fields
 */
interface InternalBlock {
  component: Component
  weight: number
  props: Record<string, unknown>
  id: string | null
  operation: BlockOperation
  replaces: string | null
  before: string | null
  after: string | null
  wraps: string | null
  wrappers?: WrapperInfo[]
}

/**
 * Zone configuration
 */
export interface ZoneConfig {
  /** Default component if no blocks registered */
  default: Component | null
  /** Registered blocks */
  blocks: InternalBlock[]
}

/**
 * Zone definition options
 */
export interface ZoneDefineOptions {
  /** Default component when no blocks are registered */
  default?: Component | null
}

/**
 * Zone info for listing
 */
export interface ZoneListInfo {
  name: string
  blockCount: number
}

/**
 * Detailed zone info for debugging
 */
export interface ZoneDetailInfo {
  name: string
  hasDefault: boolean
  blockCount: number
  blocks: Array<{
    id: string | null
    weight: number
    hasProps: boolean
  }>
}

/**
 * Zone inspection result
 */
export interface ZoneInspection {
  name: string
  blocks: Array<{
    id: string | null
    weight: number
    component: string
    wrappers?: Array<{
      id: string | null
      component: string
    }>
  }>
  default: string | null
}

/**
 * ZoneRegistry creation options
 */
export interface ZoneRegistryOptions {
  debug?: boolean
}

const DEFAULT_WEIGHT = 50

export class ZoneRegistry {
  /**
   * Zone storage: name -> ZoneConfig
   */
  private _zones: Map<string, ZoneConfig>

  /**
   * Cache for sorted blocks (invalidated on registerBlock)
   */
  private _sortedCache: Map<string, BlockConfig[]>

  /**
   * Wrap graph for cycle detection: zoneName -> Map<wrapperId, targetId>
   */
  private _wrapGraph: Map<string, Map<string, string>>

  /**
   * Debug mode for warnings
   */
  private _debug: boolean

  /**
   * Version counter for reactivity - triggers re-renders when blocks change
   * Using shallowRef for lightweight reactivity that tracks mutation count
   */
  private _version: ShallowRef<number>

  constructor() {
    this._zones = new Map()
    this._sortedCache = new Map()
    this._wrapGraph = new Map()
    this._debug = false
    this._version = shallowRef(0)
  }

  /**
   * Get the reactive version ref for tracking changes
   *
   * Components can watch this ref to re-render when blocks change.
   * Use `useZoneRegistry()` composable for convenient access.
   *
   * @returns Reactive version counter
   */
  getVersionRef(): ShallowRef<number> {
    return this._version
  }

  /**
   * Trigger Vue reactivity update
   *
   * Called after any mutation that should cause Zone components to re-render.
   */
  private _triggerUpdate(): void {
    this._version.value++
  }

  /**
   * Enable or disable debug mode
   *
   * When enabled, warnings are logged for missing replace targets, etc.
   *
   * @param enabled - Whether to enable debug mode
   * @returns This instance for chaining
   */
  setDebug(enabled: boolean): this {
    this._debug = !!enabled
    return this
  }

  /**
   * Define a new zone
   *
   * If zone already exists, merges options (updating default if provided).
   *
   * @param name - Zone name (e.g., 'header', 'sidebar')
   * @param options - Zone options
   * @returns This instance for chaining
   */
  defineZone(name: string, options: ZoneDefineOptions = {}): this {
    if (!name || typeof name !== 'string') {
      throw new Error('[ZoneRegistry] Zone name must be a non-empty string')
    }

    const existing = this._zones.get(name)
    if (existing) {
      // Merge: update default if provided
      if (options.default !== undefined) {
        existing.default = options.default
      }
    } else {
      this._zones.set(name, {
        default: options.default ?? null,
        blocks: [],
      })
    }

    return this
  }

  /**
   * Register a block in a zone
   *
   * Blocks are sorted by weight (ascending). Equal weights maintain insertion order.
   *
   * Operations:
   * - 'add' (default): Simply add the block to the zone
   * - 'replace': Substitute an existing block by ID
   * - 'extend': Insert block before/after an existing block
   * - 'wrap': Wrap an existing block with a decorator component
   *
   * @param zoneName - Target zone name
   * @param blockConfig - Block configuration
   * @returns This instance for chaining
   * @throws Error If component is not provided
   * @throws Error If operation is 'replace' but replaces is not specified
   * @throws Error If operation is 'extend' but neither before nor after is specified
   * @throws Error If operation is 'extend' and both before and after are specified
   * @throws Error If operation is 'wrap' but wraps is not specified
   * @throws Error If operation is 'wrap' but id is not specified
   * @throws Error If wrap would create a circular dependency
   */
  registerBlock(zoneName: string, blockConfig: BlockConfig): this {
    if (!zoneName || typeof zoneName !== 'string') {
      throw new Error('[ZoneRegistry] Zone name must be a non-empty string')
    }

    if (!blockConfig || !blockConfig.component) {
      throw new Error('[ZoneRegistry] Block must have a component')
    }

    const operation = blockConfig.operation || 'add'

    // Validate replace operation
    if (operation === 'replace' && !blockConfig.replaces) {
      throw new Error(
        `[ZoneRegistry] Block with operation 'replace' must specify 'replaces' target ID`
      )
    }

    // Validate extend operation
    if (operation === 'extend') {
      const hasBefore = !!blockConfig.before
      const hasAfter = !!blockConfig.after

      if (!hasBefore && !hasAfter) {
        throw new Error(
          `[ZoneRegistry] Block with operation 'extend' must specify either 'before' or 'after' target ID`
        )
      }
      if (hasBefore && hasAfter) {
        throw new Error(
          `[ZoneRegistry] Block with operation 'extend' cannot specify both 'before' and 'after'`
        )
      }
    }

    // Validate wrap operation
    if (operation === 'wrap') {
      if (!blockConfig.wraps) {
        throw new Error(
          `[ZoneRegistry] Block with operation 'wrap' must specify 'wraps' target ID`
        )
      }
      if (!blockConfig.id) {
        throw new Error(
          `[ZoneRegistry] Block with operation 'wrap' must have an 'id' for cycle detection`
        )
      }
      // Check for circular wrap dependency
      if (this._wouldCreateWrapCycle(zoneName, blockConfig.id, blockConfig.wraps)) {
        throw new Error(
          `[ZoneRegistry] Circular wrap dependency detected: "${blockConfig.id}" wrapping "${blockConfig.wraps}" would create a cycle`
        )
      }
    }

    // Auto-create zone if not exists (DX decision: reduce friction)
    if (!this._zones.has(zoneName)) {
      this.defineZone(zoneName)
    }

    const zone = this._zones.get(zoneName)!

    // Prepare normalized block config
    const block: InternalBlock = {
      component: blockConfig.component,
      weight: blockConfig.weight ?? DEFAULT_WEIGHT,
      props: blockConfig.props ?? {},
      id: blockConfig.id ?? null,
      operation,
      replaces: blockConfig.replaces ?? null,
      before: blockConfig.before ?? null,
      after: blockConfig.after ?? null,
      wraps: blockConfig.wraps ?? null,
    }

    // Update wrap graph for cycle detection (wrap operation only)
    if (operation === 'wrap') {
      if (!this._wrapGraph.has(zoneName)) {
        this._wrapGraph.set(zoneName, new Map())
      }
      this._wrapGraph.get(zoneName)!.set(block.id!, block.wraps!)
    }

    // Check for duplicate ID
    if (block.id) {
      const existingIndex = zone.blocks.findIndex((b) => b.id === block.id)
      if (existingIndex !== -1) {
        // Warn in debug mode - duplicates shouldn't happen with proper module init
        if (this._debug) {
          console.warn(
            `[qdadm:zones] Duplicate block ID "${block.id}" in zone "${zoneName}". ` +
              `This may indicate a module is being initialized multiple times.`
          )
        }
        // Replace existing block (backward compatibility)
        zone.blocks[existingIndex] = block
      } else {
        zone.blocks.push(block)
      }
    } else {
      zone.blocks.push(block)
    }

    // Invalidate cache for this zone
    this._sortedCache.delete(zoneName)

    // Trigger Vue reactivity update
    this._triggerUpdate()

    // Dev mode logging for block registration
    if (this._debug) {
      const blockDesc = block.id || '(anonymous)'
      const opDesc = operation === 'add' ? '' : ` [${operation}]`
      console.debug(`[qdadm:zones] Registered block in zone: ${zoneName}, ${blockDesc}${opDesc}`)
    }

    return this
  }

  /**
   * Check if adding a wrap would create a cycle
   *
   * Detects cycles by traversing the wrap graph from the wrapper.
   * If the target eventually wraps back to the wrapper, it's a cycle.
   *
   * @param zoneName - Zone name
   * @param wrapperId - ID of the wrapper block being added
   * @param targetId - ID of the block being wrapped
   * @returns True if adding this wrap would create a cycle
   */
  private _wouldCreateWrapCycle(zoneName: string, wrapperId: string, targetId: string): boolean {
    // Self-wrap is a cycle
    if (wrapperId === targetId) {
      return true
    }

    const zoneGraph = this._wrapGraph.get(zoneName)
    if (!zoneGraph) {
      return false
    }

    // Check if the target (or anything it wraps) eventually wraps the wrapper
    // Start from targetId and follow the chain to see if we reach wrapperId
    const visited = new Set<string>()
    let current: string | undefined = targetId

    while (current && !visited.has(current)) {
      visited.add(current)
      // What does 'current' wrap?
      const wrapsWhat = zoneGraph.get(current)
      if (wrapsWhat === wrapperId) {
        // Found a cycle: target -> ... -> wrapper
        return true
      }
      current = wrapsWhat
    }

    return false
  }

  /**
   * Get sorted blocks for a zone
   *
   * Returns blocks sorted by weight (ascending) after applying all block operations.
   * Uses cached result if available.
   *
   * Operations:
   * - 'add': Block is included directly
   * - 'replace': Replaces target block, inherits target's weight if not specified
   * - 'extend': Inserts block before/after target, uses target's weight for positioning
   * - 'wrap': Adds wrappers array to target block containing wrapper components
   *
   * @param zoneName - Zone name
   * @returns Sorted array of block configs (empty if zone undefined)
   */
  getBlocks(zoneName: string): BlockConfig[] {
    if (!this._zones.has(zoneName)) {
      return []
    }

    // Return cached sorted result if available
    if (this._sortedCache.has(zoneName)) {
      return this._sortedCache.get(zoneName)!
    }

    const zone = this._zones.get(zoneName)!

    // Separate blocks by operation
    const addBlocks: InternalBlock[] = []
    const replaceBlocks: InternalBlock[] = []
    const extendBlocks: InternalBlock[] = []
    const wrapBlocks: InternalBlock[] = []

    for (const block of zone.blocks) {
      if (block.operation === 'replace') {
        replaceBlocks.push(block)
      } else if (block.operation === 'extend') {
        extendBlocks.push(block)
      } else if (block.operation === 'wrap') {
        wrapBlocks.push(block)
      } else {
        addBlocks.push(block)
      }
    }

    // Start with add blocks
    let result: InternalBlock[] = [...addBlocks]

    // Apply replace operations first
    for (const replaceBlock of replaceBlocks) {
      const targetIndex = result.findIndex((b) => b.id === replaceBlock.replaces)

      if (targetIndex === -1) {
        // Target not found - warn but still add the replacement at its own weight
        if (this._debug) {
          console.warn(
            `[ZoneRegistry] Replace target "${replaceBlock.replaces}" not found in zone "${zoneName}". ` +
              `Adding replacement block at default weight.`
          )
        }
        result.push(replaceBlock)
      } else {
        // Replace: use target's weight if replacement doesn't specify one
        const targetBlock = result[targetIndex]!
        const hasExplicitWeight = replaceBlock.weight !== DEFAULT_WEIGHT
        const finalWeight = hasExplicitWeight ? replaceBlock.weight : targetBlock.weight

        const replacement: InternalBlock = {
          ...replaceBlock,
          weight: finalWeight,
        }
        result.splice(targetIndex, 1, replacement)
      }
    }

    // Sort by weight before applying extend operations
    // This ensures targets are in their final positions
    result.sort((a, b) => a.weight - b.weight)

    // Apply extend operations (in registration order)
    for (const extendBlock of extendBlocks) {
      const targetId = extendBlock.before || extendBlock.after
      const insertBefore = !!extendBlock.before
      const targetIndex = result.findIndex((b) => b.id === targetId)

      if (targetIndex === -1) {
        // Target not found - warn and fall back to weight-based positioning
        if (this._debug) {
          console.warn(
            `[ZoneRegistry] Extend target "${targetId}" not found in zone "${zoneName}". ` +
              `Adding block at its own weight.`
          )
        }
        // Insert at position based on weight
        const insertIndex = result.findIndex((b) => b.weight > extendBlock.weight)
        if (insertIndex === -1) {
          result.push(extendBlock)
        } else {
          result.splice(insertIndex, 0, extendBlock)
        }
      } else {
        // Insert before or after target
        const insertIndex = insertBefore ? targetIndex : targetIndex + 1
        result.splice(insertIndex, 0, extendBlock)
      }
    }

    // Apply wrap operations
    // Build wrapper chains: for each target, collect all wrappers sorted by weight
    if (wrapBlocks.length > 0) {
      // Group wraps by target ID
      const wrapsByTarget = new Map<string, InternalBlock[]>()
      for (const wrapBlock of wrapBlocks) {
        if (!wrapsByTarget.has(wrapBlock.wraps!)) {
          wrapsByTarget.set(wrapBlock.wraps!, [])
        }
        wrapsByTarget.get(wrapBlock.wraps!)!.push(wrapBlock)
      }

      // Collect IDs of blocks in result for orphan detection
      const resultBlockIds = new Set(result.map((b) => b.id).filter(Boolean) as string[])

      // Apply wrappers to blocks in result
      for (let i = 0; i < result.length; i++) {
        const block = result[i]
        if (!block || !block.id) continue

        // Collect all wrappers for this block (direct and nested)
        const allWrappers = this._collectWrapChain(block.id, wrapsByTarget)

        if (allWrappers.length > 0) {
          // Sort wrappers by weight (lower weight = outer wrapper)
          allWrappers.sort((a, b) => a.weight - b.weight)

          result[i] = {
            component: block.component,
            weight: block.weight,
            props: block.props,
            id: block.id,
            operation: block.operation,
            replaces: block.replaces,
            before: block.before,
            after: block.after,
            wraps: block.wraps,
            wrappers: allWrappers.map((w) => ({
              component: w.component,
              props: w.props,
              id: w.id,
            })),
          }
        }
      }

      // Warn about orphaned wrappers (wrappers targeting non-existent blocks)
      if (this._debug) {
        for (const [targetId, wrappers] of wrapsByTarget.entries()) {
          // Check if target exists in result blocks or as a wrapper ID
          const wrapperIds = new Set(wrapBlocks.map((w) => w.id))
          if (!resultBlockIds.has(targetId) && !wrapperIds.has(targetId)) {
            for (const wrapper of wrappers) {
              console.warn(
                `[ZoneRegistry] Wrap target "${targetId}" not found in zone "${zoneName}". ` +
                  `Wrapper "${wrapper.id}" will be ignored.`
              )
            }
          }
        }
      }
    }

    // Clean up internal operation fields for external consumers
    const cleaned: BlockConfig[] = result.map(({ component, weight, props, id, wrappers }) => ({
      component,
      weight,
      props,
      id,
      ...(wrappers ? { wrappers } : {}),
    }))

    // Cache the result
    this._sortedCache.set(zoneName, cleaned)

    return cleaned
  }

  /**
   * Collect all wrappers for a block, including nested wrappers
   *
   * If WrapperA wraps MainContent and WrapperB wraps WrapperA,
   * returns [WrapperA, WrapperB] (inner to outer before sorting)
   *
   * @param targetId - Block ID being wrapped
   * @param wrapsByTarget - Map of target ID -> wrapper blocks
   * @returns Array of wrapper block configs
   */
  private _collectWrapChain(
    targetId: string,
    wrapsByTarget: Map<string, InternalBlock[]>
  ): InternalBlock[] {
    const directWrappers = wrapsByTarget.get(targetId) || []

    if (directWrappers.length === 0) {
      return []
    }

    // Collect nested wrappers (wrappers of wrappers)
    const allWrappers = [...directWrappers]

    for (const wrapper of directWrappers) {
      const nestedWrappers = this._collectWrapChain(wrapper.id!, wrapsByTarget)
      allWrappers.push(...nestedWrappers)
    }

    return allWrappers
  }

  /**
   * Get zone default component
   *
   * @param zoneName - Zone name
   * @returns Default component or null
   */
  getDefault(zoneName: string): Component | null {
    const zone = this._zones.get(zoneName)
    return zone?.default ?? null
  }

  /**
   * Check if a zone has any blocks registered
   *
   * @param zoneName - Zone name
   * @returns Whether zone has blocks
   */
  hasBlocks(zoneName: string): boolean {
    const zone = this._zones.get(zoneName)
    return zone ? zone.blocks.length > 0 : false
  }

  /**
   * Check if a zone is defined
   *
   * @param zoneName - Zone name
   * @returns Whether zone exists
   */
  hasZone(zoneName: string): boolean {
    return this._zones.has(zoneName)
  }

  /**
   * List all defined zones with metadata
   *
   * Useful for debugging and introspection. Returns zone names with block counts.
   *
   * @returns Array of zone info objects
   */
  listZones(): ZoneListInfo[] {
    const result: ZoneListInfo[] = []
    for (const [name, zone] of this._zones) {
      result.push({
        name,
        blockCount: zone.blocks.length,
      })
    }
    return result
  }

  /**
   * Get zone info for debugging
   *
   * @param zoneName - Zone name
   * @returns Zone info or null if not defined
   */
  getZoneInfo(zoneName: string): ZoneDetailInfo | null {
    const zone = this._zones.get(zoneName)
    if (!zone) return null

    return {
      name: zoneName,
      hasDefault: zone.default !== null,
      blockCount: zone.blocks.length,
      blocks: zone.blocks.map((b) => ({
        id: b.id,
        weight: b.weight,
        hasProps: Object.keys(b.props).length > 0,
      })),
    }
  }

  /**
   * Inspect a zone for debugging - detailed view with component info
   *
   * Returns zone details including blocks with component names,
   * suitable for DevTools console inspection.
   *
   * @param zoneName - Zone name
   * @returns Detailed zone inspection or null if not defined
   */
  inspect(zoneName: string): ZoneInspection | null {
    const zone = this._zones.get(zoneName)
    if (!zone) return null

    // Get sorted blocks for accurate representation
    const sortedBlocks = this.getBlocks(zoneName)

    return {
      name: zoneName,
      blocks: sortedBlocks.map((b) => ({
        id: b.id ?? null,
        weight: b.weight ?? DEFAULT_WEIGHT,
        component: this._getComponentName(b.component),
        ...(b.wrappers
          ? {
              wrappers: b.wrappers.map((w) => ({
                id: w.id ?? null,
                component: this._getComponentName(w.component),
              })),
            }
          : {}),
      })),
      default: zone.default ? this._getComponentName(zone.default) : null,
    }
  }

  /**
   * Get a human-readable component name for debugging
   *
   * @param component - Vue component
   * @returns Component name or fallback
   */
  private _getComponentName(component: Component): string {
    if (!component) return '(none)'
    if (typeof component === 'string') return component
    const comp = component as { name?: string; __name?: string }
    return comp.name || comp.__name || '(anonymous)'
  }

  /**
   * Remove all blocks from a zone
   *
   * @param zoneName - Zone name
   * @returns This instance for chaining
   */
  clearZone(zoneName: string): this {
    const zone = this._zones.get(zoneName)
    if (zone) {
      const hadBlocks = zone.blocks.length > 0
      zone.blocks = []
      this._sortedCache.delete(zoneName)
      this._wrapGraph.delete(zoneName)

      // Trigger Vue reactivity update only if we removed blocks
      if (hadBlocks) {
        this._triggerUpdate()
      }
    }
    return this
  }

  /**
   * Remove a specific block by ID
   *
   * Also available as `unregisterBlock()` for semantic clarity in runtime scenarios.
   *
   * @param zoneName - Zone name
   * @param blockId - Block ID to remove
   * @returns True if block was found and removed
   */
  removeBlock(zoneName: string, blockId: string): boolean {
    const zone = this._zones.get(zoneName)
    if (!zone) {
      if (this._debug) {
        console.warn(`[ZoneRegistry] Cannot remove block "${blockId}": zone "${zoneName}" not found`)
      }
      return false
    }

    const index = zone.blocks.findIndex((b) => b.id === blockId)
    if (index === -1) {
      if (this._debug) {
        console.warn(`[ZoneRegistry] Block "${blockId}" not found in zone "${zoneName}"`)
      }
      return false
    }

    const block = zone.blocks[index]!
    zone.blocks.splice(index, 1)
    this._sortedCache.delete(zoneName)

    // Remove from wrap graph if it was a wrap operation
    if (block.operation === 'wrap') {
      const zoneGraph = this._wrapGraph.get(zoneName)
      if (zoneGraph) {
        zoneGraph.delete(blockId)
      }
    }

    // Trigger Vue reactivity update
    this._triggerUpdate()

    if (this._debug) {
      console.debug(`[qdadm:zones] Unregistered block from zone: ${zoneName}, ${blockId}`)
    }

    return true
  }

  /**
   * Unregister a block from a zone at runtime
   *
   * Alias for `removeBlock()` with semantic clarity for runtime block management.
   * Use this when dynamically adding/removing blocks based on user state, feature flags, etc.
   *
   * @param zoneName - Zone name
   * @param blockId - Block ID to unregister
   * @returns True if block was found and removed
   *
   * @example
   * // Register a block when component mounts
   * onMounted(() => {
   *   registry.registerBlock('sidebar', { component: AdBanner, weight: 50, id: 'ad-banner' })
   * })
   *
   * // Unregister when component unmounts
   * onUnmounted(() => {
   *   registry.unregisterBlock('sidebar', 'ad-banner')
   * })
   */
  unregisterBlock(zoneName: string, blockId: string): boolean {
    return this.removeBlock(zoneName, blockId)
  }

  /**
   * Clear all zones and blocks
   *
   * Useful for testing.
   *
   * @returns This instance for chaining
   */
  clear(): this {
    const hadZones = this._zones.size > 0
    this._zones.clear()
    this._sortedCache.clear()
    this._wrapGraph.clear()

    // Trigger Vue reactivity update only if we had zones
    if (hadZones) {
      this._triggerUpdate()
    }
    return this
  }
}

/**
 * Create a new ZoneRegistry instance
 *
 * @param options - Registry options
 * @returns ZoneRegistry instance
 */
export function createZoneRegistry(options: ZoneRegistryOptions = {}): ZoneRegistry {
  const registry = new ZoneRegistry()
  if (options.debug) {
    registry.setDebug(true)
  }
  return registry
}
