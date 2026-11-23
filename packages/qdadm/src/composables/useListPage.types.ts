/**
 * useListPage - Type definitions
 *
 * Extracted from useListPage.ts for maintainability.
 */
import type { RouteStatePersister } from '../routeState'
import type { Ref, ComputedRef, Component } from 'vue'
import type { Router } from 'vue-router'
import type { FilterQuery } from '../query/FilterQuery'
import type { ParentConfig, UseEntityItemPageReturn } from './useEntityItemPage.js'
import type { EntityManagerRead, OrchestratorLike } from '../entity/EntityManager.interface'

/**
 * Entity manager interface for list pages (re-export for convenience)
 */
export type EntityManager = EntityManagerRead

/**
 * List response from API
 */
export interface ListResponse<T = unknown> {
  items: T[]
  total?: number
  fromCache?: boolean
  [key: string]: unknown
}

/**
 * Orchestrator interface
 */
// #1191 — shared structural view, parameterized on the Read tier
export type Orchestrator = OrchestratorLike<EntityManager>

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
    closeOnEscape?: boolean
    accept: () => void
  }) => void
}

/**
 * Column configuration
 */
export interface ColumnConfig {
  field: string
  /**
   * Column header. When an i18n key `entities.{entity}.fields.{field}`
   * exists, the catalog WINS — an inline header is the no-key fallback,
   * not an absolute override (#1255). To pin a header, don't create the key.
   */
  header?: string
  sortable?: boolean
  style?: string
  body?: (row: unknown) => unknown
  [key: string]: unknown
}

/**
 * Filter configuration
 */
/**
 * The filter controls qdadm knows how to render.
 *
 * Exported as a VALUE, not only a type, so a consumer's own guard can read
 * this list instead of copying it — a copy goes stale the day a type is
 * added and starts rejecting correct code.
 */
export const FILTER_TYPES = [
  'select',
  'multiselect',
  'date',
  'checkbox',
  'dropdown',
  'autocomplete',
] as const

export type FilterType = (typeof FILTER_TYPES)[number]

/**
 * Everything a filter can be given EXCEPT its name (#2147).
 *
 * Split out rather than written as `Omit<FilterConfig, 'name'>`, and the
 * reason is not style. `FilterConfig` carries an index signature, so
 * `keyof` includes `string`; `Exclude<string, 'name'>` is still `string`, and
 * the `Omit` therefore collapsed to a bare `{ [x: string]: unknown }` —
 * ERASING every declared property.
 *
 * `addFilter` took that type, so **no filter option was checked at all**:
 * not `type`, not `optionLabel`, not `local_filter`. A consumer declared
 * `type: 'text'`, TypeScript accepted it, and the filter rendered as an empty
 * dropdown saying "No available options". Nothing was wrong at any single
 * step, which is why it survived.
 *
 * Declaring the properties here and having `FilterConfig` extend it keeps the
 * index signature — apps do stash their own keys — while the declared ones
 * are checked again.
 */
/** A choice's badge (#5467): a short tag drawn before its label */
export interface FilterChoiceBadge {
  label: string
  /** critical / danger, watch / warn, good / success, info, neutral / secondary, the app's own --qd-tone-<name>, or a CSS colour */
  tone?: string
}

/** One choice of a filter */
export interface FilterChoice {
  label: string
  value: unknown
  /** The heading it is listed under (#5467), in the order the groups first appear */
  group?: string
  /** A short tag before its label (#5467) */
  badge?: FilterChoiceBadge
  [key: string]: unknown
}

