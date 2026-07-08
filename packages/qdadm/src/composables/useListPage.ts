/**
 * useListPage - Unified procedural builder for CRUD list pages
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
 */
import {
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  inject,
  provide,
  type Ref,
} from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { useHooks } from './useHooks.js'
import { useEntityItemPage, type ParentConfig, type UseEntityItemPageReturn } from './useEntityItemPage.js'
import { useActiveStack } from '../chain/useActiveStack.js'
import { useI18n } from '../i18n/useI18n'
import { formatDateOnly } from '../utils/formatters'
import { humanizeFieldName } from '../utils/humanize'

// Import types from dedicated types file
import type {
  Orchestrator,
  ToastHelper,
  ConfirmService,
  ColumnConfig,
  FilterConfig,
  ActionConfig,
  ResolvedAction,
  HeaderActionState,
  HeaderActionConfig,
  ResolvedHeaderAction,
  CardConfig,
  SearchConfig,
  EntityContext,
  BulkStatusActionReturn,
  ListResponse,
  AxiosError,
  UseListPageOptions,
  ListPageProps,
  ListPageEvents,
  CreateActionOptions,
  BulkStatusActionOptions,
  UseListPageReturn,
} from './useListPage.types'

// Re-export public types
export type {
  ColumnConfig,
  FilterConfig,
  ActionConfig,
  ResolvedAction,
  HeaderActionConfig,
  ResolvedHeaderAction,
  CardConfig,
  SearchConfig,
  BulkStatusActionReturn,
  UseListPageOptions,
  ListPageProps,
  ListPageEvents,
  CreateActionOptions,
  BulkStatusActionOptions,
  UseListPageReturn,
} from './useListPage.types'

// Stateless utilities (cookies, session storage, formatters, constants).
import {
  PAGE_SIZE_OPTIONS,
  getSavedPageSize,
  getSessionFilters,
  getSessionSort,
  setSessionSort,
  persistPageSize,
} from './useListPage.utils'
import { useActionRegistry } from './useActionRegistry'
import { useListFilters } from './useListPage.filters'
import { useListAlterHooks } from './useListPage.alterHooks'
import { useOrchestrator } from '../orchestrator/useOrchestrator.js'
import { createOrchestratorToast } from './useOrchestratorToast'

// Re-export PAGE_SIZE_OPTIONS so existing consumers (qdadm/index.ts,
// composables/index.ts) keep their import path.
export { PAGE_SIZE_OPTIONS } from './useListPage.utils'


/**
 * Unified procedural builder for CRUD list pages
 *
 * @param config - Configuration options
 * @returns List page API
 */
