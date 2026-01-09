/**
 * useEntityItemPage - Base composable for single entity item pages
 *
 * Provides common functionality for pages that display a single entity:
 * - Entity loading by ID from route params
 * - Loading/error state management
 * - Breadcrumb integration (auto-calls setBreadcrumbEntity)
 * - Manager access for child composables
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
      if (breadcrumb) {
        setBreadcrumbEntity(transformed)
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

  if (loadOnMount) {
    onMounted(() => {
      if (entityId.value) {
        load()
      }
    })
  }

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

    // Actions
    load,
    reload,

    // References (for parent composables)
    manager,
    orchestrator,
    setBreadcrumbEntity
  }
}
