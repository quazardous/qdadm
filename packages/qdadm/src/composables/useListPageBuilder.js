import { ref, computed, watch, onMounted, inject, provide } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { useHooks } from './useHooks.js'
import { FilterQuery } from '../query/FilterQuery.js'

// Cookie utilities for pagination persistence
const COOKIE_NAME = 'qdadm_pageSize'
const COOKIE_EXPIRY_DAYS = 365

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : null
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}

function getSavedPageSize(defaultSize) {
  const saved = getCookie(COOKIE_NAME)
  if (saved) {
    const parsed = parseInt(saved, 10)
    if ([10, 50, 100].includes(parsed)) return parsed
  }
  return defaultSize
}

// Default label fallback: convert snake_case to Title Case
function snakeToTitle(str) {
  if (!str) return 'Unknown'
  return String(str).split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

// Standard pagination options
export const PAGE_SIZE_OPTIONS = [10, 50, 100]

// Session storage utilities for filter persistence
const FILTER_SESSION_PREFIX = 'qdadm_filters_'

function getSessionFilters(key) {
  try {
    const stored = sessionStorage.getItem(FILTER_SESSION_PREFIX + key)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function setSessionFilters(key, filters) {
  try {
    sessionStorage.setItem(FILTER_SESSION_PREFIX + key, JSON.stringify(filters))
  } catch {
    // Ignore storage errors
  }
}

/**
 * useListPageBuilder - Unified procedural builder for CRUD list pages
 *
 * Provides a declarative/procedural API to build list pages with:
 * - Cards zone (stats, custom content)
 * - Filter bar with search and custom filters
 * - DataTable with columns and actions
 * - Bulk selection and operations
 *
 * ## Filter Modes
 *
 * The threshold decides everything:
 * - `items >= threshold` → **manager mode**: delegate ALL filtering to EntityManager
 * - `items < threshold` → **local mode**: filter client-side
 *
 * Modes:
 * - `filterMode: 'manager'` - Always delegate to EntityManager
 * - `filterMode: 'local'` - Always filter client-side
 * - `filterMode: 'auto'` (default) - Switch to local if items < threshold
 *
 * Threshold priority: config `autoFilterThreshold` > `manager.localFilterThreshold` > 100
 *
 * ## toQuery - Virtual Filter to Query Mapping
 *
 * Use `toQuery` for virtual filters that map to real entity fields:
 *
 * ```js
 * list.addFilter('status', {
 *   options: [
 *     { label: 'Active', value: 'active' },
 *     { label: 'Returned', value: 'returned' }
 *   ],
 *   toQuery: (value) => {
 *     if (value === 'active') return { returned_at: null }
 *     if (value === 'returned') return { returned_at: { $ne: null } }
 *     return {}
 *   }
 * })
 * ```
 *
 * The query is processed by QueryExecutor (local cache) or sent to API.
 *
 * ## Basic Usage
 *
 * ```js
 * const list = useListPageBuilder({ entity: 'domains' })
 * list.addFilter('status', { options: [...] })
 * list.setSearch({ fields: ['name', 'email'] })
 * list.addCreateAction()
 * list.addEditAction()
 * ```
 */
export function useListPageBuilder(config = {}) {
  const {
    entity,
    dataKey,
    defaultSort = null,
    defaultSortOrder = -1,
    serverSide = false,
    pageSize: defaultPageSize = 10,
    loadOnMount = true,
    persistFilters = true,  // Save filters to sessionStorage
    syncUrlParams = true,   // Sync filters to URL query params

    // Filter mode: 'auto' | 'manager' | 'local'
    // auto: switch to local if items < autoFilterThreshold
    filterMode = 'auto',
    autoFilterThreshold = 100,

    // Auto-load filters from registry
    autoLoadFilters = true,

    // Hooks for custom behavior
    onBeforeLoad = null,     // (params) => params | modified params
    onAfterLoad = null,      // (response, processedData) => void
    transformResponse = null // (response) => { items, total, ...extras }
  } = config

  const router = useRouter()
  const route = useRoute()
  const toast = useToast()
  const confirm = useConfirm()

  // Get EntityManager via orchestrator
  const orchestrator = inject('qdadmOrchestrator')
  if (!orchestrator) {
    throw new Error('[qdadm] Orchestrator not provided. Make sure to use createQdadm() with entityFactory.')
  }
  const manager = orchestrator.get(entity)

  // Provide entity context for child components (e.g., SeverityTag auto-discovery)
  provide('mainEntity', entity)

  // Read config from manager with option overrides
  const entityName = config.entityName ?? manager.label
  const entityNamePlural = config.entityNamePlural ?? manager.labelPlural
  const routePrefix = config.routePrefix ?? manager.routePrefix
  const resolvedDataKey = dataKey ?? manager.idField ?? 'id'

  // Session key for filter persistence (based on entity name)
  const filterSessionKey = entity || entityName

  // Entity filters registry (optional, provided by consuming app)
  const entityFilters = inject('qdadmEntityFilters', {})

  // Get HookRegistry for list:alter hook (optional, may not exist in tests)
  const hooks = useHooks()

  // ============ STATE ============
  const items = ref([])
  const loading = ref(false)
  const selected = ref([])
  const deleting = ref(false)

  // Pagination (load from cookie if available)
  const page = ref(1)
  const pageSize = ref(getSavedPageSize(defaultPageSize))
  const totalRecords = ref(0)
  const rowsPerPageOptions = PAGE_SIZE_OPTIONS

  // Sorting
  const sortField = ref(defaultSort)
  const sortOrder = ref(defaultSortOrder)

  // Search
  const searchQuery = ref('')
  const searchConfig = ref({
    placeholder: 'Search...',
    fields: [],
    debounce: 300
  })

  // ============ COLUMNS ============
  const columnsMap = ref(new Map())

  /**
   * Add a column to the list
   * @param {string} field - Field name (unique identifier)
   * @param {object} columnConfig - Column configuration
   * @param {string} [columnConfig.header] - Column header label
   * @param {boolean} [columnConfig.sortable] - Whether column is sortable
   * @param {string} [columnConfig.style] - Inline style
   * @param {Function} [columnConfig.body] - Custom body template function
   */
  function addColumn(field, columnConfig = {}) {
    columnsMap.value.set(field, {
      field,
      header: columnConfig.header || field.charAt(0).toUpperCase() + field.slice(1),
      ...columnConfig
    })
  }

  function removeColumn(field) {
    columnsMap.value.delete(field)
  }

  function updateColumn(field, updates) {
    const existing = columnsMap.value.get(field)
    if (existing) {
      columnsMap.value.set(field, { ...existing, ...updates })
    }
  }

  const columns = computed(() => Array.from(columnsMap.value.values()))

  // ============ HEADER ACTIONS ============
  const headerActionsMap = ref(new Map())

  /**
   * Add a header action button
   * @param {string} name - Unique identifier
   * @param {object} config - Button configuration
   * @param {string} config.label - Button label
   * @param {string} [config.icon] - PrimeVue icon
   * @param {string} [config.severity] - Button severity
   * @param {function} config.onClick - Click handler
   * @param {function} [config.visible] - Optional (state) => boolean
   * @param {function} [config.loading] - Optional (state) => boolean
   */
  function addHeaderAction(name, config) {
    headerActionsMap.value.set(name, { name, ...config })
  }

  function removeHeaderAction(name) {
    headerActionsMap.value.delete(name)
  }

  /**
   * Get header actions with resolved state
   */
  function getHeaderActions() {
    const state = { hasSelection: hasSelection.value, selectionCount: selectionCount.value, deleting: deleting.value }
    const actions = []
    for (const [, action] of headerActionsMap.value) {
      if (action.visible && !action.visible(state)) continue
      actions.push({
        ...action,
        isLoading: action.loading ? action.loading(state) : false
      })
    }
    return actions
  }

  const headerActions = computed(() => getHeaderActions())

  // ============ PERMISSION STATE ============

  /**
   * Whether the current user can create new entities
   * Reactive computed based on manager.canCreate()
   */
  const canCreate = computed(() => manager.canCreate())

  /**
   * Whether the current user can delete entities (general scope check)
   * For row-level checks, use canDeleteRow(row)
   */
  const canDelete = computed(() => manager.canDelete())

  /**
   * Check if user can edit a specific row (scope + silo check)
   * @param {object} row - The row/record to check
   * @returns {boolean}
   */
  function canEditRow(row) {
    return manager.canUpdate(row)
  }

  /**
   * Check if user can delete a specific row (scope + silo check)
   * @param {object} row - The row/record to check
   * @returns {boolean}
   */
  function canDeleteRow(row) {
    return manager.canDelete(row)
  }

  /**
   * Get actions for a row, filtering out those the user cannot perform
   * This is the permission-aware version of getActions()
   * @param {object} row - The row to get actions for
   * @returns {Array} - Filtered list of actions the user can perform
   */
  function getRowActions(row) {
    return getActions(row)
  }

  /**
   * Add standard "Create" header action
   * Respects manager.canCreate() for visibility
   */
  function addCreateAction(label = null) {
    const createLabel = label || `Create ${entityName.charAt(0).toUpperCase() + entityName.slice(1)}`
    addHeaderAction('create', {
      label: createLabel,
      icon: 'pi pi-plus',
      onClick: goToCreate,
      visible: () => manager.canCreate()
    })
  }

  /**
   * Add standard "Bulk Delete" header action (visible only when selection)
   * Respects manager.canDelete() for visibility
   */
  function addBulkDeleteAction() {
    addHeaderAction('bulk-delete', {
      label: (state) => `Delete (${state.selectionCount})`,
      icon: 'pi pi-trash',
      severity: 'danger',
      onClick: confirmBulkDelete,
      visible: (state) => state.hasSelection && manager.canDelete(),
      loading: (state) => state.deleting
    })
  }

  // ============ BULK STATUS ACTION ============
  /**
   * Add a bulk status change action with dialog
   * Returns state and functions for use with BulkStatusDialog component
   *
   * @param {object} bulkConfig - Configuration
   * @param {string} [bulkConfig.statusField='status'] - Field name for status in API payload
   * @param {string} [bulkConfig.idsField='ids'] - Field name for IDs in API payload
   * @param {string} [bulkConfig.bulkEndpoint] - Custom endpoint (default: `${endpoint}/bulk/status`)
   * @param {Array} bulkConfig.options - Status options array [{label, value}]
   * @param {string} [bulkConfig.label='Change Status'] - Button label
   * @param {string} [bulkConfig.icon='pi pi-sync'] - Button icon
   * @param {string} [bulkConfig.dialogTitle='Change Status'] - Dialog title
   * @returns {object} State and functions for the dialog
   */
  function addBulkStatusAction(bulkConfig = {}) {
    const {
      statusField = 'status',
      idsField = 'ids',
      bulkEndpoint = null,
      options = [],
      label = 'Change Status',
      icon = 'pi pi-sync',
      dialogTitle = 'Change Status'
    } = bulkConfig

    // Internal state for the dialog
    const showDialog = ref(false)
    const selectedStatus = ref(null)
    const updating = ref(false)

    // Add header action
    addHeaderAction('bulk-status', {
      label: (state) => `${label} (${state.selectionCount})`,
      icon,
      severity: 'info',
      onClick: () => { showDialog.value = true },
      visible: (state) => state.hasSelection,
      loading: () => updating.value
    })

    // Execute bulk status change
    async function execute() {
      if (!selectedStatus.value || selected.value.length === 0) return

      updating.value = true
      try {
        const ids = selected.value.map(item => item[resolvedDataKey])
        const bulkPath = bulkEndpoint || 'bulk/status'

        const payload = {
          [idsField]: ids,
          [statusField]: selectedStatus.value
        }

        const response = await manager.request('PATCH', bulkPath, { data: payload })

        // Handle standard response format {updated, failed, errors}
        if (response.updated > 0) {
          toast.add({
            severity: 'success',
            summary: 'Updated',
            detail: `${response.updated} ${response.updated > 1 ? entityNamePlural : entityName} updated`,
            life: 3000
          })
        }
        if (response.failed > 0) {
          toast.add({
            severity: 'warn',
            summary: 'Partial Success',
            detail: `${response.failed} ${response.failed > 1 ? entityNamePlural : entityName} failed`,
            life: 5000
          })
        }

        // Reset state
        selected.value = []
        selectedStatus.value = null
        showDialog.value = false
        loadItems({}, { force: true })
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: error.response?.data?.detail || 'Bulk update failed',
          life: 5000
        })
      } finally {
        updating.value = false
      }
    }

    // Cancel and reset
    function cancel() {
      showDialog.value = false
      selectedStatus.value = null
    }

    // Support reactive options (can be updated after initialization)
    const statusOptions = ref(options)

    function setOptions(newOptions) {
      statusOptions.value = newOptions
    }

    return {
      showDialog,
      selectedStatus,
      updating,
      statusOptions,  // Now a ref for reactivity
      dialogTitle,
      execute,
      cancel,
      setOptions  // Allow updating options after async load
    }
  }

  // ============ CARDS ============
  const cardsMap = ref(new Map())

  function addCard(name, cardConfig) {
    cardsMap.value.set(name, { name, ...cardConfig })
  }

  function updateCard(name, cardConfig) {
    const existing = cardsMap.value.get(name)
    if (existing) {
      cardsMap.value.set(name, { ...existing, ...cardConfig })
    }
  }

  function removeCard(name) {
    cardsMap.value.delete(name)
  }

  const cards = computed(() => Array.from(cardsMap.value.values()))

  // ============ FILTERS ============
  const filtersMap = ref(new Map())
  // Load saved filters from session storage
  const savedFilters = persistFilters ? getSessionFilters(filterSessionKey) : null
  const filterValues = ref(savedFilters || {})

  function addFilter(name, filterConfig) {
    filtersMap.value.set(name, {
      name,
      type: 'select', // select, multiselect, date, checkbox
      placeholder: name,
      ...filterConfig
    })
    // Initialize filter value (respect saved value if present)
    if (filterValues.value[name] === undefined) {
      filterValues.value[name] = filterConfig.default ?? null
    }
  }

  function removeFilter(name) {
    filtersMap.value.delete(name)
    delete filterValues.value[name]
  }

  function setFilterValue(name, value) {
    // Replace entire object to trigger watch
    filterValues.value = { ...filterValues.value, [name]: value }
  }

  function updateFilters(newValues) {
    filterValues.value = { ...filterValues.value, ...newValues }
    // Directly trigger reload and persistence (don't rely on watch)
    onFiltersChanged()
  }

  function onFiltersChanged() {
    page.value = 1
    loadItems()
    // Persist filters + search to session storage
    if (persistFilters) {
      const toPersist = {}
      for (const [name, value] of Object.entries(filterValues.value)) {
        const filterDef = filtersMap.value.get(name)
        if (filterDef?.persist !== false && value !== null && value !== undefined && value !== '') {
          toPersist[name] = value
        }
      }
      // Also persist search query
      if (searchQuery.value) {
        toPersist._search = searchQuery.value
      }
      setSessionFilters(filterSessionKey, toPersist)
    }
    // Sync to URL query params
    if (syncUrlParams) {
      const query = { ...route.query }
      for (const [name, value] of Object.entries(filterValues.value)) {
        if (value !== null && value !== undefined && value !== '') {
          query[name] = String(value)
        } else {
          delete query[name]
        }
      }
      if (searchQuery.value) {
        query.search = searchQuery.value
      } else {
        delete query.search
      }
      router.replace({ query })
    }
  }

  function clearFilters() {
    // Build cleared filter values
    const cleared = {}
    for (const key of Object.keys(filterValues.value)) {
      cleared[key] = null
    }
    filterValues.value = cleared
    // Clear search
    searchQuery.value = ''
    // Clear session storage
    if (persistFilters) {
      sessionStorage.removeItem(FILTER_SESSION_PREFIX + filterSessionKey)
    }
    // Clear URL params (filters + search)
    if (syncUrlParams) {
      const query = { ...route.query }
      for (const key of filtersMap.value.keys()) {
        delete query[key]
      }
      delete query.search
      router.replace({ query })
    }
    // Reload data
    page.value = 1
    loadItems()
  }

  const filters = computed(() => Array.from(filtersMap.value.values()))

  // ============ AUTO-LOAD FROM REGISTRY ============
  /**
   * Initialize filters and search from entity registry
   */
  function initFromRegistry() {
    if (!autoLoadFilters) return

    const entityConfig = entityFilters[entityName]
    if (!entityConfig) return

    // Auto-configure search
    if (entityConfig.search) {
      setSearch(entityConfig.search)
    }

    // Auto-add filters
    if (entityConfig.filters) {
      for (const filterDef of entityConfig.filters) {
        addFilter(filterDef.name, filterDef)
      }
    }
  }

  // Smart filter auto-discovery threshold
  const SMART_FILTER_THRESHOLD = 50

  /**
   * Load filter options from various sources (smart filter modes)
   *
   * Smart filter modes (in priority order):
   * 1. `optionsEntity` - fetch from related EntityManager
   * 2. `optionsEndpoint` - fetch from API endpoint (true = auto, string = custom URL)
   * 3. `optionsFromCache` - extract from items cache (handled separately via watcher)
   *
   * Cache options behavior (`cacheOptions`):
   * - `true`: Cache options, use dropdown (default for small datasets)
   * - `false`: No cache, use autocomplete (default for large datasets)
   * - `'auto'` (default): First load decides based on count (≤50 → cache, >50 → no cache)
   *
   * Component selection (`component`):
   * - `'dropdown'`: PrimeVue Select (default when cached)
   * - `'autocomplete'`: PrimeVue AutoComplete (default when not cached)
   * - Explicit `component` prop overrides auto-selection
   *
   * After loading, invokes filter:alter and {entity}:filter:alter hooks.
   */
  async function loadFilterOptions() {
    // Process filters configured directly via addFilter() (smart filter modes)
    for (const [filterName, filterDef] of filtersMap.value) {
      // Skip if explicit options already provided (not smart filter)
      if (filterDef.options?.length > 1) continue
      // Skip optionsFromCache - handled by watcher
      if (filterDef.optionsFromCache) continue

      try {
        let rawOptions = null

        // Mode 1: optionsEntity - fetch from related EntityManager via FilterQuery
        if (filterDef.optionsEntity) {
          // Create FilterQuery from legacy optionsEntity config (T279)
          // This centralizes option resolution through FilterQuery while maintaining
          // backward compatibility with existing optionsEntity/optionLabel/optionValue syntax
          //
          // Note: processor is NOT passed to FilterQuery.transform because the existing
          // behavior applies processor AFTER adding "All X" option. FilterQuery.transform
          // would apply it before. For backward compatibility, we handle processor manually.
          const filterQuery = new FilterQuery({
            source: 'entity',
            entity: filterDef.optionsEntity,
            label: filterDef.optionLabel || 'name',
            value: filterDef.optionValue || 'id'
            // transform: intentionally not set - processor applied after "All X" is added
          })

          // Get options via FilterQuery.getOptions()
          rawOptions = await filterQuery.getOptions(orchestrator)

          // Store the FilterQuery instance on filterDef for potential cache invalidation
          filterDef._filterQuery = filterQuery
        }
        // Mode 2: optionsEndpoint - fetch from API endpoint
        else if (filterDef.optionsEndpoint) {
          const endpoint = filterDef.optionsEndpoint === true
            ? `distinct/${filterName}`
            : filterDef.optionsEndpoint
          const response = await manager.request('GET', endpoint)
          const data = Array.isArray(response) ? response : response?.items || []
          rawOptions = data.map(opt => {
            // Handle both primitive values and objects
            if (typeof opt === 'object' && opt !== null) {
              return {
                label: opt.label || opt.name || String(opt.value ?? opt.id),
                value: opt.value ?? opt.id
              }
            }
            // Primitive value
            return { label: snakeToTitle(String(opt)), value: opt }
          })
        }

        // Apply options if loaded
        if (rawOptions !== null) {
          // Log filter options for validation
          console.log('[filterquery] Options loaded for:', filterName, '(count:', rawOptions.length, ')')

          // Determine cache behavior
          const cacheOptions = filterDef.cacheOptions ?? 'auto'
          let shouldCache = cacheOptions === true

          // Auto-discovery: >50 items → no cache + autocomplete
          if (cacheOptions === 'auto') {
            shouldCache = rawOptions.length <= SMART_FILTER_THRESHOLD
          }

          // Determine component type (explicit override or based on cache)
          // Use 'type' for ListPage.vue compatibility
          const componentType = filterDef.component || (shouldCache ? 'dropdown' : 'autocomplete')

          // Generate "All X" label from placeholder or filterName
          const allLabel = filterDef.allLabel || filterDef.placeholder || `All ${snakeToTitle(filterName)}`
          let finalOptions = [{ label: allLabel, value: null }, ...rawOptions]

          // Apply processor callback if configured
          if (typeof filterDef.processor === 'function') {
            finalOptions = filterDef.processor(finalOptions)
          }

          // Options are normalized to { label, value } - remove source-specific field mappings
          // so ListPage.vue uses defaults (optionLabel='label', optionValue='value')
          const updatedFilter = {
            ...filterDef,
            options: finalOptions,
            type: componentType,
            _cacheOptions: shouldCache,
            _optionsLoaded: shouldCache  // Only mark as loaded if caching
          }
          delete updatedFilter.optionLabel
          delete updatedFilter.optionValue
          filtersMap.value.set(filterName, updatedFilter)
        }
      } catch (error) {
        console.warn(`[qdadm] Failed to load options for filter "${filterName}":`, error)
      }
    }

    // Legacy: Load options from registry (entityFilters)
    const entityConfig = entityFilters[entityName]
    if (entityConfig?.filters) {
      for (const filterDef of entityConfig.filters) {
        if (!filterDef.optionsEndpoint) continue

        try {
          const optionsManager = filterDef.optionsEntity
            ? orchestrator.get(filterDef.optionsEntity)
            : manager

          let rawOptions
          if (filterDef.optionsEntity) {
            const response = await optionsManager.list({ page_size: 1000 })
            rawOptions = response.items || []
          } else {
            rawOptions = await manager.request('GET', filterDef.optionsEndpoint)
            rawOptions = Array.isArray(rawOptions) ? rawOptions : rawOptions?.items || []
          }

          // Generate "All X" label from placeholder or filterName
          const filterName = filterDef.field || filterDef.name || 'Items'
          const allLabel = filterDef.allLabel || filterDef.placeholder || `All ${snakeToTitle(filterName)}`
          let finalOptions = [{ label: allLabel, value: null }]
          if (filterDef.includeNull) {
            finalOptions.push(filterDef.includeNull)
          }

          const labelField = filterDef.optionLabelField || 'label'
          const valueField = filterDef.optionValueField || 'value'
          const labelMap = filterDef.labelMap || {}
          const labelFallback = filterDef.labelFallback || snakeToTitle

          const mappedOptions = rawOptions.map(opt => {
            const value = opt[valueField] ?? opt.id ?? opt
            let label = labelMap[value]
            if (!label) {
              label = opt[labelField] || opt.name
            }
            if (!label) {
              label = labelFallback(value)
            }
            return { label, value }
          })

          finalOptions = [...finalOptions, ...mappedOptions]

          const existing = filtersMap.value.get(filterDef.name)
          if (existing) {
            filtersMap.value.set(filterDef.name, { ...existing, options: finalOptions })
          }
        } catch (error) {
          console.warn(`Failed to load options for filter ${filterDef.name}:`, error)
        }
      }
    }

    // Invoke filter:alter hooks after all options are loaded (always runs)
    await invokeFilterAlterHook()

    // Trigger Vue reactivity by replacing the Map reference
    filtersMap.value = new Map(filtersMap.value)
  }

  /**
   * Update filter options from cache (optionsFromCache mode)
   * Called when items.value changes
   *
   * IMPORTANT: Options are only extracted once (on first load with unfiltered data).
   * This prevents options from disappearing when filtering reduces the visible items.
   *
   * Cache behavior for optionsFromCache:
   * - Always cached by nature (extracted from loaded items)
   * - Component type follows same rules: ≤50 → dropdown, >50 → autocomplete
   * - Explicit `component` prop overrides auto-selection
   *
   * Implementation uses FilterQuery with source='field' internally (T281).
   * This centralizes option resolution logic while maintaining backward compatibility.
   */
  async function updateCacheBasedFilters() {
    if (items.value.length === 0) return

    let hasChanges = false

    for (const [filterName, filterDef] of filtersMap.value) {
      // Skip if no optionsFromCache config
      if (!filterDef.optionsFromCache) continue

      // Skip if filter already has explicit query property (advanced usage)
      if (filterDef.query) continue

      // Skip if options already loaded (prevents options disappearing when filtering)
      if (filterDef._optionsLoaded) continue

      // Skip if this filter is currently active - wait for unfiltered data to extract all options
      // This ensures we capture all possible values, not just those visible with current filter
      const currentValue = filterValues.value[filterName]
      if (currentValue !== null && currentValue !== undefined && currentValue !== '') {
        continue
      }

      // Determine field name: explicit string or use filter name
      const fieldName = typeof filterDef.optionsFromCache === 'string'
        ? filterDef.optionsFromCache
        : filterName

      // Create FilterQuery with source='field' from optionsFromCache config (T281)
      // This centralizes unique value extraction through FilterQuery
      // Note: processor is NOT passed to FilterQuery.transform because the old API
      // called processor AFTER adding "All X" and applying snakeToTitle to labels.
      // We preserve this behavior by applying processor after our own post-processing.
      const filterQuery = new FilterQuery({
        source: 'field',
        field: fieldName
      })

      // Set parentManager reference - FilterQuery expects object with _cache array
      // We wrap items.value to match the expected interface
      filterQuery.setParentManager({ _cache: items.value })

      // Get options via FilterQuery.getOptions()
      const rawOptions = await filterQuery.getOptions()

      // Determine cache behavior (optionsFromCache is always cached)
      const cacheOptions = filterDef.cacheOptions ?? 'auto'
      let shouldCache = true  // optionsFromCache is inherently cached

      // Auto-discovery for component type: >50 items → autocomplete
      if (cacheOptions === 'auto') {
        shouldCache = rawOptions.length <= SMART_FILTER_THRESHOLD
      } else if (cacheOptions === false) {
        shouldCache = false
      }

      // Determine component type (explicit override or based on count)
      const componentType = filterDef.component || (rawOptions.length <= SMART_FILTER_THRESHOLD ? 'dropdown' : 'autocomplete')

      // Log filter options for validation (optionsFromCache mode)
      console.log('[filterquery] Options loaded for:', filterName, '(count:', rawOptions.length, ')')

      // Build options with "All X" label
      // Note: FilterQuery with source='field' returns { label: fieldValue, value: fieldValue }
      // We just need to add the "All X" option at the beginning
      const allLabel = filterDef.allLabel || filterDef.placeholder || `All ${snakeToTitle(filterName)}`
      let finalOptions = [
        { label: allLabel, value: null },
        ...rawOptions.map(opt => ({
          label: snakeToTitle(String(opt.label)),
          value: opt.value
        }))
      ]

      // Apply processor callback if configured (backward compatibility)
      // This matches the original behavior where processor runs AFTER snakeToTitle and "All X" option
      if (typeof filterDef.processor === 'function') {
        finalOptions = filterDef.processor(finalOptions)
      }

      // Store the FilterQuery instance on filterDef for potential cache invalidation
      const updatedFilter = {
        ...filterDef,
        options: finalOptions,
        type: componentType,
        _cacheOptions: shouldCache,
        _optionsLoaded: true,
        _filterQuery: filterQuery
      }

      // Mark as loaded to prevent re-extraction on filter changes
      filtersMap.value.set(filterName, updatedFilter)
      hasChanges = true
    }

    // Trigger Vue reactivity only if there were changes
    if (hasChanges) {
      filtersMap.value = new Map(filtersMap.value)
    }
  }

  /**
   * Restore filter values from URL query params (priority) or session storage
   */
  function restoreFilters() {
    // Priority 1: URL query params
    const urlFilters = {}
    for (const key of filtersMap.value.keys()) {
      if (route.query[key] !== undefined) {
        // Parse value (handle booleans, numbers, etc.)
        let value = route.query[key]
        if (value === 'true') value = true
        else if (value === 'false') value = false
        else if (value === 'null') value = null
        else if (!isNaN(Number(value)) && value !== '') value = Number(value)
        urlFilters[key] = value
      }
    }
    // Restore search from URL
    if (route.query.search) {
      searchQuery.value = route.query.search
    }

    // Priority 2: Session storage (only for filters/search not in URL)
    const sessionData = persistFilters ? getSessionFilters(filterSessionKey) : null

    // Extract search from session (stored as _search)
    if (sessionData?._search && !route.query.search) {
      searchQuery.value = sessionData._search
    }

    // Remove _search from session data before merging with filters
    const sessionFilters = sessionData ? { ...sessionData } : null
    if (sessionFilters) delete sessionFilters._search

    // Merge: URL takes priority over session
    const restoredFilters = { ...sessionFilters, ...urlFilters }

    // Apply restored values
    for (const [name, value] of Object.entries(restoredFilters)) {
      if (filtersMap.value.has(name)) {
        filterValues.value[name] = value
      }
    }
  }

  // ============ ACTIONS ============
  const actionsMap = ref(new Map())

  function addAction(name, actionConfig) {
    actionsMap.value.set(name, {
      name,
      severity: 'secondary',
      ...actionConfig
    })
  }

  function removeAction(name) {
    actionsMap.value.delete(name)
  }

  function resolveValue(value, row) {
    return typeof value === 'function' ? value(row) : value
  }

  function getActions(row) {
    const actions = []
    for (const [, action] of actionsMap.value) {
      if (action.visible && !action.visible(row)) continue
      actions.push({
        name: action.name,
        icon: resolveValue(action.icon, row),
        tooltip: resolveValue(action.tooltip, row),
        severity: resolveValue(action.severity, row) || 'secondary',
        isDisabled: action.disabled ? action.disabled(row) : false,
        handler: () => action.onClick(row)
      })
    }
    return actions
  }

  // ============ SEARCH ============
  function setSearch(searchCfg) {
    searchConfig.value = { ...searchConfig.value, ...searchCfg }
  }

  // ============ CACHE MODE ============
  const fromCache = ref(false)

  // HACK: local_filter / local_search are escape hatches for edge cases.
  // They filter items AFTER the manager returns data (post-filter in Vue computed).
  // Prefer toQuery() for virtual filters - it works with QueryExecutor properly.
  // Only use local_filter/local_search for truly computed values or external lookups.
  const filteredItems = computed(() => {
    let result = [...items.value]

    // local_filter: post-filter hack for edge cases
    for (const [name, value] of Object.entries(filterValues.value)) {
      if (value === null || value === undefined || value === '') continue
      const filterDef = filtersMap.value.get(name)
      if (typeof filterDef?.local_filter !== 'function') continue
      result = result.filter(item => filterDef.local_filter(item, value))
    }

    // local_search: post-filter hack for external lookups
    if (searchQuery.value && typeof searchConfig.value.local_search === 'function') {
      const query = searchQuery.value.toLowerCase()
      result = result.filter(item => searchConfig.value.local_search(item, query))
    }

    return result
  })

  // Items to display
  const displayItems = computed(() => filteredItems.value)

  // ============ LOADING ============
  let filterOptionsLoaded = false

  async function loadItems(extraParams = {}, { force = false } = {}) {
    if (!manager) return

    // If forced, invalidate the manager's cache first
    if (force && manager.invalidateCache) {
      manager.invalidateCache()
    }

    loading.value = true
    try {
      // Build query params
      let params = { ...extraParams }

      // Pagination and sorting
      params.page = page.value
      params.page_size = pageSize.value
      if (sortField.value) {
        params.sort_by = sortField.value
        params.sort_order = sortOrder.value === 1 ? 'asc' : 'desc'
      }

      // Add search param (skip if local_search hack is used)
      if (searchQuery.value && typeof searchConfig.value.local_search !== 'function') {
        params.search = searchQuery.value
        // Pass searchFields override if configured via setSearch({ fields: [...] })
        if (searchConfig.value.fields?.length > 0) {
          params.searchFields = searchConfig.value.fields
        }
      }

      // Build filters object for manager
      const filters = {}
      for (const [name, value] of Object.entries(filterValues.value)) {
        if (value === null || value === undefined || value === '') continue
        const filterDef = filtersMap.value.get(name)
        // Skip local_filter hacks - applied in filteredItems computed
        if (typeof filterDef?.local_filter === 'function') continue

        // Support toQuery for virtual filters with query abstraction
        // toQuery(value) returns MongoDB-like query object, e.g., { returned_at: { $ne: null } }
        if (typeof filterDef?.toQuery === 'function') {
          const query = filterDef.toQuery(value)
          if (query && typeof query === 'object') {
            Object.assign(filters, query)
          }
        } else {
          filters[name] = value
        }
      }

      // Auto-add parent filter from route config
      const parentConfig = route.meta?.parent
      if (parentConfig?.foreignKey && parentConfig?.param) {
        const parentId = route.params[parentConfig.param]
        if (parentId) {
          filters[parentConfig.foreignKey] = parentId
        }
      }

      if (Object.keys(filters).length > 0) {
        params.filters = filters
      }

      // Hook: modify params before request
      if (onBeforeLoad) {
        params = onBeforeLoad(params) || params
      }

      // Use manager.query() for automatic cache handling
      const response = manager.query
        ? await manager.query(params)
        : await manager.list(params)

      // Track if response came from cache
      fromCache.value = response.fromCache || false

      // Hook: transform response
      let processedData
      if (transformResponse) {
        processedData = transformResponse(response)
      } else {
        processedData = {
          items: response.items || [],
          total: response.total || response.items?.length || 0
        }
      }

      items.value = processedData.items
      totalRecords.value = processedData.total

      // Hook: post-processing
      if (onAfterLoad) {
        onAfterLoad(response, processedData)
      }
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: `Failed to load ${entityNamePlural}`,
        life: 5000
      })
      console.error('Load error:', error)
    } finally {
      loading.value = false
    }
  }

  // ============ PAGINATION & SORTING ============
  function onPage(event) {
    page.value = event.page + 1
    pageSize.value = event.rows
    // Save page size preference to cookie
    setCookie(COOKIE_NAME, event.rows, COOKIE_EXPIRY_DAYS)
    loadItems()
  }

  function onSort(event) {
    sortField.value = event.sortField
    sortOrder.value = event.sortOrder
    loadItems()
  }

  // ============ NAVIGATION ============
  function goToCreate() {
    router.push({ name: `${routePrefix}-create` })
  }

  function goToEdit(item) {
    router.push({ name: `${routePrefix}-edit`, params: { id: item[resolvedDataKey] } })
  }

  function goToShow(item) {
    router.push({ name: `${routePrefix}-show`, params: { id: item[resolvedDataKey] } })
  }

  // ============ DELETE ============
  async function deleteItem(item, labelField = 'name') {
    try {
      await manager.delete(item[resolvedDataKey])
      toast.add({
        severity: 'success',
        summary: 'Deleted',
        detail: `${entityName} "${item[labelField] || item[resolvedDataKey]}" deleted`,
        life: 3000
      })
      loadItems({}, { force: true })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error.response?.data?.detail || `Failed to delete ${entityName}`,
        life: 5000
      })
    }
  }

  function confirmDelete(item, labelField = 'name') {
    confirm.require({
      message: `Delete ${entityName} "${item[labelField] || item[resolvedDataKey]}"?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptClass: 'p-button-danger',
      accept: () => deleteItem(item, labelField)
    })
  }

  // ============ BULK OPERATIONS ============
  const hasSelection = computed(() => selected.value.length > 0)
  const selectionCount = computed(() => selected.value.length)

  async function bulkDelete() {
    deleting.value = true
    let successCount = 0
    let errorCount = 0

    for (const item of [...selected.value]) {
      try {
        await manager.delete(item[resolvedDataKey])
        successCount++
      } catch {
        errorCount++
      }
    }

    deleting.value = false
    selected.value = []

    if (successCount > 0) {
      toast.add({
        severity: 'success',
        summary: 'Deleted',
        detail: `${successCount} ${successCount > 1 ? entityNamePlural : entityName} deleted`,
        life: 3000
      })
    }
    if (errorCount > 0) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: `Failed to delete ${errorCount} ${errorCount > 1 ? entityNamePlural : entityName}`,
        life: 5000
      })
    }

    loadItems({}, { force: true })
  }

  function confirmBulkDelete() {
    const count = selected.value.length
    confirm.require({
      message: `Delete ${count} ${count > 1 ? entityNamePlural : entityName}?`,
      header: 'Confirm Bulk Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptClass: 'p-button-danger',
      accept: bulkDelete
    })
  }

  // ============ WATCHERS ============
  let searchTimeout = null
  watch(searchQuery, () => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      // Use onFiltersChanged to also sync URL params
      onFiltersChanged()
    }, searchConfig.value.debounce)
  })

  // Note: filterValues changes are handled directly in updateFilters() and clearFilters()
  // to avoid relying on watch reactivity which can be unreliable with object mutations

  // Watch items for optionsFromCache filters
  watch(items, async () => {
    try {
      await updateCacheBasedFilters()
    } catch (error) {
      console.warn('[qdadm] Failed to update cache-based filters:', error)
    }
  })

  // ============ LIST:ALTER HOOK ============

  /**
   * Invoke list:alter hooks to allow modules to modify list configuration
   *
   * Builds a config snapshot from current state, passes it through the hook chain,
   * and applies any modifications back to the internal maps.
   *
   * Hook context structure:
   * @typedef {object} ListAlterConfig
   * @property {string} entity - Entity name
   * @property {Array} columns - Array of column definitions
   * @property {Array} filters - Array of filter definitions
   * @property {Array} actions - Array of row action definitions
   * @property {Array} headerActions - Array of header action definitions
   *
   * @example
   * // Register a hook to add a custom column
   * hooks.register('list:alter', (config) => {
   *   if (config.entity === 'books') {
   *     config.columns.push({ field: 'custom', header: 'Custom' })
   *   }
   *   return config
   * })
   *
   * @example
   * // Register entity-specific hook
   * hooks.register('books:list:alter', (config) => {
   *   config.filters.push({ name: 'year', type: 'select', options: [...] })
   *   return config
   * })
   */
  async function invokeListAlterHook() {
    if (!hooks) return

    // Build config snapshot from current state
    const configSnapshot = {
      entity,
      columns: Array.from(columnsMap.value.values()),
      filters: Array.from(filtersMap.value.values()),
      actions: Array.from(actionsMap.value.values()),
      headerActions: Array.from(headerActionsMap.value.values()),
    }

    // Context passed to handlers
    const hookContext = { entity, manager }

    // Invoke generic list:alter hook
    let alteredConfig = await hooks.alter('list:alter', configSnapshot, hookContext)

    // Invoke entity-specific hook: {entity}:list:alter
    const entityHookName = `${entity}:list:alter`
    if (hooks.hasHook(entityHookName)) {
      alteredConfig = await hooks.alter(entityHookName, alteredConfig, hookContext)
    }

    // Apply altered config back to the maps
    applyAlteredConfig(alteredConfig)
  }

  // ============ FILTER:ALTER HOOK ============

  /**
   * Invoke filter:alter hooks to allow modules to modify filter options
   *
   * Builds a filters snapshot from current state, passes it through the hook chain,
   * and applies any modifications back to the filtersMap. Runs after API options are
   * loaded but before list:alter hook.
   *
   * Config object structure passed to handlers:
   * @typedef {object} FilterAlterConfig
   * @property {string} entity - Entity name (for conditional logic)
   * @property {Array<object>} filters - Array of filter definitions with loaded options
   * @property {string} filters[].name - Filter name/identifier
   * @property {string} filters[].type - Filter type (select, multiselect, etc.)
   * @property {Array<{label: string, value: *}>} filters[].options - Available options
   *
   * Hook invocation order:
   * 1. `filter:alter` - Generic hook for all entities
   * 2. `{entity}:filter:alter` - Entity-specific hook (e.g., `books:filter:alter`)
   *
   * @example
   * // Add custom filter options dynamically
   * hooks.register('filter:alter', (config) => {
   *   if (config.entity === 'books') {
   *     const statusFilter = config.filters.find(f => f.name === 'status')
   *     if (statusFilter) {
   *       statusFilter.options.push({ label: 'Archived', value: 'archived' })
   *     }
   *   }
   *   return config
   * })
   *
   * @example
   * // Filter options based on user context (entity-specific)
   * hooks.register('books:filter:alter', (config) => {
   *   const genreFilter = config.filters.find(f => f.name === 'genre')
   *   if (genreFilter) {
   *     // Remove restricted options
   *     genreFilter.options = genreFilter.options.filter(o => o.value !== 'restricted')
   *   }
   *   return config
   * })
   */
  async function invokeFilterAlterHook() {
    if (!hooks) return

    // Build filters snapshot from current state
    // Entity is included in the snapshot for handlers to filter by entity
    const filterSnapshot = {
      entity,
      filters: Array.from(filtersMap.value.values()),
    }

    // Invoke generic filter:alter hook
    let alteredFilters = await hooks.alter('filter:alter', filterSnapshot)

    // Invoke entity-specific hook: {entity}:filter:alter
    const entityHookName = `${entity}:filter:alter`
    if (hooks.hasHook(entityHookName)) {
      alteredFilters = await hooks.alter(entityHookName, alteredFilters)
    }

    // Apply altered filters back to the map
    if (alteredFilters.filters) {
      filtersMap.value.clear()
      for (const filter of alteredFilters.filters) {
        filtersMap.value.set(filter.name, filter)
        // Preserve existing filter values or use defaults
        if (filterValues.value[filter.name] === undefined) {
          filterValues.value[filter.name] = filter.default ?? null
        }
      }
    }
  }

  /**
   * Apply altered configuration back to internal maps
   * @param {ListAlterConfig} alteredConfig - The modified configuration
   */
  function applyAlteredConfig(alteredConfig) {
    // Apply columns
    if (alteredConfig.columns) {
      columnsMap.value.clear()
      for (const col of alteredConfig.columns) {
        columnsMap.value.set(col.field, col)
      }
    }

    // Apply filters
    if (alteredConfig.filters) {
      filtersMap.value.clear()
      for (const filter of alteredConfig.filters) {
        filtersMap.value.set(filter.name, filter)
        // Preserve existing filter values or use defaults
        if (filterValues.value[filter.name] === undefined) {
          filterValues.value[filter.name] = filter.default ?? null
        }
      }
    }

    // Apply actions
    if (alteredConfig.actions) {
      actionsMap.value.clear()
      for (const action of alteredConfig.actions) {
        actionsMap.value.set(action.name, action)
      }
    }

    // Apply header actions
    if (alteredConfig.headerActions) {
      headerActionsMap.value.clear()
      for (const action of alteredConfig.headerActions) {
        headerActionsMap.value.set(action.name, action)
      }
    }
  }

  // ============ LIFECYCLE ============
  // Initialize from registry immediately (sync)
  initFromRegistry()

  onMounted(async () => {
    // Restore filters from URL/session after registry init
    restoreFilters()

    // Load filter options from API (async)
    if (!filterOptionsLoaded) {
      filterOptionsLoaded = true
      await loadFilterOptions()
    }

    // Invoke list:alter hooks to allow modules to modify configuration
    // This runs after initFromRegistry() and loadFilterOptions(), before loadItems()
    await invokeListAlterHook()

    // Load data
    if (loadOnMount && manager) {
      loadItems()
    }
  })

  // ============ UTILITIES ============
  function formatDate(dateStr, options = {}) {
    if (!dateStr) return '-'
    const defaultOptions = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      ...options
    }
    return new Date(dateStr).toLocaleDateString('fr-FR', defaultOptions)
  }

  // ============ STANDARD ACTIONS ============
  /**
   * Add standard "view" action
   */
  function addViewAction(options = {}) {
    addAction('view', {
      icon: 'pi pi-eye',
      tooltip: 'View',
      onClick: options.onClick || goToShow,
      ...options
    })
  }

  /**
   * Add standard "edit" action
   * Respects manager.canUpdate() for visibility
   */
  function addEditAction(options = {}) {
    addAction('edit', {
      icon: 'pi pi-pencil',
      tooltip: 'Edit',
      onClick: options.onClick || goToEdit,
      visible: (row) => manager.canUpdate(row),
      ...options
    })
  }

  /**
   * Add standard "delete" action
   * Respects manager.canDelete() for visibility
   */
  function addDeleteAction(options = {}) {
    const labelField = options.labelField || 'name'
    addAction('delete', {
      icon: 'pi pi-trash',
      tooltip: 'Delete',
      severity: 'danger',
      onClick: (row) => confirmDelete(row, labelField),
      visible: (row) => manager.canDelete(row),
      ...options
    })
  }

  // ============ BULK ACTIONS DETECTION ============
  /**
   * Check if any header actions depend on selection (bulk actions)
   */
  const hasBulkActions = computed(() => {
    for (const [, action] of headerActionsMap.value) {
      // If action has visible function that checks hasSelection, it's a bulk action
      if (action.visible && typeof action.visible === 'function') {
        // Test with hasSelection: true to see if action would be visible
        const wouldShow = action.visible({ hasSelection: true, selectionCount: 1, deleting: false })
        const wouldHide = action.visible({ hasSelection: false, selectionCount: 0, deleting: false })
        if (wouldShow && !wouldHide) {
          return true
        }
      }
    }
    return false
  })

  // ============ LIST PAGE PROPS ============
  /**
   * Props object for ListPage component
   * Use with v-bind: <ListPage v-bind="list.props">
   */
  const listProps = computed(() => ({
    // Header
    title: manager.labelPlural,
    headerActions: headerActions.value,

    // Cards
    cards: cards.value,

    // Columns
    columns: columns.value,

    // Table data
    items: displayItems.value,
    loading: loading.value,
    dataKey: resolvedDataKey,

    // Selection - auto-enable if bulk actions available
    selected: selected.value,
    selectable: hasBulkActions.value,

    // Pagination
    totalRecords: totalRecords.value,
    rows: pageSize.value,
    rowsPerPageOptions,

    // Sorting
    sortField: sortField.value,
    sortOrder: sortOrder.value,

    // Search
    searchQuery: searchQuery.value,
    searchPlaceholder: searchConfig.value.placeholder,

    // Filters
    filters: filters.value,
    filterValues: filterValues.value,

    // Row actions
    getActions
  }))

  /**
   * Event handlers for ListPage
   * Use with v-on: <ListPage v-bind="list.props" v-on="list.events">
   */
  const listEvents = {
    'update:selected': (value) => { selected.value = value },
    'update:searchQuery': (value) => { searchQuery.value = value },
    'update:filterValues': updateFilters,
    'page': onPage,
    'sort': onSort
  }

  return {
    // Manager access
    manager,

    // State
    items,
    displayItems,  // Use this for rendering (handles local/API filtering)
    loading,
    selected,
    deleting,

    // Pagination
    page,
    pageSize,
    totalRecords,
    rowsPerPageOptions,
    sortField,
    sortOrder,
    onPage,
    onSort,

    // Search
    searchQuery,
    searchConfig,
    setSearch,

    // Columns
    columns,
    addColumn,
    removeColumn,
    updateColumn,

    // Header Actions
    headerActions,
    addHeaderAction,
    removeHeaderAction,
    getHeaderActions,
    addCreateAction,
    addBulkDeleteAction,
    addBulkStatusAction,
    hasBulkActions,

    // Cards
    cards,
    addCard,
    updateCard,
    removeCard,

    // Filters
    filters,
    filterValues,
    filteredItems,
    fromCache,  // true if last query used cache
    addFilter,
    removeFilter,
    setFilterValue,
    updateFilters,
    clearFilters,
    loadFilterOptions,
    initFromRegistry,
    restoreFilters,

    // Actions
    addAction,
    removeAction,
    getActions,
    getRowActions,  // Permission-aware alias for getActions
    addViewAction,
    addEditAction,
    addDeleteAction,

    // Permissions
    canCreate,
    canDelete,
    canEditRow,
    canDeleteRow,

    // Data
    loadItems,

    // Navigation
    goToCreate,
    goToEdit,
    goToShow,

    // Delete
    deleteItem,
    confirmDelete,
    bulkDelete,
    confirmBulkDelete,
    hasSelection,
    selectionCount,

    // Utilities
    formatDate,
    toast,
    confirm,
    router,

    // ListPage integration
    props: listProps,
    events: listEvents
  }
}
