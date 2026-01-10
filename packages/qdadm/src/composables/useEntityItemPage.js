/**
 * useEntityItemPage - Base composable for single entity item pages
 *
 * Provides common functionality for pages that display a single entity:
 * - Entity loading by ID from route params
 * - Loading/error state management
 * - Breadcrumb integration (auto-calls setBreadcrumbEntity)
 * - Manager access for child composables
 * - **Parent chain auto-detection** from route.meta.parent
 *
 * Used as base for:
 * - Show pages (read-only detail pages)
 * - useEntityItemFormPage (create/edit forms)
 *
 * ## Basic Usage (standalone)
 *
 * ```js
 * const { data, loading, error, reload } = useEntityItemPage({ entity: 'posts' })
 *
 * // data.value contains the loaded entity
 * // loading.value is true while fetching
 * // error.value contains error message if failed
 * ```
 *
 * ## Parent Chain Auto-Detection
 *
 * When route.meta.parent is configured, the composable auto-loads the parent entity:
 *
 * ```js
 * // Route: /authors/:id/books/create
 * // route.meta.parent = { entity: 'authors', param: 'id', foreignKey: 'author_id' }
 *
 * const { parentData, parentId, getInitialDataWithParent } = useEntityItemPage({ entity: 'books' })
 *
 * // parentData.value = loaded author entity
 * // parentId.value = route.params.id
 * // getInitialDataWithParent() = { ...defaults, author_id: parentId }
 * ```
 *
 * ## Usage in parent composables
 *
 * ```js
 * function useEntityItemFormPage(config) {
 *   const itemPage = useEntityItemPage({
 *     entity: config.entity,
 *     loadOnMount: false,  // Form controls its own loading
 *     transformLoad: config.transformLoad
 *   })
 *
 *   // Use itemPage.load(), itemPage.data, etc.
 * }
 * ```
 */
import { ref, computed, onMounted, inject, provide } from 'vue'
import { useRoute } from 'vue-router'
import { useCurrentEntity } from './useCurrentEntity.js'

