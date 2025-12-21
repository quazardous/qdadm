import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

/**
 * usePageBuilder - Base builder for dashboard pages
 *
 * Provides procedural API for:
 * - Header actions (addHeaderAction, addRefreshAction, etc.)
 * - Cards zone (addCard)
 * - Main content configuration (datatable, tree, custom)
 *
 * Usage:
 * const page = usePageBuilder()
 *
 * // Header
 * page.addHeaderAction('refresh', { icon: 'pi pi-refresh', onClick: refresh })
 *
 * // Cards
 * page.addCard('total', { value: 42, label: 'Total Events' })
 *
 * // Main content - DataTable
 * page.setDataTable({ lazy: true, paginator: true })
 * page.addColumn('name', { header: 'Name', sortable: true })
 * page.addRowAction('edit', { icon: 'pi pi-pencil', onClick: edit })
 *
 * // Or Tree view
 * page.setTreeView({ selectionMode: 'single' })
 *
 * // Or fully custom (use slot in template)
 * page.setCustomContent()
 */
export function usePageBuilder(_config = {}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()

  // ============ HEADER ACTIONS ============
  const headerActionsMap = ref(new Map())

  /**
   * Add a header action button
   */
  function addHeaderAction(name, actionConfig) {
    headerActionsMap.value.set(name, {
      name,
      severity: 'secondary',
      ...actionConfig
    })
  }

  function removeHeaderAction(name) {
    headerActionsMap.value.delete(name)
  }

  function updateHeaderAction(name, updates) {
    const existing = headerActionsMap.value.get(name)
    if (existing) {
      headerActionsMap.value.set(name, { ...existing, ...updates })
    }
  }

  /**
   * Get header actions with resolved state
   */
  function getHeaderActions(state = {}) {
    const actions = []
    for (const [, action] of headerActionsMap.value) {
      if (action.visible && !action.visible(state)) continue
      actions.push({
        ...action,
        label: typeof action.label === 'function' ? action.label(state) : action.label,
        isLoading: action.loading ? action.loading(state) : false
      })
    }
    return actions
  }

  const headerActions = computed(() => getHeaderActions())

  /**
   * Add standard refresh action
   */
  function addRefreshAction(onClick, options = {}) {
    const loadingRef = options.loadingRef || ref(false)
    addHeaderAction('refresh', {
      label: 'Refresh',
      icon: 'pi pi-refresh',
      onClick,
      loading: () => loadingRef.value,
      ...options
    })
    return loadingRef
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

  // ============ MAIN CONTENT ============
  const contentType = ref('custom') // 'datatable', 'tree', 'custom'
  const contentConfig = ref({})

  // DataTable specific
  const columnsMap = ref(new Map())
  const rowActionsMap = ref(new Map())
  const items = ref([])
  const loading = ref(false)
  const selected = ref([])

  // Pagination
  const page = ref(1)
  const pageSize = ref(10)
  const totalRecords = ref(0)
  const sortField = ref(null)
  const sortOrder = ref(1)

  // Search & Filters
  const searchQuery = ref('')
  const filtersMap = ref(new Map())
  const filterValues = ref({})

  /**
   * Set main content to DataTable
   */
  function setDataTable(options = {}) {
    contentType.value = 'datatable'
    contentConfig.value = {
      paginator: true,
      rows: 10,
      rowsPerPageOptions: [10, 25, 50],
      stripedRows: true,
      removableSort: true,
      dataKey: 'id',
      ...options
    }
    if (options.pageSize) pageSize.value = options.pageSize
  }

  /**
   * Set main content to Tree view
   */
  function setTreeView(options = {}) {
    contentType.value = 'tree'
    contentConfig.value = {
      selectionMode: 'single',
      ...options
    }
  }

  /**
   * Set main content to custom (use slot)
   */
  function setCustomContent() {
    contentType.value = 'custom'
    contentConfig.value = {}
  }

  /**
   * Add a column to DataTable
   */
  function addColumn(field, columnConfig) {
    columnsMap.value.set(field, {
      field,
      header: field.charAt(0).toUpperCase() + field.slice(1),
      ...columnConfig
    })
  }

  function removeColumn(field) {
    columnsMap.value.delete(field)
  }

  const columns = computed(() => Array.from(columnsMap.value.values()))

  /**
   * Add a row action
   */
  function addRowAction(name, actionConfig) {
    rowActionsMap.value.set(name, {
      name,
      severity: 'secondary',
      ...actionConfig
    })
  }

  function removeRowAction(name) {
    rowActionsMap.value.delete(name)
  }

  function resolveValue(value, row) {
    return typeof value === 'function' ? value(row) : value
  }

  function getRowActions(row) {
    const actions = []
    for (const [, action] of rowActionsMap.value) {
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

  /**
   * Add a filter
   */
  function addFilter(name, filterConfig) {
    filtersMap.value.set(name, {
      name,
      type: 'select',
      placeholder: name,
      ...filterConfig
    })
    if (filterValues.value[name] === undefined) {
      filterValues.value[name] = filterConfig.default ?? null
    }
  }

  function removeFilter(name) {
    filtersMap.value.delete(name)
    delete filterValues.value[name]
  }

  const filters = computed(() => Array.from(filtersMap.value.values()))

  /**
   * Set search config
   */
  const searchConfig = ref({ placeholder: 'Search...', fields: [] })

  function setSearch(config) {
    searchConfig.value = { ...searchConfig.value, ...config }
  }

  // Pagination handlers
  function onPage(event) {
    page.value = event.page + 1
    pageSize.value = event.rows
  }

  function onSort(event) {
    sortField.value = event.sortField
    sortOrder.value = event.sortOrder
  }

  // Selection
  const hasSelection = computed(() => selected.value.length > 0)
  const selectionCount = computed(() => selected.value.length)

  return {
    // Header Actions
    headerActions,
    addHeaderAction,
    removeHeaderAction,
    updateHeaderAction,
    getHeaderActions,
    addRefreshAction,

    // Cards
    cards,
    addCard,
    updateCard,
    removeCard,

    // Main Content
    contentType,
    contentConfig,
    setDataTable,
    setTreeView,
    setCustomContent,

    // DataTable
    columns,
    addColumn,
    removeColumn,
    items,
    loading,
    selected,
    hasSelection,
    selectionCount,

    // Row Actions
    addRowAction,
    removeRowAction,
    getRowActions,

    // Pagination
    page,
    pageSize,
    totalRecords,
    sortField,
    sortOrder,
    onPage,
    onSort,

    // Search & Filters
    searchQuery,
    searchConfig,
    setSearch,
    filters,
    filterValues,
    addFilter,
    removeFilter,

    // Utilities
    toast,
    confirm,
    router
  }
}
