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
  type ComputedRef,
} from 'vue'
import { useRouter, useRoute, type Router } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { useHooks } from './useHooks.js'
import { useEntityItemPage, type ParentConfig, type UseEntityItemPageReturn } from './useEntityItemPage.js'
import { useActiveStack } from '../chain/useActiveStack.js'
import { FilterQuery } from '../query/FilterQuery'

// Cookie utilities for pagination persistence
const COOKIE_NAME = 'qdadm_pageSize'
const COOKIE_EXPIRY_DAYS = 365

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match?.[2] ?? null
}

function setCookie(name: string, value: string | number, days: number): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}

function getSavedPageSize(defaultSize: number): number {
  const saved = getCookie(COOKIE_NAME)
  if (saved) {
    const parsed = parseInt(saved, 10)
    if ([10, 50, 100].includes(parsed)) return parsed
  }
  return defaultSize
}

// Default label fallback: convert snake_case to Title Case
function snakeToTitle(str: string): string {
  if (!str) return 'Unknown'
  return String(str)
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Standard pagination options
export const PAGE_SIZE_OPTIONS = [10, 50, 100]

// Session storage utilities for filter persistence
const FILTER_SESSION_PREFIX = 'qdadm_filters_'

function getSessionFilters(key: string): Record<string, unknown> | null {
  try {
    const stored = sessionStorage.getItem(FILTER_SESSION_PREFIX + key)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function setSessionFilters(key: string, filters: Record<string, unknown>): void {
  try {
    sessionStorage.setItem(FILTER_SESSION_PREFIX + key, JSON.stringify(filters))
  } catch {
    // Ignore storage errors
  }
}

// Smart filter auto-discovery threshold
const SMART_FILTER_THRESHOLD = 50

/**
 * Entity manager interface
 */
interface EntityManager {
  idField: string
  label?: string
  labelPlural?: string
  routePrefix?: string
  localFilterThreshold?: number
  invalidateCache?: () => void
  list: (params: unknown, context?: unknown) => Promise<ListResponse>
  query?: (params: unknown, options?: { routingContext?: unknown }) => Promise<ListResponse>
  get: (id: string | number) => Promise<unknown>
  delete: (id: string | number) => Promise<void>
  request: (method: string, path: string, options?: { data?: unknown }) => Promise<unknown>
  canCreate: () => boolean
  canUpdate: (row?: unknown) => boolean
  canDelete: (row?: unknown) => boolean
}

/**
 * List response from API
 */
interface ListResponse {
  items: unknown[]
  total?: number
  fromCache?: boolean
  [key: string]: unknown
}

/**
 * Orchestrator interface
 */
interface Orchestrator {
  get: (entityName: string) => EntityManager
  toast: {
    success: (summary: string, detail?: string, emitter?: unknown) => void
    error: (summary: string, detail?: string, emitter?: unknown) => void
    warn: (summary: string, detail?: string, emitter?: unknown) => void
    info: (summary: string, detail?: string, emitter?: unknown) => void
    [key: string]: ((summary: string, detail?: string, emitter?: unknown) => void) | undefined
  }
}

/**
 * Toast helper interface
 */
interface ToastHelper {
  add: (options: {
    severity: 'success' | 'error' | 'warn' | 'info'
    summary: string
    detail?: string
    emitter?: unknown
    life?: number
  }) => void
}

/**
 * PrimeVue confirm service interface
 */
interface ConfirmService {
  require: (options: {
    message: string
    header: string
    icon: string
    acceptClass?: string
    accept: () => void
  }) => void
}

/**
 * Column configuration
 */
export interface ColumnConfig {
  field: string
  header?: string
  sortable?: boolean
  style?: string
  body?: (row: unknown) => unknown
  [key: string]: unknown
}

/**
 * Filter configuration
 */
export interface FilterConfig {
  name: string
  type?: 'select' | 'multiselect' | 'date' | 'checkbox' | 'dropdown' | 'autocomplete'
  placeholder?: string
  options?: Array<{ label: string; value: unknown }>
  default?: unknown
  persist?: boolean
  allLabel?: string
  optionsEntity?: string
  optionsEndpoint?: string | boolean
  optionsFromCache?: string | boolean
  optionLabel?: string
  optionValue?: string
  cacheOptions?: boolean | 'auto'
  component?: 'dropdown' | 'autocomplete'
  reference?: string
  processor?: (options: Array<{ label: string; value: unknown }>) => Array<{ label: string; value: unknown }>
  toQuery?: (value: unknown) => Record<string, unknown>
  local_filter?: (item: unknown, value: unknown) => boolean
  _filterQuery?: FilterQuery | unknown
  _cacheOptions?: boolean
  _optionsLoaded?: boolean
  [key: string]: unknown
}

/**
 * Row action configuration
 */
export interface ActionConfig {
  name: string
  icon?: string | ((row: unknown) => string)
  tooltip?: string | ((row: unknown) => string)
  severity?: string | ((row: unknown) => string)
  onClick: (row: unknown) => void | Promise<void>
  visible?: (row: unknown) => boolean
  disabled?: (row: unknown) => boolean
}

/**
 * Resolved row action for rendering
 */
export interface ResolvedAction {
  name: string
  icon: string | undefined
  tooltip: string | undefined
  severity: string
  isDisabled: boolean
  handler: () => void | Promise<void>
}

/**
 * Header action state context
 */
interface HeaderActionState {
  hasSelection: boolean
  selectionCount: number
  deleting: boolean
}

/**
 * Header action configuration
 */
export interface HeaderActionConfig {
  name: string
  label: string | ((state: HeaderActionState) => string)
  icon?: string
  severity?: string
  onClick: () => void | Promise<void>
  visible?: (state: HeaderActionState) => boolean
  loading?: (state: HeaderActionState) => boolean
}

/**
 * Resolved header action for rendering
 */
export interface ResolvedHeaderAction extends HeaderActionConfig {
  isLoading: boolean
}

/**
 * Card configuration
 */
export interface CardConfig {
  name: string
  [key: string]: unknown
}

/**
 * Search configuration
 */
export interface SearchConfig {
  placeholder?: string
  fields?: string[]
  debounce?: number
  local_search?: (item: unknown, query: string) => boolean
}

/**
 * Entity context for multi-storage routing
 */
interface EntityContext {
  parentChain: Array<{ entity: string; id: string | number }>
}

/**
 * Bulk status action return type
 */
export interface BulkStatusActionReturn {
  showDialog: Ref<boolean>
  selectedStatus: Ref<unknown>
  updating: Ref<boolean>
  statusOptions: Ref<Array<{ label: string; value: unknown }>>
  dialogTitle: string
  execute: () => Promise<void>
  cancel: () => void
  setOptions: (options: Array<{ label: string; value: unknown }>) => void
}

/**
 * Axios-like error interface
 */
interface AxiosError {
  response?: {
    data?: {
      detail?: string
    }
  }
  message?: string
}

/**
 * Options for useListPage
 */
export interface UseListPageOptions {
  /** Entity name for EntityManager */
  entity: string
  /** Custom data key field (default: manager.idField) */
  dataKey?: string
  /** Default sort field */
  defaultSort?: string | null
  /** Default sort order (-1 = desc, 1 = asc) */
  defaultSortOrder?: -1 | 1
  /** Enable server-side pagination/sorting */
  serverSide?: boolean
  /** Default page size */
  pageSize?: number
  /** Auto-load on mount (default: true) */
  loadOnMount?: boolean
  /** Persist filters to sessionStorage (default: true) */
  persistFilters?: boolean
  /** Sync filters to URL query params (default: true) */
  syncUrlParams?: boolean
  /** Filter mode: 'auto' | 'manager' | 'local' */
  filterMode?: 'auto' | 'manager' | 'local'
  /** Auto-filter threshold for 'auto' mode */
  autoFilterThreshold?: number
  /** Auto-load filters from registry (default: true) */
  autoLoadFilters?: boolean
  /** Callback before load */
  onBeforeLoad?: ((params: Record<string, unknown>) => Record<string, unknown> | void) | null
  /** Callback after load */
  onAfterLoad?: ((response: ListResponse, processedData: { items: unknown[]; total: number }) => void) | null
  /** Transform response */
  transformResponse?: ((response: ListResponse) => { items: unknown[]; total: number }) | null
  /** Override manager.entityName */
  entityName?: string
  /** Override manager.labelPlural */
  entityNamePlural?: string
  /** Override manager.routePrefix */
  routePrefix?: string
}

/**
 * List page props for ListPage component
 */
export interface ListPageProps {
  title: string | undefined
  headerActions: ResolvedHeaderAction[]
  cards: CardConfig[]
  columns: ColumnConfig[]
  items: unknown[]
  loading: boolean
  dataKey: string
  selected: unknown[]
  selectable: boolean
  lazy: boolean
  totalRecords: number
  rows: number
  rowsPerPageOptions: number[]
  sortField: string | null
  sortOrder: number
  searchQuery: string
  searchPlaceholder: string
  filters: FilterConfig[]
  filterValues: Record<string, unknown>
  isFilterAtDefault: (name: string) => boolean
  getActions: (row: unknown) => ResolvedAction[]
  hasRowTapAction: boolean
}

/**
 * List page events for ListPage component
 */
export interface ListPageEvents {
  'update:selected': (value: unknown[]) => void
  'update:searchQuery': (value: string) => void
  'update:filterValues': (values: Record<string, unknown>) => void
  page: (event: { page: number; rows: number }) => void
  sort: (event: { sortField: string; sortOrder: number }) => void
  'row-click': (item: unknown, event: Event) => void
}

/**
 * Create action options
 */
export interface CreateActionOptions {
  label?: string
  routeName?: string
  params?: Record<string, unknown>
}

/**
 * Bulk status action options
 */
export interface BulkStatusActionOptions {
  statusField?: string
  idsField?: string
  bulkEndpoint?: string | null
  options?: Array<{ label: string; value: unknown }>
  label?: string
  icon?: string
  dialogTitle?: string
}

/**
 * Return type for useListPage
 */
export interface UseListPageReturn {
  // Manager access
  manager: EntityManager

  // Parent chain (when list is child of parent entity)
  parentConfig: ComputedRef<ParentConfig | null>
  parentId: ComputedRef<string | number | null>
  parentData: ComputedRef<unknown>
  parentLoading: ComputedRef<boolean>
  parentChain: ComputedRef<Map<number, unknown>>
  parentPage: UseEntityItemPageReturn | null

  // State
  items: Ref<unknown[]>
  displayItems: ComputedRef<unknown[]>
  loading: Ref<boolean>
  selected: Ref<unknown[]>
  deleting: Ref<boolean>

  // Pagination
  page: Ref<number>
  pageSize: Ref<number>
  totalRecords: Ref<number>
  rowsPerPageOptions: number[]
  sortField: Ref<string | null>
  sortOrder: Ref<number>
  onPage: (event: { page: number; rows: number }) => void
  onSort: (event: { sortField: string; sortOrder: number }) => void

  // Search
  searchQuery: Ref<string>
  searchConfig: Ref<SearchConfig>
  setSearch: (config: Partial<SearchConfig>) => void

  // Columns
  columns: ComputedRef<ColumnConfig[]>
  addColumn: (field: string, config?: Partial<ColumnConfig>) => void
  removeColumn: (field: string) => void
  updateColumn: (field: string, updates: Partial<ColumnConfig>) => void

  // Header Actions
  headerActions: ComputedRef<ResolvedHeaderAction[]>
  addHeaderAction: (name: string, config: Omit<HeaderActionConfig, 'name'>) => void
  removeHeaderAction: (name: string) => void
  getHeaderActions: () => ResolvedHeaderAction[]
  addCreateAction: (labelOrOptions?: string | CreateActionOptions | null) => void
  addBulkDeleteAction: () => void
  addBulkStatusAction: (options?: BulkStatusActionOptions) => BulkStatusActionReturn
  hasBulkActions: ComputedRef<boolean>

  // Cards
  cards: ComputedRef<CardConfig[]>
  addCard: (name: string, config: Omit<CardConfig, 'name'>) => void
  updateCard: (name: string, config: Partial<CardConfig>) => void
  removeCard: (name: string) => void

  // Filters
  filters: ComputedRef<FilterConfig[]>
  filterValues: Ref<Record<string, unknown>>
  filteredItems: ComputedRef<unknown[]>
  fromCache: Ref<boolean>
  addFilter: (name: string, config: Omit<FilterConfig, 'name'>) => void
  removeFilter: (name: string) => void
  setFilterValue: (name: string, value: unknown) => void
  updateFilters: (values: Record<string, unknown>) => void
  clearFilters: () => void
  isFilterAtDefault: (name: string) => boolean
  hasActiveFilters: ComputedRef<boolean>
  loadFilterOptions: () => Promise<void>
  initFromRegistry: () => void
  restoreFilters: () => void

  // Actions
  addAction: (name: string, config: Omit<ActionConfig, 'name'>) => void
  removeAction: (name: string) => void
  getActions: (row: unknown) => ResolvedAction[]
  getRowActions: (row: unknown) => ResolvedAction[]
  addViewAction: (options?: Partial<ActionConfig>) => void
  addEditAction: (options?: Partial<ActionConfig>) => void
  addDeleteAction: (options?: Partial<ActionConfig> & { labelField?: string }) => void

  // Permissions
  canCreate: ComputedRef<boolean>
  canDelete: ComputedRef<boolean>
  canEditRow: (row: unknown) => boolean
  canDeleteRow: (row: unknown) => boolean

  // Data
  loadItems: (extraParams?: Record<string, unknown>, options?: { force?: boolean }) => Promise<void>

  // Navigation
  goToCreate: () => void
  goToEdit: (item: unknown) => void
  goToShow: (item: unknown) => void

  // Mobile row tap
  isMobile: Ref<boolean>
  hasRowTapAction: ComputedRef<boolean>
  getPrimaryRowAction: () => 'edit' | 'show' | null
  onRowClick: (item: unknown, event: Event) => void

  // Delete
  deleteItem: (item: unknown, labelField?: string) => Promise<void>
  confirmDelete: (item: unknown, labelField?: string) => void
  bulkDelete: () => Promise<void>
  confirmBulkDelete: () => void
  hasSelection: ComputedRef<boolean>
  selectionCount: ComputedRef<number>

  // Utilities
  formatDate: (dateStr: string | null | undefined, options?: Intl.DateTimeFormatOptions) => string
  toast: ToastHelper
  confirm: ConfirmService
  router: Router

  // ListPage integration
  props: ComputedRef<ListPageProps>
  events: ListPageEvents
}

/**
 * Unified procedural builder for CRUD list pages
 *
 * @param config - Configuration options
 * @returns List page API
 */
export function useListPage(config: UseListPageOptions): UseListPageReturn {
  const {
    entity,
    dataKey,
    defaultSort = null,
    defaultSortOrder = -1,
    pageSize: defaultPageSize = 10,
    loadOnMount = true,
    persistFilters = true,
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

  // Get EntityManager via orchestrator
  const orchestrator = inject<Orchestrator | null>('qdadmOrchestrator')

  // Toast helper - wraps orchestrator.toast for legacy compatibility
  const toast: ToastHelper = {
    add({ severity, summary, detail, emitter }) {
      orchestrator?.toast[severity]?.(summary, detail, emitter)
    },
  }

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
  const items = ref<unknown[]>([])
  const loading = ref(false)
  const selected = ref<unknown[]>([])
  const deleting = ref(false)

  // Pagination
  const page = ref(1)
  const pageSize = ref(getSavedPageSize(defaultPageSize))
  const totalRecords = ref(0)
  const rowsPerPageOptions = PAGE_SIZE_OPTIONS

  // Sorting
  const sortField = ref<string | null>(defaultSort)
  const sortOrder = ref(defaultSortOrder)

  // Search
  const searchQuery = ref(savedSearch)
  const searchConfig = ref<SearchConfig>({
    placeholder: 'Search...',
    fields: [],
    debounce: 300,
  })

  // ============ COLUMNS ============
  const columnsMap = ref<Map<string, ColumnConfig>>(new Map())

  function addColumn(field: string, columnConfig: Partial<ColumnConfig> = {}): void {
    columnsMap.value.set(field, {
      field,
      header: columnConfig.header || field.charAt(0).toUpperCase() + field.slice(1),
      ...columnConfig,
    })
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

  // ============ FILTERS ============
  const filtersMap = ref<Map<string, FilterConfig>>(new Map())
  const filterValues = ref<Record<string, unknown>>(savedFilters || {})

  function addFilter(name: string, filterConfig: Omit<FilterConfig, 'name'>): void {
    filtersMap.value.set(name, {
      name,
      type: 'select',
      placeholder: name,
      ...filterConfig,
    })
    if (filterValues.value[name] === undefined) {
      filterValues.value[name] = filterConfig.default ?? null
    }
  }

  function removeFilter(name: string): void {
    filtersMap.value.delete(name)
    delete filterValues.value[name]
  }

  function setFilterValue(name: string, value: unknown): void {
    filterValues.value = { ...filterValues.value, [name]: value }
  }

  function updateFilters(newValues: Record<string, unknown>): void {
    filterValues.value = { ...filterValues.value, ...newValues }
    onFiltersChanged()
  }

  function onFiltersChanged(): void {
    page.value = 1
    loadItems()
    if (persistFilters) {
      const toPersist: Record<string, unknown> = {}
      for (const [name, value] of Object.entries(filterValues.value)) {
        const filterDef = filtersMap.value.get(name)
        if (
          filterDef?.persist !== false &&
          value !== null &&
          value !== undefined &&
          value !== ''
        ) {
          toPersist[name] = value
        }
      }
      if (searchQuery.value) {
        toPersist._search = searchQuery.value
      }
      setSessionFilters(filterSessionKey, toPersist)
    }
    if (syncUrlParams) {
      const query = { ...route.query } as Record<string, string>
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

  function clearFilters(): void {
    const cleared: Record<string, unknown> = {}
    for (const [key, filterDef] of filtersMap.value.entries()) {
      cleared[key] = filterDef.default ?? null
    }
    filterValues.value = cleared
    searchQuery.value = ''
    if (persistFilters) {
      sessionStorage.removeItem(FILTER_SESSION_PREFIX + filterSessionKey)
    }
    if (syncUrlParams) {
      const query = { ...route.query } as Record<string, string>
      for (const key of filtersMap.value.keys()) {
        delete query[key]
      }
      delete query.search
      router.replace({ query })
    }
    page.value = 1
    loadItems()
  }

  const filters = computed(() => Array.from(filtersMap.value.values()))

  /**
   * Check if a filter is at its default value
   * Used for styling: default = blue (info), modified = orange (warning)
   */
  function isFilterAtDefault(name: string): boolean {
    const filterDef = filtersMap.value.get(name)
    if (!filterDef) return true
    const currentValue = filterValues.value[name]
    const defaultValue = filterDef.default ?? null
    return currentValue === defaultValue
  }

  /**
   * Check if any filter is NOT at its default value (or search is active)
   * Useful to show a "clear filters" button only when needed
   */
  const hasActiveFilters = computed(() => {
    if (searchQuery.value) return true
    for (const [name, filterDef] of filtersMap.value.entries()) {
      const currentValue = filterValues.value[name]
      const defaultValue = filterDef.default ?? null
      if (currentValue !== defaultValue) return true
    }
    return false
  })

  // ============ AUTO-LOAD FROM REGISTRY ============

  function initFromRegistry(): void {
    if (!autoLoadFilters) return

    const entityConfig = entityFilters[entityName]
    if (!entityConfig) return

    if (entityConfig.search) {
      setSearch(entityConfig.search)
    }

    if (entityConfig.filters) {
      for (const filterDef of entityConfig.filters) {
        addFilter(filterDef.name, filterDef)
      }
    }
  }

  async function loadFilterOptions(): Promise<void> {
    // Process filters configured directly via addFilter() (smart filter modes)
    for (const [filterName, filterDef] of filtersMap.value) {
      if (filterDef.options && filterDef.options.length > 1) continue
      if (filterDef.optionsFromCache) continue

      try {
        let rawOptions: Array<{ label: string; value: unknown }> | null = null

        // Mode 1: optionsEntity - fetch from related EntityManager via FilterQuery
        if (filterDef.optionsEntity) {
          const filterQuery = new FilterQuery({
            source: 'entity',
            entity: filterDef.optionsEntity,
            label: filterDef.optionLabel || 'name',
            value: filterDef.optionValue || 'id',
          })

          rawOptions = (await filterQuery.getOptions(orchestrator)) as Array<{
            label: string
            value: unknown
          }>
          filterDef._filterQuery = filterQuery
        }
        // Mode 2: optionsEndpoint - fetch from API endpoint
        else if (filterDef.optionsEndpoint) {
          const endpoint =
            filterDef.optionsEndpoint === true
              ? `distinct/${filterName}`
              : filterDef.optionsEndpoint
          const response = await manager.request('GET', endpoint as string)
          const data = Array.isArray(response)
            ? response
            : ((response as Record<string, unknown>)?.items as unknown[]) || []
          rawOptions = data.map((opt) => {
            if (typeof opt === 'object' && opt !== null) {
              const o = opt as Record<string, unknown>
              return {
                label: (o.label || o.name || String(o.value ?? o.id)) as string,
                value: o.value ?? o.id,
              }
            }
            return { label: snakeToTitle(String(opt)), value: opt }
          })
        }

        if (rawOptions !== null) {
          const cacheOptions = filterDef.cacheOptions ?? 'auto'
          let shouldCache = cacheOptions === true

          if (cacheOptions === 'auto') {
            shouldCache = rawOptions.length <= SMART_FILTER_THRESHOLD
          }

          const componentType =
            filterDef.component || (shouldCache ? 'dropdown' : 'autocomplete')
          const allLabel =
            filterDef.allLabel || filterDef.placeholder || `All ${snakeToTitle(filterName)}`
          let finalOptions = [{ label: allLabel, value: null as unknown }, ...rawOptions]

          if (typeof filterDef.processor === 'function') {
            finalOptions = filterDef.processor(finalOptions)
          }

          const updatedFilter: FilterConfig = {
            ...filterDef,
            options: finalOptions,
            type: componentType,
            _cacheOptions: shouldCache,
            _optionsLoaded: shouldCache,
          }
          delete updatedFilter.optionLabel
          delete updatedFilter.optionValue
          filtersMap.value.set(filterName, updatedFilter)
        }
      } catch (error) {
        console.warn(`[qdadm] Failed to load options for filter "${filterName}":`, error)
      }
    }

    // Invoke filter:alter hooks after all options are loaded
    await invokeFilterAlterHook()

    // Trigger Vue reactivity
    filtersMap.value = new Map(filtersMap.value)
  }

  async function updateCacheBasedFilters(): Promise<void> {
    if (items.value.length === 0) return

    let hasChanges = false

    for (const [filterName, filterDef] of filtersMap.value) {
      if (!filterDef.optionsFromCache) continue
      if (filterDef._optionsLoaded) continue
      // Skip if filter has an explicit query property (advanced usage)
      if (filterDef.query) continue

      const currentValue = filterValues.value[filterName]
      if (currentValue !== null && currentValue !== undefined && currentValue !== '') {
        continue
      }

      const fieldName =
        typeof filterDef.optionsFromCache === 'string' ? filterDef.optionsFromCache : filterName

      const filterQuery = new FilterQuery({
        source: 'field',
        field: fieldName,
      })

      // Provide a minimal mock manager with cached data for field-based filtering
      filterQuery.setParentManager({
        _cache: items.value,
        list: async () => ({ items: items.value }),
      })

      const rawOptions = (await filterQuery.getOptions()) as Array<{ label: string; value: unknown }>

      const cacheOptions = filterDef.cacheOptions ?? 'auto'
      let shouldCache = true

      if (cacheOptions === 'auto') {
        shouldCache = rawOptions.length <= SMART_FILTER_THRESHOLD
      } else if (cacheOptions === false) {
        shouldCache = false
      }

      const componentType =
        filterDef.component ||
        (rawOptions.length <= SMART_FILTER_THRESHOLD ? 'dropdown' : 'autocomplete')

      const allLabel =
        filterDef.allLabel || filterDef.placeholder || `All ${snakeToTitle(filterName)}`
      let finalOptions = [
        { label: allLabel, value: null as unknown },
        ...rawOptions.map((opt) => ({
          label: snakeToTitle(String(opt.label)),
          value: opt.value,
        })),
      ]

      if (typeof filterDef.processor === 'function') {
        finalOptions = filterDef.processor(finalOptions)
      }

      const updatedFilter: FilterConfig = {
        ...filterDef,
        options: finalOptions,
        type: componentType,
        _cacheOptions: shouldCache,
        _optionsLoaded: true,
        _filterQuery: filterQuery,
      }

      filtersMap.value.set(filterName, updatedFilter)
      hasChanges = true
    }

    if (hasChanges) {
      filtersMap.value = new Map(filtersMap.value)
    }
  }

  function restoreFilters(): void {
    for (const key of filtersMap.value.keys()) {
      if (route.query[key] !== undefined) {
        let value: unknown = route.query[key]
        if (value === 'true') value = true
        else if (value === 'false') value = false
        else if (value === 'null') value = null
        else if (!isNaN(Number(value)) && value !== '') value = Number(value)
        filterValues.value[key] = value
      }
    }
    if (route.query.search) {
      searchQuery.value = route.query.search as string
    }
  }

  // ============ ACTIONS ============
  const actionsMap = ref<Map<string, ActionConfig>>(new Map())

  function addAction(name: string, actionConfig: Omit<ActionConfig, 'name'>): void {
    actionsMap.value.set(name, {
      name,
      severity: 'secondary',
      ...actionConfig,
    } as ActionConfig)
  }

  function removeAction(name: string): void {
    actionsMap.value.delete(name)
  }

  function resolveValue<T>(value: T | ((row: unknown) => T), row: unknown): T {
    return typeof value === 'function' ? (value as (row: unknown) => T)(row) : value
  }

  function getActions(row: unknown): ResolvedAction[] {
    const actions: ResolvedAction[] = []
    for (const [, action] of actionsMap.value) {
      if (action.visible && !action.visible(row)) continue
      actions.push({
        name: action.name,
        icon: action.icon ? resolveValue(action.icon, row) : undefined,
        tooltip: action.tooltip ? resolveValue(action.tooltip, row) : undefined,
        severity: resolveValue(action.severity || 'secondary', row),
        isDisabled: action.disabled ? action.disabled(row) : false,
        handler: () => action.onClick(row),
      })
    }
    return actions
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

    loading.value = true
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

      let processedData: { items: unknown[]; total: number }
      if (transformResponse) {
        processedData = transformResponse(response)
      } else {
        processedData = {
          items: response.items || [],
          total: response.total || response.items?.length || 0,
        }
      }

      items.value = processedData.items
      totalRecords.value = processedData.total

      if (onAfterLoad) {
        onAfterLoad(response, processedData)
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
      loading.value = false
    }
  }

  // ============ PAGINATION & SORTING ============
  function onPage(event: { page: number; rows: number }): void {
    page.value = event.page + 1
    pageSize.value = event.rows
    setCookie(COOKIE_NAME, event.rows, COOKIE_EXPIRY_DAYS)
    loadItems()
  }

  function onSort(event: { sortField: string; sortOrder: number }): void {
    sortField.value = event.sortField
    sortOrder.value = event.sortOrder as 1 | -1
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

  // ============ HOOKS ============

  async function invokeListAlterHook(): Promise<void> {
    if (!hooks) return

    const configSnapshot = {
      entity,
      columns: Array.from(columnsMap.value.values()),
      filters: Array.from(filtersMap.value.values()),
      actions: Array.from(actionsMap.value.values()),
      headerActions: Array.from(headerActionsMap.value.values()),
    }

    // Include entity context in the snapshot for hooks
    const configWithContext = { ...configSnapshot, entity, manager }

    let alteredConfig = await hooks.alter('list:alter', configWithContext)

    const entityHookName = `${entity}:list:alter`
    if (hooks.hasHook(entityHookName)) {
      alteredConfig = await hooks.alter(entityHookName, alteredConfig)
    }

    applyAlteredConfig(alteredConfig)
  }

  async function invokeFilterAlterHook(): Promise<void> {
    if (!hooks) return

    const filterSnapshot = {
      entity,
      filters: Array.from(filtersMap.value.values()),
    }

    let alteredFilters = (await hooks.alter('filter:alter', filterSnapshot)) as typeof filterSnapshot

    const entityHookName = `${entity}:filter:alter`
    if (hooks.hasHook(entityHookName)) {
      alteredFilters = (await hooks.alter(entityHookName, alteredFilters)) as typeof filterSnapshot
    }

    if (alteredFilters.filters) {
      filtersMap.value.clear()
      for (const filter of alteredFilters.filters) {
        filtersMap.value.set(filter.name, filter)
        if (filterValues.value[filter.name] === undefined) {
          filterValues.value[filter.name] = filter.default ?? null
        }
      }
    }
  }

  function applyAlteredConfig(alteredConfig: {
    columns?: ColumnConfig[]
    filters?: FilterConfig[]
    actions?: ActionConfig[]
    headerActions?: HeaderActionConfig[]
  }): void {
    if (alteredConfig.columns) {
      columnsMap.value.clear()
      for (const col of alteredConfig.columns) {
        columnsMap.value.set(col.field, col)
      }
    }

    if (alteredConfig.filters) {
      filtersMap.value.clear()
      for (const filter of alteredConfig.filters) {
        filtersMap.value.set(filter.name, filter)
        if (filterValues.value[filter.name] === undefined) {
          filterValues.value[filter.name] = filter.default ?? null
        }
      }
    }

    if (alteredConfig.actions) {
      actionsMap.value.clear()
      for (const action of alteredConfig.actions) {
        actionsMap.value.set(action.name, action)
      }
    }

    if (alteredConfig.headerActions) {
      headerActionsMap.value.clear()
      for (const action of alteredConfig.headerActions) {
        headerActionsMap.value.set(action.name, action)
      }
    }
  }

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
  function formatDate(
    dateStr: string | null | undefined,
    options: Intl.DateTimeFormatOptions = {}
  ): string {
    if (!dateStr) return '-'
    const defaultOptions: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      ...options,
    }
    return new Date(dateStr).toLocaleDateString('fr-FR', defaultOptions)
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
      selected.value = value
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
