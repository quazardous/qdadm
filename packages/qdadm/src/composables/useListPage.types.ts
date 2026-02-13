/**
 * useListPage - Type definitions
 *
 * Extracted from useListPage.ts for maintainability.
 */
import type { Ref, ComputedRef } from 'vue'
import type { Router } from 'vue-router'
import type { FilterQuery } from '../query/FilterQuery'
import type { ParentConfig, UseEntityItemPageReturn } from './useEntityItemPage.js'
import type { EntityManagerRead } from '../entity/EntityManager.interface'

/**
 * Entity manager interface for list pages (re-export for convenience)
 */
export type EntityManager = EntityManagerRead

/**
 * List response from API
 */
export interface ListResponse {
  items: unknown[]
  total?: number
  fromCache?: boolean
  [key: string]: unknown
}

/**
 * Orchestrator interface
 */
export interface Orchestrator {
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
export interface ToastHelper {
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
export interface ConfirmService {
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
export interface HeaderActionState {
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
export interface EntityContext {
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
export interface AxiosError {
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
