/**
 * useEntityItemPage - Base composable for single entity item pages
 *
 * Provides common functionality for pages that display a single entity:
 * - Entity loading by ID from route params
 * - Loading/error state management
 * - Active stack integration (auto-updates navigation context)
 * - Manager access for child composables
 * - **Parent chain auto-detection** from route.meta.parent
 *
 * Used as base for:
 * - Show pages (read-only detail pages)
 * - useEntityItemFormPage (create/edit forms)
 */
import { ref, computed, onMounted, inject, provide, type Ref, type ComputedRef } from 'vue'
import { useRoute } from 'vue-router'
import { useStackHydrator, type StackHydratorReturn } from '../chain/useStackHydrator'
import type { EntityManagerCrud } from '../entity/EntityManager.interface'

/**
 * Parent configuration from route.meta.parent
 */
export interface ParentConfig {
  entity: string
  param: string
  foreignKey?: string
  parent?: ParentConfig
}

/**
 * Field definition interface
 */
export interface FieldDefinition {
  name: string
  type?: string
  schemaType?: string
  label?: string
  required?: boolean
  default?: unknown
  options?: unknown[]
  optionLabel?: string
  optionValue?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  editable?: boolean
  reference?: string
  validate?: (value: unknown, formData: unknown) => boolean | string | null | undefined
  [key: string]: unknown
}

/**
 * Context for create operation with parent chain
 */
export interface CreateContext {
  parentChain?: Array<{ entity: string; id: string | number }>
}

/**
 * Entity manager interface for entity item pages (re-export for convenience)
 */
export type EntityManager = EntityManagerCrud

/**
 * Orchestrator interface
 */
interface Orchestrator {
  get: (entityName: string) => EntityManager
}

/**
 * Options for useEntityItemPage
 */
export interface UseEntityItemPageOptions {
  /** Entity name */
  entity: string
  /** Auto-load entity on mount (default: true) */
  loadOnMount?: boolean
  /** Auto-load parent entity from route.meta.parent (default: true) */
  autoLoadParent?: boolean
  /** Custom ID extraction function */
  getId?: (() => string | number | null) | null
  /** Transform hook for loaded data */
  transformLoad?: (data: unknown) => unknown
  /** Callback on successful load */
  onLoadSuccess?: ((data: unknown) => Promise<void> | void) | null
  /** Callback on load error */
  onLoadError?: ((error: unknown) => Promise<void> | void) | null
}

/**
 * Return type for useEntityItemPage
 */
export interface UseEntityItemPageReturn {
  // State
  data: Ref<unknown>
  loading: Ref<boolean>
  error: Ref<string | null>

  // Computed
  entityId: ComputedRef<string | number | null>
  entityLabel: ComputedRef<string | null>
  isLoaded: ComputedRef<boolean>

  // Parent chain
  parentConfig: ComputedRef<ParentConfig | null>
  parentId: ComputedRef<string | number | null>
  parentData: ComputedRef<unknown | null>
  parentChain: Ref<Map<number, unknown>>
  parentLoading: Ref<boolean>
  loadParent: () => Promise<void>
  loadParentChain: () => Promise<void>
  getParentManager: () => EntityManager | null
  getChainDepth: (config?: ParentConfig | null) => number
  getInitialDataWithParent: () => Record<string, unknown>

  // Actions
  load: (id?: string | number | null) => Promise<unknown | null>
  reload: () => Promise<unknown | null>

  // References
  manager: EntityManager
  orchestrator: Orchestrator

  // Stack hydrator
  hydrator: StackHydratorReturn
}