export function useListPage<T = unknown>(config: UseListPageOptions<T>): UseListPageReturn<T> {
  const {
    entity,
    dataKey,
    defaultSort = null,
    defaultSortOrder = -1,
    pageSize: defaultPageSize = 10,
    loadOnMount = true,
    persistFilters = true,
    persistSort = true,
    syncUrlParams = true,
    autoLoadFilters = true,
    onBeforeLoad = null,
    onAfterLoad = null,
    transformResponse = null,
  } = config

  const router = useRouter()
  const route = useRoute()
  const confirm = useConfirm() as ConfirmService

  // Mobile detection (viewport width < 768px)
  const isMobile = ref(window.innerWidth < 768)

  // i18n integration — column headers resolve via entities.{entity}.fields.{field}
  const { i18n: kernelI18n, locale: i18nLocale } = useI18n()

  // Get EntityManager via orchestrator (#1193 — canonical injection: one
  // error-message source; erased to this file's Read-tier view)
  const orchestrator = useOrchestrator().orchestrator as unknown as Orchestrator
  const toast: ToastHelper = createOrchestratorToast(orchestrator)

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

  // Provide entity context for child components (e.g., SeverityTag auto-discovery)
  provide('mainEntity', entity)

  // ============ PARENT CHAIN SUPPORT ============

  const parentConfigComputed = computed<ParentConfig | null>(
    () => (route.meta?.parent as ParentConfig) || null
  )

  // Use ActiveStack for synchronous route-based context
  useActiveStack()

  // Create useEntityItemPage for PARENT entity (not for list's own entity)
  let parentPage: UseEntityItemPageReturn | null = null
  if (route.meta?.parent) {
    const parentMeta = route.meta.parent as ParentConfig
    parentPage = useEntityItemPage({
      entity: parentMeta.entity,
      loadOnMount: true,
      autoLoadParent: true,
    })
  }

  // Parent data and loading state (null if no parent)
  const parentData = computed(() => parentPage?.data.value || null)
  const parentId = computed(() => parentPage?.entityId.value || null)
  const parentLoading = computed(() => parentPage?.loading.value || false)
  const parentChain = computed(() => parentPage?.parentChain.value || new Map())

  /**
   * Build entity context with parentChain array for multi-storage routing
   */
  const entityContext = computed<EntityContext | null>(() => {
    if (!parentConfigComputed.value) {
      return null
    }

    const chain: Array<{ entity: string; id: string | number }> = []
    let currentConfig: ParentConfig | undefined = parentConfigComputed.value

    while (currentConfig) {
      const entityId = route.params[currentConfig.param] as string
      if (!entityId) break

      chain.unshift({
        entity: currentConfig.entity,
        id: entityId,
      })
      currentConfig = currentConfig.parent
    }

    return chain.length > 0 ? { parentChain: chain } : null
  })

  // Read config from manager with option overrides
  const entityName = config.entityName ?? manager.label ?? entity
  const entityNamePlural = config.entityNamePlural ?? manager.labelPlural ?? `${entityName}s`
  const routePrefix = config.routePrefix ?? manager.routePrefix ?? entity
  const resolvedDataKey = dataKey ?? manager.idField ?? 'id'

  // Session key for filter persistence (based on entity name)
  const filterSessionKey = entity || entityName

  // Entity filters registry (optional, provided by consuming app)
  const entityFilters = inject<Record<string, { search?: SearchConfig; filters?: FilterConfig[] }>>(
    'qdadmEntityFilters',
    {}
  )

  // Get HookRegistry for list:alter hook (optional, may not exist in tests)
  const hooks = useHooks()

  // ============ SESSION RESTORE ============
  const savedSession = persistFilters ? getSessionFilters(filterSessionKey) : null
  const savedSearch = (savedSession?._search as string) || ''
  const savedFilters: Record<string, unknown> | null = savedSession ? { ...savedSession } : null
  if (savedFilters) delete savedFilters._search

  // ============ STATE ============
  const items = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const selected = ref<T[]>([]) as Ref<T[]>
  const deleting = ref(false)

  // Pagination
  const page = ref(1)
  const pageSize = ref(getSavedPageSize(defaultPageSize))
  const totalRecords = ref(0)
  const rowsPerPageOptions = PAGE_SIZE_OPTIONS

  // Sorting — restored from the per-entity session (#1218), defaultSort as
  // fallback; same persistence discipline as filters/pageSize.
  const savedSort = persistSort ? getSessionSort(filterSessionKey) : null
  const sortField = ref<string | null>(savedSort ? savedSort.field : defaultSort)
  const sortOrder = ref(savedSort ? savedSort.order : defaultSortOrder)

  // Search
  const searchQuery = ref(savedSearch)
  const searchConfig = ref<SearchConfig>({
    placeholder: 'Search...',
    fields: [],
    debounce: 300,
  })

  // ============ COLUMNS ============
  const columnsMap = ref<Map<string, ColumnConfig>>(new Map())
  // Track inline-supplied column headers so relabel() can fall back to them
  // when the i18n bundle has no translation for the field.
  const columnInlineHeaders = new Map<string, string | undefined>()

  /**
   * Resolve a column header: i18n hit on entities.{entity}.fields.{field} wins,
   * otherwise the inline `header` option, otherwise a capitalized field name.
   */
  function resolveColumnHeader(field: string, inline?: string): string {
    if (entity && kernelI18n) {
      const trace = kernelI18n.resolve(`entities.${entity}.fields.${field}`)
      if (trace.hit) return trace.result
    }
    return inline || field.charAt(0).toUpperCase() + field.slice(1)
  }

  function addColumn(field: string, columnConfig: Partial<ColumnConfig> = {}): void {
    columnInlineHeaders.set(field, columnConfig.header)
    columnsMap.value.set(field, {
      field,
      header: resolveColumnHeader(field, columnConfig.header),
      ...columnConfig,
      // Re-apply resolved header after spread so it wins over a stale inline.
      ...(columnConfig.header ? {} : { header: resolveColumnHeader(field) }),
    })
  }

  // Re-resolve column headers when locale changes.
  watch(i18nLocale, () => {
    if (!entity || !kernelI18n) return
    for (const [field, current] of columnsMap.value.entries()) {
      const newHeader = resolveColumnHeader(field, columnInlineHeaders.get(field))
      if (current.header !== newHeader) {
        columnsMap.value.set(field, { ...current, header: newHeader })
      }
    }
  })

  /**
   * Template-side column binding helper (#1255): spread onto a PrimeVue
   * `<Column>` so `field` + `header` come from one source instead of being
   * retyped in every list template:
   *
   * ```html
   * <Column v-bind="list.column('botUuid')" sortable>
   *   <template #body="{ data }">...</template>
   * </Column>
   * ```
   *
   * Header resolution: i18n key (`entities.{entity}.fields.{field}`) >
   * `overrides.header` > inline header given to `addColumn` >
   * `manager.fields[name].label` > humanized field name. Pure read — it
   * never registers into columnsMap, so calling it during render is safe.
   */
  function column(name: string, overrides: Partial<ColumnConfig> = {}): ColumnConfig {
    // Depend on the locale so headers re-render on locale change.
    void i18nLocale.value

    let header: string | undefined
    if (entity && kernelI18n) {
      const trace = kernelI18n.resolve(`entities.${entity}.fields.${name}`)
      if (trace.hit) header = trace.result
    }
    const fieldConfig = manager.getFieldConfig(name) as { label?: string } | null | undefined
    header ??=
      overrides.header ??
      columnInlineHeaders.get(name) ??
      fieldConfig?.label ??
      humanizeFieldName(name)

    const registered = columnsMap.value.get(name)
    return { ...registered, ...overrides, field: name, header }
  }

  function removeColumn(field: string): void {
    columnsMap.value.delete(field)
  }

  function updateColumn(field: string, updates: Partial<ColumnConfig>): void {
    const existing = columnsMap.value.get(field)
    if (existing) {
      columnsMap.value.set(field, { ...existing, ...updates })
    }
  }

  const columns = computed(() => Array.from(columnsMap.value.values()))

  // ============ HEADER ACTIONS ============
  const headerActionsMap = ref<Map<string, HeaderActionConfig>>(new Map())

  function addHeaderAction(name: string, config: Omit<HeaderActionConfig, 'name'>): void {
    headerActionsMap.value.set(name, { name, ...config })
  }

  function removeHeaderAction(name: string): void {
    headerActionsMap.value.delete(name)
  }

  function getHeaderActions(): ResolvedHeaderAction[] {
    const state: HeaderActionState = {
      hasSelection: hasSelection.value,
      selectionCount: selectionCount.value,
      deleting: deleting.value,
    }
    const actions: ResolvedHeaderAction[] = []
    for (const [, action] of headerActionsMap.value) {
      if (action.visible && !action.visible(state)) continue
      actions.push({
        ...action,
        isLoading: action.loading ? action.loading(state) : false,
      })
    }
    return actions
  }

  const headerActions = computed(() => getHeaderActions())

  // ============ PERMISSION STATE ============

  const canCreate = computed(() => manager.canCreate())
  const canDelete = computed(() => manager.canDelete())

  function canEditRow(row: unknown): boolean {
    return manager.canUpdate(row)
  }

  function canDeleteRow(row: unknown): boolean {
    return manager.canDelete(row)
  }

  function getRowActions(row: unknown): ResolvedAction[] {
    return getActions(row)
  }

  function addCreateAction(labelOrOptions: string | CreateActionOptions | null = null): void {
    const options: CreateActionOptions =
      typeof labelOrOptions === 'string' ? { label: labelOrOptions } : labelOrOptions || {}

    const createLabel =
      options.label || `Create ${entityName.charAt(0).toUpperCase() + entityName.slice(1)}`

    const onClick = options.routeName
      ? () =>
          router.push({
            name: options.routeName!,
            params: { ...route.params, ...options.params },
          } as { name: string; params: Record<string, string> })
      : goToCreate

    addHeaderAction('create', {
      label: createLabel,
      icon: 'pi pi-plus',
      onClick,
      visible: () => manager.canCreate(),
    })
  }

  function addBulkDeleteAction(): void {
    addHeaderAction('bulk-delete', {
      label: (state) => `Delete (${state.selectionCount})`,
      icon: 'pi pi-trash',
      severity: 'danger',
      onClick: confirmBulkDelete,
      visible: (state) => state.hasSelection && manager.canDelete(),
      loading: (state) => state.deleting,
    })
  }

  // ============ BULK STATUS ACTION ============

  function addBulkStatusAction(bulkConfig: BulkStatusActionOptions = {}): BulkStatusActionReturn {
    const {
      statusField = 'status',
      idsField = 'ids',
      bulkEndpoint = null,
      options = [],
      label = 'Change Status',
      icon = 'pi pi-sync',
      dialogTitle = 'Change Status',
    } = bulkConfig

    const showDialog = ref(false)
    const selectedStatus = ref<unknown>(null)
    const updating = ref(false)

    addHeaderAction('bulk-status', {
      label: (state) => `${label} (${state.selectionCount})`,
      icon,
      severity: 'info',
      onClick: () => {
        showDialog.value = true
      },
      visible: (state) => state.hasSelection,
      loading: () => updating.value,
    })

    async function execute(): Promise<void> {
      if (!selectedStatus.value || selected.value.length === 0) return

      updating.value = true
      try {
        const ids = selected.value.map((item) => (item as Record<string, unknown>)[resolvedDataKey])
        const bulkPath = bulkEndpoint || 'bulk/status'

        const payload = {
          [idsField]: ids,
          [statusField]: selectedStatus.value,
        }

        const response = (await manager.request('PATCH', bulkPath, { data: payload })) as {
          updated?: number
          failed?: number
        }

        if (response.updated && response.updated > 0) {
          toast.add({
            severity: 'success',
            summary: 'Updated',
            detail: `${response.updated} ${response.updated > 1 ? entityNamePlural : entityName} updated`,
            life: 3000,
          })
        }
        if (response.failed && response.failed > 0) {
          toast.add({
            severity: 'warn',
            summary: 'Partial Success',
            detail: `${response.failed} ${response.failed > 1 ? entityNamePlural : entityName} failed`,
            life: 5000,
          })
        }

        selected.value = []
        selectedStatus.value = null
        showDialog.value = false
        loadItems({}, { force: true })
      } catch (error) {
        const axiosError = error as AxiosError
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: axiosError.response?.data?.detail || 'Bulk update failed',
          life: 5000,
        })
      } finally {
        updating.value = false
      }
    }

    function cancel(): void {
      showDialog.value = false
      selectedStatus.value = null
    }

    const statusOptions = ref(options)

    function setOptions(newOptions: Array<{ label: string; value: unknown }>): void {
      statusOptions.value = newOptions
    }

    return {
      showDialog,
      selectedStatus,
      updating,
      statusOptions,
      dialogTitle,
      execute,
      cancel,
      setOptions,
    }
  }

  // ============ CARDS ============
  const cardsMap = ref<Map<string, CardConfig>>(new Map())

  function addCard(name: string, cardConfig: Omit<CardConfig, 'name'>): void {
    cardsMap.value.set(name, { name, ...cardConfig })
  }

  function updateCard(name: string, cardConfig: Partial<CardConfig>): void {
    const existing = cardsMap.value.get(name)
    if (existing) {
      cardsMap.value.set(name, { ...existing, ...cardConfig })
    }
  }

  function removeCard(name: string): void {
    cardsMap.value.delete(name)
  }

  const cards = computed(() => Array.from(cardsMap.value.values()))

  // ============ FILTERS (#1195 — extracted subsystem) ============
  // invokeFilterAlterHook is a thunk: alterHooks is declared after the
  // actions section (it needs the action registry) and only runs post-setup.
  const listFilters = useListFilters({
    entityName,
    manager,
    orchestrator,
    items: items as Ref<unknown[]>,
    page,
    searchQuery,
    route,
    router,
    savedFilters,
    persistFilters,
    syncUrlParams,
    autoLoadFilters,
    filterSessionKey,
    entityFilters,
    loadItems: () => loadItems(),
    setSearch: (searchCfg) => setSearch(searchCfg),
    invokeFilterAlterHook: () => alterHooks.invokeFilterAlterHook(),
  })
  const {
    filtersMap,
    filterValues,
    filters,
    hasActiveFilters,
    addFilter,
    removeFilter,
    setFilterValue,
    updateFilters,
    onFiltersChanged,
    clearFilters,
    isFilterAtDefault,
    initFromRegistry,
    loadFilterOptions,
    updateCacheBasedFilters,
    restoreFilters,
  } = listFilters

  // ============ ACTIONS ============
  function resolveValue<T>(value: T | ((row: unknown) => T), row: unknown): T {
    return typeof value === 'function' ? (value as (row: unknown) => T)(row) : value
  }

  // #1193 — shared registry skeleton; row-aware resolution stays here
  const actionRegistry = useActionRegistry<ActionConfig, unknown, ResolvedAction>({
    defaults: { severity: 'secondary' },
    resolve: (action, row) => {
      if (action.visible && !action.visible(row)) return null
      return {
        name: action.name,
        icon: action.icon ? resolveValue(action.icon, row) : undefined,
        tooltip: action.tooltip ? resolveValue(action.tooltip, row) : undefined,
        severity: resolveValue(action.severity || 'secondary', row),
        isDisabled: action.disabled ? action.disabled(row) : false,
        handler: () => action.onClick(row),
      }
    },
  })

  function addAction(name: string, actionConfig: Omit<ActionConfig, 'name'>): void {
    actionRegistry.add({ name, ...actionConfig } as ActionConfig)
  }

  function removeAction(name: string): void {
    actionRegistry.remove(name)
  }

  function getActions(row: unknown): ResolvedAction[] {
    return actionRegistry.resolveAll(row)
  }

  // ============ SEARCH ============
  function setSearch(searchCfg: Partial<SearchConfig>): void {
    searchConfig.value = { ...searchConfig.value, ...searchCfg }
  }

  // ============ CACHE MODE ============
  const fromCache = ref(false)

  const filteredItems = computed(() => {
    let result = [...items.value]

    // local_filter: post-filter hack for edge cases
    for (const [name, value] of Object.entries(filterValues.value)) {
      if (value === null || value === undefined || value === '') continue
      const filterDef = filtersMap.value.get(name)
      if (typeof filterDef?.local_filter !== 'function') continue
      result = result.filter((item) => filterDef.local_filter!(item, value))
    }

    // local_search: post-filter hack for external lookups
    if (searchQuery.value && typeof searchConfig.value.local_search === 'function') {
      const query = searchQuery.value.toLowerCase()
      result = result.filter((item) => searchConfig.value.local_search!(item, query))
    }

    return result
  })

  const displayItems = computed(() => filteredItems.value)

  // ============ LOADING ============
  let filterOptionsLoaded = false

  async function loadItems(
    extraParams: Record<string, unknown> = {},
    { force = false } = {}
  ): Promise<void> {
    if (!manager) return

    if (force && manager.invalidateCache) {
      manager.invalidateCache()
    }

    // Delayed loading indicator (#1222): near-synchronous loads (cache/local
    // storage, fast APIs) used to flip loading true->false within one frame,
    // interrupting PrimeVue's overlay-mask enter transition — the leave
    // transitionend never fired and the invisible mask stayed in the DOM,
    // swallowing every subsequent click (sort toggles became no-ops). The
    // spinner only appears when a load actually takes time.
    const loadingTimer = setTimeout(() => {
      loading.value = true
    }, 150)
    try {
      let params: Record<string, unknown> = { ...extraParams }

      params.page = page.value
      params.page_size = pageSize.value
      if (sortField.value) {
        params.sort_by = sortField.value
        params.sort_order = sortOrder.value === 1 ? 'asc' : 'desc'
      }

      if (searchQuery.value && typeof searchConfig.value.local_search !== 'function') {
        params.search = searchQuery.value
        if (searchConfig.value.fields && searchConfig.value.fields.length > 0) {
          params.searchFields = searchConfig.value.fields
        }
      }

      const filtersObj: Record<string, unknown> = {}
      for (const [name, value] of Object.entries(filterValues.value)) {
        if (value === null || value === undefined || value === '') continue
        const filterDef = filtersMap.value.get(name)
        if (typeof filterDef?.local_filter === 'function') continue

        if (typeof filterDef?.toQuery === 'function') {
          const query = filterDef.toQuery(value)
          if (query && typeof query === 'object') {
            Object.assign(filtersObj, query)
          }
        } else {
          filtersObj[name] = value
        }
      }

      if (parentConfigComputed.value?.foreignKey && parentConfigComputed.value?.param) {
        const parentIdFromRoute = route.params[parentConfigComputed.value.param]
        if (parentIdFromRoute) {
          filtersObj[parentConfigComputed.value.foreignKey] = parentIdFromRoute
        }
      }

      if (Object.keys(filtersObj).length > 0) {
        params.filters = filtersObj
      }

      if (onBeforeLoad) {
        params = onBeforeLoad(params) || params
      }

      const response = manager.query
        ? await manager.query(params, { routingContext: entityContext.value })
        : await manager.list(params, entityContext.value)

      fromCache.value = response.fromCache || false

      let processedData: { items: T[]; total: number }
      if (transformResponse) {
        processedData = transformResponse(response as ListResponse<T>)
      } else {
        processedData = {
          items: (response.items || []) as T[],
          total: response.total || response.items?.length || 0,
        }
      }

      items.value = processedData.items
      totalRecords.value = processedData.total

      if (onAfterLoad) {
        onAfterLoad(response as ListResponse<T>, processedData)
      }
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: `Failed to load ${entityNamePlural}`,
        life: 5000,
      })
      console.error('Load error:', error)
    } finally {
      clearTimeout(loadingTimer)
      loading.value = false
    }
  }

  // ============ PAGINATION & SORTING ============
  function onPage(event: { page: number; rows: number }): void {
    page.value = event.page + 1
    pageSize.value = event.rows
    persistPageSize(event.rows)
    loadItems()
  }

  function onSort(event: { sortField: string | null; sortOrder: number | null }): void {
    // removableSort's third state ("sort removed") reaches us as nulls —
    // fall back to the list's default sort instead of loading unsorted
    // (#1222: on the cache path an unsorted load re-served the cache in
    // whatever order the previous sort left it, a visual no-op).
    if (!event.sortField || !event.sortOrder) {
      sortField.value = defaultSort
      sortOrder.value = defaultSortOrder
    } else {
      sortField.value = event.sortField
      sortOrder.value = event.sortOrder as 1 | -1
    }
    if (persistSort) {
      setSessionSort(filterSessionKey, {
        field: sortField.value,
        order: sortOrder.value as 1 | -1,
      })
    }
    loadItems()
  }

  // ============ NAVIGATION ============

  function findCreateRoute(): { name: string; params?: Record<string, unknown> } {
    const parentConfigVal = route.meta?.parent as ParentConfig | undefined

    if (parentConfigVal) {
      const currentMatched = route.matched[route.matched.length - 1]
      if (currentMatched) {
        const createPath = `${currentMatched.path}/create`
        const createRoute = router.getRoutes().find((r) => r.path === createPath)
        if (createRoute?.name) {
          return { name: createRoute.name as string, params: route.params as Record<string, unknown> }
        }
      }

      const currentName = route.name as string
      if (currentName && currentName.endsWith('s')) {
        const singularName = currentName.slice(0, -1)
        const createRouteName = `${singularName}-create`
        if (router.hasRoute(createRouteName)) {
          return { name: createRouteName, params: route.params as Record<string, unknown> }
        }
      }
    }

    return { name: `${routePrefix}-create` }
  }

  function goToCreate(): void {
    router.push(findCreateRoute() as { name: string })
  }

  function goToEdit(item: unknown): void {
    router.push({
      name: `${routePrefix}-edit`,
      params: { [manager.idField]: (item as Record<string, unknown>)[resolvedDataKey] as string },
    })
  }

  function goToShow(item: unknown): void {
    router.push({
      name: `${routePrefix}-show`,
      params: { [manager.idField]: (item as Record<string, unknown>)[resolvedDataKey] as string },
    })
  }

  // ============ MOBILE ROW TAP ============

  function getPrimaryRowAction(): 'edit' | 'show' | null {
    const editRouteName = `${routePrefix}-edit`
    const showRouteName = `${routePrefix}-show`

    if (router.hasRoute(editRouteName)) {
      return 'edit'
    }
    if (router.hasRoute(showRouteName)) {
      return 'show'
    }
    return null
  }

  function onRowClick(item: unknown, originalEvent: Event): void {
    if (!isMobile.value) return
    if (hasBulkActions.value && selected.value.length > 0) return

    const target = originalEvent?.target as HTMLElement
    if (target?.closest('button, a, .p-button, .table-actions, input, .p-checkbox')) {
      return
    }

    const action = getPrimaryRowAction()
    if (action === 'edit') {
      goToEdit(item)
    } else if (action === 'show') {
      goToShow(item)
    }
  }

  const hasRowTapAction = computed(() => isMobile.value && getPrimaryRowAction() !== null)

  // ============ DELETE ============
  async function deleteItem(item: unknown, labelField = 'name'): Promise<void> {
    try {
      const itemRecord = item as Record<string, unknown>
      await manager.delete(itemRecord[resolvedDataKey] as string | number)
      toast.add({
        severity: 'success',
        summary: 'Deleted',
        detail: `${entityName} "${itemRecord[labelField] || itemRecord[resolvedDataKey]}" deleted`,
        life: 3000,
      })
      loadItems({}, { force: true })
    } catch (error) {
      const axiosError = error as AxiosError
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: axiosError.response?.data?.detail || `Failed to delete ${entityName}`,
        life: 5000,
      })
    }
  }

  function confirmDelete(item: unknown, labelField = 'name'): void {
    const itemRecord = item as Record<string, unknown>
    confirm.require({
      message: `Delete ${entityName} "${itemRecord[labelField] || itemRecord[resolvedDataKey]}"?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptClass: 'p-button-danger',
      accept: () => deleteItem(item, labelField),
    })
  }

  // ============ BULK OPERATIONS ============
  const hasSelection = computed(() => selected.value.length > 0)
  const selectionCount = computed(() => selected.value.length)

  async function bulkDelete(): Promise<void> {
    deleting.value = true
    let successCount = 0
    let errorCount = 0

    for (const item of [...selected.value]) {
      try {
        const itemRecord = item as Record<string, unknown>
        await manager.delete(itemRecord[resolvedDataKey] as string | number)
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
        life: 3000,
      })
    }
    if (errorCount > 0) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: `Failed to delete ${errorCount} ${errorCount > 1 ? entityNamePlural : entityName}`,
        life: 5000,
      })
    }

    loadItems({}, { force: true })
  }

  function confirmBulkDelete(): void {
    const count = selected.value.length
    confirm.require({
      message: `Delete ${count} ${count > 1 ? entityNamePlural : entityName}?`,
      header: 'Confirm Bulk Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptClass: 'p-button-danger',
      accept: bulkDelete,
    })
  }

  // ============ WATCHERS ============
  let searchTimeout: ReturnType<typeof setTimeout> | null = null
  watch(searchQuery, () => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      onFiltersChanged()
    }, searchConfig.value.debounce || 300)
  })

  watch(items, async () => {
    try {
      await updateCacheBasedFilters()
    } catch (error) {
      console.warn('[qdadm] Failed to update cache-based filters:', error)
    }
  })

  // ============ HOOKS (#1195 — extracted subsystem) ============
  const alterHooks = useListAlterHooks({
    hooks,
    entity,
    manager,
    columnsMap,
    filtersMap,
    filterValues,
    headerActionsMap,
    actionRegistry,
  })
  const { invokeListAlterHook } = alterHooks

  // ============ LIFECYCLE ============
  initFromRegistry()

  function handleResize(): void {
    isMobile.value = window.innerWidth < 768
  }

  onMounted(async () => {
    window.addEventListener('resize', handleResize)

    restoreFilters()

    if (!filterOptionsLoaded) {
      filterOptionsLoaded = true
      await loadFilterOptions()
    }

    await invokeListAlterHook()

    if (loadOnMount && manager) {
      loadItems()
    }
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })

  // ============ UTILITIES ============
  // Browser-locale by default (unified policy — see utils/formatters).
  function formatDate(
    dateStr: string | null | undefined,
    options: Intl.DateTimeFormatOptions = {}
  ): string {
    return formatDateOnly(dateStr, options)
  }

  // ============ STANDARD ACTIONS ============

  function addViewAction(options: Partial<ActionConfig> = {}): void {
    addAction('view', {
      icon: 'pi pi-eye',
      tooltip: 'View',
      onClick: options.onClick || goToShow,
      ...options,
    })
  }

  function addEditAction(options: Partial<ActionConfig> = {}): void {
    addAction('edit', {
      icon: 'pi pi-pencil',
      tooltip: 'Edit',
      onClick: options.onClick || goToEdit,
      visible: (row) => manager.canUpdate(row),
      ...options,
    })
  }

  function addDeleteAction(options: Partial<ActionConfig> & { labelField?: string } = {}): void {
    const labelField = options.labelField || 'name'
    addAction('delete', {
      icon: 'pi pi-trash',
      tooltip: 'Delete',
      severity: 'danger',
      onClick: (row) => confirmDelete(row, labelField),
      visible: (row) => manager.canDelete(row),
      ...options,
    })
  }

  // ============ BULK ACTIONS DETECTION ============

  const hasBulkActions = computed(() => {
    for (const [, action] of headerActionsMap.value) {
      if (action.visible && typeof action.visible === 'function') {
        const wouldShow = action.visible({ hasSelection: true, selectionCount: 1, deleting: false })
        const wouldHide = action.visible({
          hasSelection: false,
          selectionCount: 0,
          deleting: false,
        })
        if (wouldShow && !wouldHide) {
          return true
        }
      }
    }
    return false
  })

  // ============ LIST PAGE PROPS ============

  const listProps = computed<ListPageProps>(() => ({
    title: manager.labelPlural,
    headerActions: headerActions.value,
    cards: cards.value,
    columns: columns.value,
    items: displayItems.value,
    loading: loading.value,
    dataKey: resolvedDataKey,
    selected: selected.value,
    selectable: hasBulkActions.value,
    lazy: true,
    totalRecords: totalRecords.value,
    rows: pageSize.value,
    rowsPerPageOptions,
    sortField: sortField.value,
    sortOrder: sortOrder.value,
    searchQuery: searchQuery.value,
    searchPlaceholder: searchConfig.value.placeholder || 'Search...',
    filters: filters.value,
    filterValues: filterValues.value,
    isFilterAtDefault,
    getActions,
    hasRowTapAction: hasRowTapAction.value,
  }))

  const listEvents: ListPageEvents = {
    'update:selected': (value) => {
      selected.value = value as T[]
    },
    'update:searchQuery': (value) => {
      searchQuery.value = value
    },
    'update:filterValues': updateFilters,
    page: onPage,
    sort: onSort,
    'row-click': onRowClick,
  }

  return {
    // Manager access
    manager,

    // Parent chain
    parentConfig: parentConfigComputed,
    parentId,
    parentData,
    parentLoading,
    parentChain,
    parentPage,

    // State
    items,
    displayItems,
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
    column,
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
    fromCache,
    addFilter,
    removeFilter,
    setFilterValue,
    updateFilters,
    clearFilters,
    isFilterAtDefault,
    hasActiveFilters,
    loadFilterOptions,
    initFromRegistry,
    restoreFilters,

    // Actions
    addAction,
    removeAction,
    getActions,
    getRowActions,
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

    // Mobile row tap
    isMobile,
    hasRowTapAction,
    getPrimaryRowAction,
    onRowClick,

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
    events: listEvents,
  }
}