export function useEntityItemPage(config = {}) {
  const {
    entity,
    // Loading options
    loadOnMount = true,
    breadcrumb = true,
    // Parent chain options
    autoLoadParent = true,  // Auto-load parent entity from route.meta.parent
    // ID extraction
    getId = null,
    idParam = 'id',
    // Transform hook
    transformLoad = (data) => data,
    // Callbacks
    onLoadSuccess = null,
    onLoadError = null
  } = config

  const route = useRoute()

  // Get EntityManager via orchestrator
  const orchestrator = inject('qdadmOrchestrator')
  if (!orchestrator) {
    throw new Error(
      '[qdadm] Orchestrator not provided.\n' +
      'Possible causes:\n' +
      '1. Kernel not initialized - ensure createKernel().createApp() is called before mounting\n' +
      '2. Component used outside of qdadm app context\n' +
      '3. Missing entityFactory in Kernel options'
    )
  }
  const manager = orchestrator.get(entity)

  // Provide entity context for child components
  provide('mainEntity', entity)

  // Breadcrumb integration
  const { setBreadcrumbEntity } = useCurrentEntity()

  // ============ STATE ============

  const data = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // ============ PARENT CHAIN ============

  /**
   * Parent configuration from route.meta.parent
   * Structure: { entity, param, foreignKey, parent?: {...} }
   * Supports nested parents for N-level chains
   */
  const parentConfig = computed(() => route.meta?.parent || null)

  /**
   * Parent entity ID from route params (based on parentConfig.param)
   */
  const parentId = computed(() => {
    if (!parentConfig.value) return null
    return route.params[parentConfig.value.param] || null
  })

  /**
   * Loaded parent entities data (Map: level -> data)
   * Level 1 = immediate parent, Level 2 = grandparent, etc.
   */
  const parentChain = ref(new Map())
  const parentLoading = ref(false)

  /**
   * Immediate parent data (shortcut for level 1)
   */
  const parentData = computed(() => parentChain.value.get(1) || null)

  /**
   * Calculate the depth of the current entity in the parent chain
   * Returns number of parent levels + 1 for current entity
   */
  function getChainDepth(config = parentConfig.value) {
    if (!config) return 1
    let depth = 1
    let current = config
    while (current) {
      depth++
      current = current.parent
    }
    return depth
  }

  /**
   * Get parent entity manager (if parent is configured)
   */
  function getParentManager() {
    if (!parentConfig.value) return null
    return orchestrator.get(parentConfig.value.entity)
  }

  /**
   * Load entire parent chain recursively
   * Sets breadcrumb entities at correct levels (1 = top ancestor, N = immediate parent)
   */
  async function loadParentChain() {
    if (!parentConfig.value || !parentId.value) return

    parentLoading.value = true
    const newChain = new Map()

    try {
      // Calculate total depth to set correct breadcrumb levels
      // If chain is: grandparent -> parent -> current
      // grandparent = level 1, parent = level 2, current = level 3
      const totalDepth = getChainDepth()

      // Load chain from immediate parent up to root
      let currentConfig = parentConfig.value
      let level = 1  // Level in our chain (1 = immediate parent)

      while (currentConfig) {
        const parentEntityId = route.params[currentConfig.param]
        if (!parentEntityId) break

        const parentManager = orchestrator.get(currentConfig.entity)
        if (!parentManager) {
          console.warn(`[useEntityItemPage] Parent manager not found: ${currentConfig.entity}`)
          break
        }

        const data = await parentManager.get(parentEntityId)
        if (data) {
          newChain.set(level, data)

          // Set breadcrumb at correct level
          // breadcrumbLevel = totalDepth - level (so immediate parent is totalDepth-1, grandparent is totalDepth-2, etc.)
          // Actually we want: root ancestor = 1, next = 2, ..., immediate parent = totalDepth-1, current = totalDepth
          // So breadcrumbLevel = totalDepth - level
          if (breadcrumb) {
            const breadcrumbLevel = totalDepth - level
            setBreadcrumbEntity(data, breadcrumbLevel)
          }
        }

        currentConfig = currentConfig.parent
        level++
      }

      parentChain.value = newChain
    } catch (err) {
      console.warn('[useEntityItemPage] Failed to load parent chain:', err)
    } finally {
      parentLoading.value = false
    }
  }

  // Legacy alias for backwards compatibility
  const loadParent = loadParentChain

  /**
   * Get initial data with parent foreignKey auto-populated
   * Useful for form pages creating child entities
   */
  function getInitialDataWithParent() {
    const baseData = manager.getInitialData()

    if (!parentConfig.value || !parentId.value) {
      return baseData
    }

    // Auto-populate foreignKey with parent ID
    return {
      ...baseData,
      [parentConfig.value.foreignKey]: parentId.value
    }
  }

  // ============ ID EXTRACTION ============

  /**
   * Extract entity ID from route params
   * Supports custom getId function or param name
   */
  const entityId = computed(() => {
    if (getId) return getId()
    return route.params[idParam] || route.params.id || route.params.key || null
  })

  // ============ LOADING ============

  /**
   * Load entity by ID
   * @param {string|number} [id] - Optional ID override (defaults to route param)
   * @returns {Promise<object|null>} Loaded entity data or null on error
   */
  async function load(id = entityId.value) {
    if (!id) {
      error.value = 'No entity ID provided'
      return null
    }

    loading.value = true
    error.value = null

    try {
      const responseData = await manager.get(id)

      if (!responseData) {
        error.value = `${manager.label || entity} not found`
        return null
      }

      const transformed = transformLoad(responseData)
      data.value = transformed

      // Share with navigation context for breadcrumb
      // Level = depth of chain (1 if no parent, 2 if 1 parent, 3 if 2 parents, etc.)
      if (breadcrumb) {
        const level = getChainDepth()
        setBreadcrumbEntity(transformed, level)
      }

      if (onLoadSuccess) {
        await onLoadSuccess(transformed)
      }

      return transformed
    } catch (err) {
      console.error(`[useEntityItemPage] Failed to load ${entity}:`, err)
      error.value = err.response?.data?.detail || err.message || `Failed to load ${manager.label || entity}`

      if (onLoadError) {
        await onLoadError(err)
      }

      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Reload current entity
   */
  async function reload() {
    return load(entityId.value)
  }

  // ============ COMPUTED ============

  /**
   * Entity label (uses manager.getEntityLabel)
   */
  const entityLabel = computed(() => {
    if (!data.value) return null
    return manager.getEntityLabel(data.value)
  })

  /**
   * Check if entity is loaded
   */
  const isLoaded = computed(() => data.value !== null)

  // ============ LIFECYCLE ============

  onMounted(async () => {
    // Auto-load parent entity if configured
    if (autoLoadParent && parentConfig.value && parentId.value) {
      await loadParent()
    }

    // Load current entity
    if (loadOnMount && entityId.value) {
      load()
    }
  })

  // ============ RETURN ============

  return {
    // State
    data,
    loading,
    error,

    // Computed
    entityId,
    entityLabel,
    isLoaded,

    // Parent chain (supports N-level nesting)
    parentConfig,
    parentId,
    parentData,        // Immediate parent (level 1)
    parentChain,       // All parents: Map(level -> data)
    parentLoading,
    loadParent,        // Alias for loadParentChain
    loadParentChain,
    getParentManager,
    getChainDepth,
    getInitialDataWithParent,

    // Actions
    load,
    reload,

    // References (for parent composables)
    manager,
    orchestrator,
    setBreadcrumbEntity
  }
}