export function useEntityItemPage(config: UseEntityItemPageOptions): UseEntityItemPageReturn {
  const {
    entity,
    // Loading options
    loadOnMount = true,
    // Parent chain options
    autoLoadParent = true, // Auto-load parent entity from route.meta.parent
    // ID extraction (custom function for special cases, otherwise uses manager.idField)
    getId = null,
    // Transform hook
    transformLoad = (data: unknown) => data,
    // Callbacks
    onLoadSuccess = null,
    onLoadError = null,
  } = config

  const route = useRoute()

  // Get EntityManager via orchestrator
  const orchestrator = inject<Orchestrator | null>('qdadmOrchestrator')
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

  // Stack hydrator for setting entity data on navigation context
  const hydrator = useStackHydrator()

  // ============ STATE ============

  const data = ref<unknown>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ============ PARENT CHAIN ============

  /**
   * Parent configuration from route.meta.parent
   * Structure: { entity, param, foreignKey, parent?: {...} }
   * Supports nested parents for N-level chains
   */
  const parentConfig = computed(() => (route.meta?.parent as ParentConfig) || null)

  /**
   * Parent entity ID from route params (based on parentConfig.param)
   */
  const parentId = computed(() => {
    if (!parentConfig.value) return null
    return (route.params[parentConfig.value.param] as string | number) || null
  })

  /**
   * Loaded parent entities data (Map: level -> data)
   * Level 1 = immediate parent, Level 2 = grandparent, etc.
   */
  const parentChain = ref<Map<number, unknown>>(new Map())
  const parentLoading = ref(false)

  /**
   * Immediate parent data (shortcut for level 1)
   */
  const parentData = computed(() => parentChain.value.get(1) || null)

  /**
   * Calculate the depth of the current entity in the parent chain
   * Returns number of parent levels + 1 for current entity
   */
  function getChainDepth(cfg: ParentConfig | null = parentConfig.value): number {
    if (!cfg) return 1
    let depth = 1
    let current: ParentConfig | undefined = cfg
    while (current) {
      depth++
      current = current.parent
    }
    return depth
  }

  /**
   * Get parent entity manager (if parent is configured)
   */
  function getParentManager(): EntityManager | null {
    if (!parentConfig.value) return null
    return orchestrator!.get(parentConfig.value.entity)
  }

  /**
   * Load entire parent chain recursively
   * Sets breadcrumb entities at correct levels (1 = top ancestor, N = immediate parent)
   */
  async function loadParentChain(): Promise<void> {
    if (!parentConfig.value || !parentId.value) return

    parentLoading.value = true
    const newChain = new Map<number, unknown>()

    try {
      // Calculate total depth to set correct breadcrumb levels
      // If chain is: grandparent -> parent -> current
      // grandparent = level 1, parent = level 2, current = level 3
      // const totalDepth = getChainDepth()

      // Load chain from immediate parent up to root
      let currentConfig: ParentConfig | undefined = parentConfig.value
      let level = 1 // Level in our chain (1 = immediate parent)

      while (currentConfig) {
        const parentEntityId = route.params[currentConfig.param] as string
        if (!parentEntityId) break

        const parentManager = orchestrator!.get(currentConfig.entity)
        if (!parentManager) {
          console.warn(`[useEntityItemPage] Parent manager not found: ${currentConfig.entity}`)
          break
        }

        const loadedData = await parentManager.get(parentEntityId)
        if (loadedData) {
          newChain.set(level, loadedData)

          // Update active stack
          hydrator.setEntityData(currentConfig.entity, loadedData)
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
  function getInitialDataWithParent(): Record<string, unknown> {
    const baseData = manager.getInitialData()

    if (!parentConfig.value || !parentId.value) {
      return baseData
    }

    // Auto-populate foreignKey with parent ID
    return {
      ...baseData,
      [parentConfig.value.foreignKey || '']: parentId.value,
    }
  }

  // ============ ID EXTRACTION ============

  /**
   * Extract entity ID from route params
   * Uses manager.idField as route param name (single source of truth)
   * Supports custom getId function for special cases
   */
  const entityId = computed(() => {
    if (getId) return getId()
    // Use manager.idField as route param name, with fallbacks for common patterns
    return (
      (route.params[manager.idField] as string | number) ||
      (route.params.id as string | number) ||
      (route.params.key as string | number) ||
      null
    )
  })

  // ============ LOADING ============

  /**
   * Load entity by ID
   * @param id - Optional ID override (defaults to route param)
   * @returns Loaded entity data or null on error
   */
  async function load(id: string | number | null = entityId.value): Promise<unknown | null> {
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

      // Update active stack
      hydrator.setCurrentData(transformed)

      if (onLoadSuccess) {
        await onLoadSuccess(transformed)
      }

      return transformed
    } catch (err) {
      console.error(`[useEntityItemPage] Failed to load ${entity}:`, err)
      const axiosError = err as { response?: { data?: { detail?: string } }; message?: string }
      error.value =
        axiosError.response?.data?.detail ||
        axiosError.message ||
        `Failed to load ${manager.label || entity}`

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
  async function reload(): Promise<unknown | null> {
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
    parentData, // Immediate parent (level 1)
    parentChain, // All parents: Map(level -> data)
    parentLoading,
    loadParent, // Alias for loadParentChain
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

    // Stack hydrator (for setting entity data on navigation context)
    hydrator,
  }
}