export interface FilterOptions {
  type?: FilterType
  placeholder?: string
  options?: Array<{ label: string; value: unknown }> | FilterChoice[]
  /**
   * Several values (#5467): the value is an array, none chosen is off. Drawn
   * by QdMultiFilter (groups, badges, a search past 8 choices) unless the
   * filter names its own `component`. `type: 'multiselect'` says the same.
   */
  multiple?: boolean
  /**
   * The height of a `multiple` filter's list (#5470), any CSS length
   * (`'20rem'`, `'50vh'`). Default: as tall as the room between the filter
   * and the edge of the window it opens towards, 14rem at least.
   */
  scrollHeight?: string
  /**
   * The value in words (#5467), for "Save this search" and a run's filter;
   * default: the chosen choices' labels. A custom component may carry it as
   * a static `describe` too.
   */
  describe?: (value: unknown) => string | undefined
  default?: unknown
  /**
   * How the empty choice is written when the filter has a `default` (#5460):
   * kept explicitly in the address, so a deliberately empty filter is not
   * read back as unset and given its default again. `'null'` unless the
   * entity (`filterEmptyValue`) or the filter says otherwise; read back as
   * null either way.
   */
  emptyValue?: string | number
  persist?: boolean
  /**
   * A preference, kept from the session even when the address names other
   * filters (#5428): a link that names some filters describes a whole state,
   * so the session's others go back to their default, except these.
   */
  keepFromSession?: boolean
  /**
   * The filters whose values this one's choices depend on (#5427): when one
   * changes, the choices are read again with their values, as `params` of
   * `optionsEndpoint` or `filters` of `optionsEntity`'s list. A name list
   * sends each under its own name; `{ universe: 'universe_id' }` renames.
   */
  dependsOn?: string[] | Record<string, string>
  /**
   * Whether the value picked still stands once the choices are read again
   * (#5427); default: it is among them. `false` clears it.
   */
  validate?: (value: unknown, context: { options: Array<{ label: string; value: unknown }>; values: Record<string, unknown> }) => boolean | Promise<boolean>
  /** The choices are being read again: the old ones stay shown meanwhile */
  _optionsLoading?: boolean
  /** The empty choice's label; `false` for no empty choice on static options (#4692) */
  allLabel?: string | false
  optionsEntity?: string
  optionsEndpoint?: string | boolean
  optionsFromCache?: string | boolean
  optionLabel?: string
  optionValue?: string
  cacheOptions?: boolean | 'auto'
  /**
   * How it is drawn: `'dropdown'`, `'autocomplete'`, or the app's own
   * component (#5467), under the filter contract (QdFilterProps in,
   * `update:modelValue` out)
   */
  component?: 'dropdown' | 'autocomplete' | Component
  reference?: string
  processor?: (options: Array<{ label: string; value: unknown }>) => Array<{ label: string; value: unknown }>
  toQuery?: (value: unknown) => Record<string, unknown>
  local_filter?: (item: unknown, value: unknown) => boolean
  _filterQuery?: FilterQuery | unknown
  _cacheOptions?: boolean
  _optionsLoaded?: boolean
  /** The choices are the app's (setFilterOptions, #5457): no loader reads them again */
  _optionsOwned?: boolean
  [key: string]: unknown
}

export interface FilterConfig extends FilterOptions {
  name: string
}

/**
 * Row action configuration
 */
export interface ActionConfig {
  name: string
  icon?: string | ((row: unknown) => string)
  tooltip?: string | ((row: unknown) => string)
  /** The button's accessible name; the tooltip when absent (#5323) */
  ariaLabel?: string | ((row: unknown) => string)
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
  /** The button's accessible name (#5323) */
  ariaLabel: string | undefined
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
  size?: string
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
export interface UseListPageOptions<T = unknown> {
  /** Entity name for EntityManager */
  entity: string
  /** Custom data key field (default: manager.idField) */
  dataKey?: string
  /**
   * The key this list's session memory is kept under (#5440): its filters,
   * search and sort. Default: the entity, shared by every list of it. Give
   * one per page when several lists show one entity (one per universe).
   */
  sessionKey?: string
  /** Which rows get a band under their cells, drawn by ListPage's #row-band slot (#5437) */
  rowBand?: (row: T) => boolean
  /** Where the band sits (#5451): under the row's cells (default) or above them */
  rowBandPosition?: 'below' | 'above'
  /**
   * A refresh button at the end of the filter bar (#5462): the rows read
   * again past the entity's cache. Shown by default: `false` hides it, as
   * the app's `features.lists.refresh: false` does for every list.
   */
  refresh?: boolean
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
  /** Persist the active sort per entity (session storage), restored on init (#1218). Default true. */
  persistSort?: boolean
  /**
   * WRITE filters, search and the page to the URL query (default: true).
   *
   * Writing only. `false` has never stopped the query string being read, so
   * a deep link someone typed by hand still restores the list — say
   * `routeState` if you want the state kept somewhere else entirely.
   */
  syncUrlParams?: boolean
  /**
   * Where this list's state is remembered (#2146): a slug the framework
   * knows (`'url'`, …), or your own persister. Defaults to the URL.
   *
   * Setting it is a deliberate choice of medium, so it answers
   * `syncUrlParams` rather than obeying it: a list with `routeState` set
   * reads and writes that medium whatever the URL flag says.
   *
   * An unknown slug throws rather than falling back to the URL — a list
   * quietly persisting somewhere other than where you asked is worse than
   * one that will not start (ADR 0011).
   */
  routeState?: string | RouteStatePersister
  /** Filter mode: 'auto' | 'manager' | 'local' */
  filterMode?: 'auto' | 'manager' | 'local'
  /** Auto-filter threshold for 'auto' mode */
  autoFilterThreshold?: number
  /** Auto-load filters from registry (default: true) */
  autoLoadFilters?: boolean
  /** Callback before load */
  onBeforeLoad?: ((params: Record<string, unknown>) => Record<string, unknown> | void) | null
  /** Callback after load */
  onAfterLoad?: ((response: ListResponse<T>, processedData: { items: T[]; total: number }) => void) | null
  /** Transform response */
  transformResponse?: ((response: ListResponse<T>) => { items: T[]; total: number }) | null
  /** Override manager.entityName */
  entityName?: string
  /** Override manager.labelPlural */
  entityNamePlural?: string
  /** Override manager.description (list page subtitle). Pass null to suppress it. */
  subtitle?: string | null
  /** Override manager.routePrefix */
  routePrefix?: string
}

/**
 * List page props for ListPage component
 */
export interface ListPageProps {
  title: string | undefined
  /** The entity listed, for its favourites (#5349) */
  entity?: string
  /** The filter in words while one is on: offers "Save this search" (#5349) */
  searchLabel?: string | null
  subtitle: string | null
  headerActions: ResolvedHeaderAction[]
  cards: CardConfig[]
  columns: ColumnConfig[]
  items: unknown[]
  loading: boolean
  dataKey: string
  /** Which rows get a band (#5437) */
  rowBand?: ((row: unknown) => boolean) | null
  /** Where the band sits (#5451) */
  rowBandPosition: 'below' | 'above'
  /** The refresh button shown (#5462), and its read in flight */
  refreshable: boolean
  refreshing: boolean
  selected: unknown[]
  selectable: boolean
  lazy: boolean
  totalRecords: number
  rows: number
  /**
   * Row offset of the current page — what POSITIONS the paginator (#2145).
   *
   * In lazy mode the table renders exactly the rows it is handed and has no
   * way to know which page they are; `first` is the only thing that tells it.
   * Without it, a restored page 2 showed page 2's rows under a paginator
   * highlighting 1.
   */
  first: number
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
  /** The refresh button (#5462) */
  refresh: () => void
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
export interface UseListPageReturn<T = unknown> {
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
  items: Ref<T[]>
  displayItems: ComputedRef<T[]>
  loading: Ref<boolean>
  selected: Ref<T[]>
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
  /** v-bind column binding helper (#1255): field + header from one source */
  column: (name: string, overrides?: Partial<ColumnConfig>) => ColumnConfig
  addColumn: (field: string, config?: Partial<ColumnConfig>) => void
  /** One column per listable field of the entity (#4685). */
  generateColumns: (options?: { exclude?: string[]; only?: string[] }) => void
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
  filteredItems: ComputedRef<T[]>
  fromCache: Ref<boolean>
  addFilter: (name: string, config: FilterOptions) => void
  removeFilter: (name: string) => void
  /**
   * A filter's choices, from the app, at any time (#5457): they replace its
   * own, get the "All" choice, and the loaders leave them alone from then on
   */
  setFilterOptions: (name: string, options: Array<{ label: string; value: unknown }>) => void
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
  /** The rows read again past the entity's cache, the list's state kept (#5462) */
  refresh: () => Promise<void>
  /** A refresh in flight */
  refreshing: Ref<boolean>

  // Navigation
  goToCreate: () => void
  goToEdit: (item: unknown) => void
  goToShow: (item: unknown) => void
  /** Walk the rows one after the other, with the run bar (#5343) */
  startRun: (init?: Partial<import('../run/run').RunInit>) => Promise<void>

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
