<script setup lang="ts">
/**
 * ListPage - Unified list page component
 *
 * Renders a complete CRUD list page with:
 * - PageHeader with title and create button
 * - CardsGrid for stats/custom cards
 * - FilterBar with search and custom filters
 * - DataTable with actions column
 *
 * Props come from useListPage composable
 *
 * Filter types:
 * - 'select' (default): Standard dropdown
 * - 'autocomplete': Searchable dropdown with type-ahead
 */
import { computed, ref, watch, nextTick, onMounted, onUnmounted, onUpdated, useId, useSlots, markRaw, toRaw, type PropType, type Component } from 'vue'
import PageHeader from '../layout/PageHeader.vue'
import CardsGrid from '../display/CardsGrid.vue'
import FilterBar from './FilterBar.vue'
import ActionButtons from './ActionButtons.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import QdButton from '../base/QdButton.vue'
import QdSaveSearch from './QdSaveSearch.vue'
import { useFavoritesLook } from '../../favorites/look'
import SeverityTag from '../SeverityTag.vue'
import { useI18n } from '../../i18n/useI18n'
import ShowDisplay from '../show/ShowDisplay.vue'
import Select from 'primevue/select'
import AutoComplete from 'primevue/autocomplete'
import SplitButton from 'primevue/splitbutton'
import QdMultiFilter from './filters/QdMultiFilter.vue'
import QdSearchFilter from './filters/QdSearchFilter.vue'
import { searches } from './filters/remoteChoices'
import { shapeFilterValue } from './filters/contract'
import { isMultiple } from '../../composables/useListPage.filters'
import type { FilterConfig, CardConfig, ResolvedAction, ResolvedHeaderAction, ColumnConfig } from '../../composables/useListPage'

/**
 * Header action state for label function (matches useListPage)
 */
interface HeaderActionState {
  hasSelection: boolean
  selectionCount: number
  deleting: boolean
}

/**
 * Label type from HeaderActionConfig
 */
type LabelType = string | ((state: HeaderActionState) => string)

/**
 * Autocomplete event interface
 */
interface AutocompleteEvent {
  query?: string
}

/**
 * Autocomplete select event interface
 */
interface AutocompleteSelectEvent {
  value: FilterOption | string | null
}

/**
 * Filter option interface
 */
interface FilterOption {
  label: string
  value: unknown
  [key: string]: unknown
}

/**
 * SplitButton menu item
 */
interface SplitButtonMenuItem {
  label: string
  icon?: string
  disabled?: boolean
  command?: () => void
}

const props = defineProps({
  // Header
  title: { type: String, default: '' },
  subtitle: { type: String as PropType<string | null>, default: null },
  headerActions: { type: Array as PropType<ResolvedHeaderAction[]>, default: () => [] },
  /** The entity listed, for its favourites (#5349) */
  entity: { type: String as PropType<string | null>, default: null },
  /** The favourite star beside the title (#5349) */
  favorite: { type: Boolean, default: true },
  /** The filter in words while one is on: offers "Save this search" (#5349) */
  searchLabel: { type: String as PropType<string | null>, default: null },
  /** Where the search's bookmark goes (#5402): 'filters', 'header', or false; default the app's `features.favorites.saveSearch` */
  saveSearch: { type: [String, Boolean] as PropType<'filters' | 'header' | false | null>, default: null },

  // Cards
  cards: { type: Array as PropType<CardConfig[]>, default: () => [] },
  cardsColumns: { type: [Number, String] as PropType<number | 'auto'>, default: 'auto' },

  // Table data
  items: { type: Array as PropType<unknown[]>, required: true },
  /** Declared columns, shown when the page gives no #columns slot */
  columns: { type: Array as PropType<Array<ColumnConfig & { display?: Record<string, unknown> & { severity?: boolean; entity?: string } }>>, default: () => [] },
  /**
   * Extra props forwarded verbatim to the underlying PrimeVue DataTable
   * (#1217) — e.g. { nullSortOrder: -1 } to sort null values last. Bound
   * last, so they can override the defaults ListPage sets.
   */
  tableProps: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
  loading: { type: Boolean, default: false },
  dataKey: { type: String, default: 'id' },
  /**
   * Which rows get a band under their cells (#5437), with a #row-band slot;
   * without it, every row does. A row it leaves out keeps the classic row.
   */
  rowBand: { type: Function as unknown as PropType<((row: unknown) => boolean) | null>, default: null },
  /** Where the band sits (#5451): under the row's cells (default) or above them, a header line */
  rowBandPosition: { type: String as PropType<'below' | 'above'>, default: 'below' },
  /** A refresh button at the end of the filter bar (#5462), emitting `refresh`; spinning while `refreshing` */
  refreshable: { type: Boolean, default: false },
  refreshing: { type: Boolean, default: false },

  // Selection
  selected: { type: Array as PropType<unknown[]>, default: () => [] },
  selectable: { type: Boolean, default: false },

  // Pagination
  paginator: { type: Boolean, default: true },
  rows: { type: Number, default: 10 },
  rowsPerPageOptions: { type: Array as PropType<number[]>, default: () => [10, 50, 100] },
  totalRecords: { type: Number, default: 0 },
  /**
   * Row offset of the page being shown — what positions the paginator (#2145).
   * Required in lazy mode: the table is handed one page of rows and cannot
   * infer which page they are.
   */
  first: { type: Number, default: 0 },
  lazy: { type: Boolean, default: false },

  // Sorting
  sortField: { type: String as PropType<string | null>, default: null },
  sortOrder: { type: Number, default: 1 },

  // Search
  searchQuery: { type: String, default: '' },
  searchPlaceholder: { type: String, default: 'Search...' },

  // Filters
  filters: { type: Array as PropType<FilterConfig[]>, default: () => [] },
  filterValues: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
  isFilterAtDefault: { type: Function as PropType<(name: string) => boolean>, default: () => () => true },

  // Row Actions
  getActions: { type: Function as unknown as PropType<((row: unknown) => ResolvedAction[]) | null>, default: null },
  actionsWidth: { type: String, default: '120px' },

  // Mobile row tap
  hasRowTapAction: { type: Boolean, default: false }
})

// Where the search's bookmark goes (#5402): this list's say, else the app's
const favoritesLook = useFavoritesLook()
const saveSearchAt = computed(() => (props.saveSearch === null ? favoritesLook.saveSearch : props.saveSearch))

const { tOr } = useI18n()

// `{ name, label }` is read as `{ field, header }`; a column without either is skipped
const declaredColumns = computed(() =>
  props.columns
    .map((c) => {
      const loose = c as typeof c & { name?: string; label?: string }
      return { ...c, field: c.field ?? loose.name, header: c.header ?? loose.label }
    })
    .filter((c) => typeof c.field === 'string' && c.field !== '')
)

function resolveLabel(label: LabelType): string {
  if (typeof label === 'function') {
    const state: HeaderActionState = {
      hasSelection: (props.selected?.length || 0) > 0,
      selectionCount: props.selected?.length || 0,
      deleting: false
    }
    return label(state)
  }
  return label
}

// Local copy of filterValues for proper v-model binding
// PrimeVue Select needs v-model to fire change events reliably
const localFilterValues = ref<Record<string, unknown>>({})

// Autocomplete suggestions per filter (keyed by filter name)
const autocompleteSuggestions = ref<Record<string, FilterOption[]>>({})

// For autocomplete filters, we store the selected option object (not just value)
// to display the label properly. This maps filter.name -> selected option object
const autocompleteSelected = ref<Record<string, FilterOption | null>>({})

// Sync from prop to local (when parent updates)
watch(() => props.filterValues, (newVal: Record<string, unknown>) => {
  localFilterValues.value = { ...newVal }
  // Sync autocomplete selections - find matching option by value
  for (const filter of props.filters) {
    if (filter.type === 'autocomplete' && newVal[filter.name] != null) {
      const option = filter.options?.find((opt: FilterOption) =>
        (opt.value ?? opt) === newVal[filter.name]
      )
      if (option) {
        autocompleteSelected.value[filter.name] = option as FilterOption
      }
    } else if (filter.type === 'autocomplete' && newVal[filter.name] == null) {
      autocompleteSelected.value[filter.name] = null
    }
  }
}, { immediate: true, deep: true })

// Check if any filter or search has a non-null value (an empty array is none, #5467)
const hasActiveFilters = computed(() => {
  const set = (v: unknown): boolean => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
  // Off its default (a filter emptied against one, #5460), or set when it has none
  const hasFilters =
    props.filters.some((f) => !props.isFilterAtDefault(f.name)) ||
    Object.entries(props.filterValues).some(([name, v]) => {
      const def = props.filters.find((f) => f.name === name)?.default
      return set(v) && !set(def)
    })
  const hasSearch = props.searchQuery && props.searchQuery.trim() !== ''
  return hasFilters || hasSearch
})

const emit = defineEmits<{
  (e: 'update:selected', value: unknown[]): void
  (e: 'update:searchQuery', value: string): void
  (e: 'update:filterValues', values: Record<string, unknown>): void
  (e: 'page', event: { page: number; rows: number }): void
  (e: 'sort', event: { sortField: string | null; sortOrder: number | null }): void
  (e: 'row-click', data: unknown, originalEvent: MouseEvent): void
  (e: 'refresh'): void
}>()

// Mobile detection for header actions dropdown
const isMobile = ref<boolean>(window.innerWidth < 768)
function handleResize(): void {
  isMobile.value = window.innerWidth < 768
}
onMounted(() => window.addEventListener('resize', handleResize))
onUnmounted(() => window.removeEventListener('resize', handleResize))

// Header actions for mobile split button
// Primary action = last (rightmost, e.g. Delete selected), dropdown = rest (e.g. Create)
const primaryHeaderAction = computed(() => {
  if (props.headerActions.length === 0) return null
  return props.headerActions[props.headerActions.length - 1] as ResolvedHeaderAction
})
const dropdownHeaderActions = computed(() => {
  if (props.headerActions.length <= 1) return [] as SplitButtonMenuItem[]
  return props.headerActions.slice(0, -1).map((action) => ({
    label: resolveLabel(action.label),
    icon: action.icon,
    disabled: action.isLoading,
    command: action.onClick
  })) as SplitButtonMenuItem[]
})

function clearAllFilters(): void {
  // Build empty filter values object
  // Each filter back to its default (#5460: with one, null would now stay as a choice of none)
  const cleared: Record<string, unknown> = {}
  for (const key of Object.keys(localFilterValues.value)) {
    const def = props.filters.find((f) => f.name === key)?.default
    const none = def === null || def === undefined || def === '' || (Array.isArray(def) && def.length === 0)
    cleared[key] = none ? null : def
  }
  // Update local ref first (for immediate UI feedback)
  localFilterValues.value = cleared
  // Clear autocomplete selections too
  autocompleteSelected.value = {}
  // Then emit to parent
  emit('update:filterValues', cleared)
  // Also clear search
  emit('update:searchQuery', '')
}

function onSelectionChange(value: unknown[]): void {
  emit('update:selected', value)
}

function onSearchChange(value: string): void {
  emit('update:searchQuery', value)
}

function onFilterChange(_name: string): void {
  emit('update:filterValues', { ...localFilterValues.value })
}

// ── The plain select's choices (#5578): their label and icon ────────────────
function choiceLabel(filter: FilterConfig, option: unknown): string {
  if (option === null || option === undefined) return ''
  if (typeof option !== 'object') return String(option)
  const o = option as Record<string, unknown>
  return String(o[filter.optionLabel || 'label'] ?? o.label ?? '')
}
/** The chosen one's choice, for the field; none when nothing is chosen */
function chosenChoice(filter: FilterConfig, value: unknown): (FilterOption & { icon?: string }) | null {
  if (value === null || value === undefined || value === '') return null
  const key = filter.optionValue || 'value'
  for (const o of filter.options ?? []) {
    if (o === null || o === undefined) continue
    if (typeof o !== 'object') {
      if (String(o) === String(value)) return { label: String(o) } as FilterOption & { icon?: string }
    } else if (String((o as Record<string, unknown>)[key]) === String(value)) return o as FilterOption & { icon?: string }
  }
  // Not among them: the value itself, as the select showed it
  return { label: String(value) } as FilterOption & { icon?: string }
}

// ── Filters drawn under the filter contract (#5467) ──────────────────────────
/**
 * The app's own component; QdMultiFilter for several values; QdSearchFilter
 * for one value searched on the server (#5576); null for the built-in select
 * / autocomplete
 */
function contractComponent(filter: FilterConfig): Component | null {
  const own = filter.component
  if (own && typeof own !== 'string') return markRaw(toRaw(own as Component))
  if (isMultiple(filter)) return QdMultiFilter as Component
  return searches(filter) ? (QdSearchFilter as Component) : null
}
/** Its value, as the contract gives it: never undefined, `[]` for none when several */
function contractValue(filter: FilterConfig): unknown {
  const v = localFilterValues.value[filter.name]
  if (isMultiple(filter)) return Array.isArray(v) ? v : v === null || v === undefined || v === '' ? [] : [v]
  return v ?? null
}
/** A value given back: to the declared shape (said once in development), then the list's */
function onContractChange(filter: FilterConfig, value: unknown): void {
  const shaped = shapeFilterValue(isMultiple(filter), value)
  if (shaped.problem && import.meta.env.DEV) console.warn(`[qdadm] Filter "${filter.name}": its component ${shaped.problem}`)
  localFilterValues.value[filter.name] = shaped.value
  emit('update:filterValues', { ...localFilterValues.value })
}

/**
 * Handle autocomplete search/filter
 * @param event - PrimeVue autocomplete event with query property
 * @param filter - Filter definition from props.filters
 */
function onAutocompleteSearch(event: AutocompleteEvent, filter: FilterConfig): void {
  const query = (event.query || '').toLowerCase()
  const labelField = filter.optionLabel || 'label'

  if (!query) {
    // Show all options when query is empty
    autocompleteSuggestions.value[filter.name] = [...(filter.options || [])] as FilterOption[]
  } else {
    // Filter options by label
    autocompleteSuggestions.value[filter.name] = (filter.options || []).filter((opt: FilterOption) => {
      const label = typeof opt === 'string' ? opt : ((opt as FilterOption)[labelField] || '')
      return String(label).toLowerCase().includes(query)
    }) as FilterOption[]
  }
}

/**
 * Handle autocomplete selection
 * @param event - PrimeVue event with value property (selected option)
 * @param filter - Filter definition
 */
function onAutocompleteSelect(event: AutocompleteSelectEvent, filter: FilterConfig): void {
  const selected = event.value
  const valueField = filter.optionValue || 'value'

  // Store the selected option for display
  autocompleteSelected.value[filter.name] = selected as FilterOption | null

  // Extract the actual value to send to API
  const value = selected != null
    ? (typeof selected === 'string' ? selected : (selected as FilterOption)[valueField])
    : null

  localFilterValues.value[filter.name] = value
  emit('update:filterValues', { ...localFilterValues.value })
}

/**
 * Handle autocomplete clear (user clears the input)
 */
function onAutocompleteClear(filter: FilterConfig): void {
  autocompleteSelected.value[filter.name] = null
  localFilterValues.value[filter.name] = null
  emit('update:filterValues', { ...localFilterValues.value })
}

function onPage(event: { page: number; rows: number }): void {
  emit('page', event)
}

function onSort(event: unknown): void {
  const e = event as { sortField?: string | null; sortOrder?: number | null }
  // Pass removableSort's "sort removed" state through honestly (#1222):
  // null stays null — the composable decides the fallback (defaultSort).
  emit('sort', { sortField: e.sortField ?? null, sortOrder: e.sortOrder ?? null })
}

function onRowClick(event: { data: unknown; originalEvent: Event }): void {
  // event.data = row data, event.originalEvent = Event
  emit('row-click', event.data, event.originalEvent as MouseEvent)
}

// ── Row bands (#5437): cells on top, a full-width band under, row by row ──────
const slots = useSlots()
const hasBand = computed(() => !!slots['row-band'])
const keyOf = (row: unknown): string => String((row as Record<string, unknown>)?.[props.dataKey])
const banded = (row: unknown): boolean => hasBand.value && (!props.rowBand || !!props.rowBand(row))
/** Always open for the rows that have one: no expander, no toggle */
const expandedRows = computed<Record<string, boolean>>(() =>
  hasBand.value ? Object.fromEntries((props.items ?? []).filter(banded).map((r) => [keyOf(r), true])) : {}
)
/**
 * Above the cells (#5451): PrimeVue draws a row expansion after its row only,
 * so the band above is a subheader row group, one group per banded row; the
 * rows without a band share one key, and their empty header is hidden. A page
 * that groups its rows itself keeps the band below.
 */
const bandAbove = computed(() => {
  if (!hasBand.value || props.rowBandPosition !== 'above') return false
  if (props.tableProps?.rowGroupMode) {
    if (import.meta.env.DEV) console.warn("[qdadm] ListPage: rowBandPosition 'above' draws on PrimeVue's row groups; this list groups its own rows (tableProps.rowGroupMode), so its band stays below")
    return false
  }
  return true
})
const NO_BAND = Symbol('no band')
const groupOf = (row: unknown): unknown => (banded(row) ? keyOf(row) : NO_BAND)
/** The band's cell spans every column (PrimeVue leaves one out for the group's own column) */
const tablePt = computed(() => {
  const own = props.tableProps?.pt as Record<string, unknown> | undefined
  if (!bandAbove.value) return own
  return { ...own, rowGroupHeaderCell: ({ instance }: { instance: { columnsLength?: number } }) => ({ colspan: instance?.columnsLength }) }
})
/** The page's own row groups, else one per banded row when the band is above */
const tableRowGroupMode = computed(() => (bandAbove.value ? 'subheader' : (props.tableProps?.rowGroupMode as 'subheader' | 'rowspan' | undefined)))
const tableGroupRowsBy = computed(() => (bandAbove.value ? (groupOf as (row: unknown) => object) : (props.tableProps?.groupRowsBy as string | string[] | undefined)))
const bandScope = useId()
const bandId = (row: unknown): string => `qd-band-${bandScope}-${keyOf(row).replace(/[^\w-]/g, '_')}`
/** The row's class: the page's own (tableProps.rowClass), and banded or not */
type RowClass = string | object | undefined
const ownRowClass = computed(() => (typeof props.tableProps?.rowClass === 'function' ? (props.tableProps.rowClass as (r: unknown) => RowClass) : undefined))
function rowClassOf(row: unknown): RowClass {
  const own = ownRowClass.value?.(row)
  return banded(row) ? [own, 'qd-row-banded'] : own
}
/** A click in the band is a click on its row, unless it lands on a control of the band's own */
function onBandClick(row: unknown, event: MouseEvent): void {
  if ((event.target as HTMLElement | null)?.closest('a, button, input, select, textarea, label, [role="button"]')) return
  emit('row-click', row, event)
}
/** The band describes its row, for screen readers */
const tableEl = ref<{ $el?: HTMLElement } | null>(null)
function linkBands(): void {
  if (!hasBand.value) return
  const root = tableEl.value?.$el
  root?.querySelectorAll<HTMLElement>('tr.qd-row-banded').forEach((tr) => {
    const beside = (bandAbove.value ? tr.previousElementSibling : tr.nextElementSibling) as HTMLElement | null
    const id = beside?.querySelector<HTMLElement>('.qd-row-band')?.id
    if (id) tr.setAttribute('aria-describedby', id)
  })
}
onMounted(() => void nextTick(linkBands))
onUpdated(() => void nextTick(linkBands))

/**
 * Get filter CSS class based on value and default state
 * - No value (null/empty): no class
 * - Value = default: 'filter-default' (blue/info)
 * - Value ≠ default: 'filter-modified' (orange/warning)
 */
function getFilterClass(filter: FilterConfig): Record<string, boolean> {
  const value = localFilterValues.value[filter.name]
  const hasValue = value != null && value !== ''
  if (!hasValue) return {}

  const isDefault = props.isFilterAtDefault(filter.name)
  return {
    'filter-default': isDefault,
    'filter-modified': !isDefault
  }
}
</script>

<template>
  <div>
    <!-- Nav slot for PageNav (child routes) -->
    <slot name="nav" />

    <PageHeader :title="title" :subtitle="subtitle" :favorite="favorite ? { kind: 'list', entity } : null">
      <template #actions>
        <slot name="header-actions" ></slot>
        <QdSaveSearch v-if="searchLabel && saveSearchAt === 'header'" :default-name="searchLabel" :entity="entity" />
        <!-- Mobile: split button (primary action + dropdown) -->
        <template v-if="isMobile && headerActions.length > 0 && primaryHeaderAction">
          <!-- Single action: just a button -->
          <QdButton
            v-if="headerActions.length === 1"
            :label="resolveLabel(primaryHeaderAction.label)"
            :icon="primaryHeaderAction.icon"
            :severity="primaryHeaderAction.severity"
            :size="primaryHeaderAction.size || 'small'"
            :loading="primaryHeaderAction.isLoading"
            @click="primaryHeaderAction.onClick"
          />
          <!-- Multiple actions: split button -->
          <SplitButton
            v-else
            :label="resolveLabel(primaryHeaderAction.label)"
            :icon="primaryHeaderAction.icon"
            :severity="primaryHeaderAction.severity"
            :model="dropdownHeaderActions"
            size="small"
            @click="primaryHeaderAction.onClick"
          />
        </template>
        <!-- Desktop: individual buttons -->
        <template v-else>
          <QdButton
            v-for="action in headerActions"
            :key="action.name"
            :label="resolveLabel(action.label)"
            :icon="action.icon"
            :severity="action.severity"
            :size="action.size || 'small'"
            :loading="action.isLoading"
            @click="action.onClick"
          />
        </template>
      </template>
    </PageHeader>

    <!-- Cards Zone -->
    <CardsGrid :cards="cards" :columns="cardsColumns">
      <template v-for="(_, slotName) in $slots" :key="slotName" #[slotName]="slotProps">
        <slot :name="slotName" v-bind="slotProps" ></slot>
      </template>
    </CardsGrid>

    <!-- Before Table Slot -->
    <slot name="beforeTable" ></slot>

    <div class="card">
      <!-- Filter Bar -->
      <FilterBar
        :modelValue="searchQuery"
        @update:modelValue="onSearchChange"
        :placeholder="searchPlaceholder"
      >
        <template v-for="filter in filters" :key="filter.name">
          <!-- The app's own, or several values: under the filter contract (#5467) -->
          <component
            :is="contractComponent(filter)"
            v-if="contractComponent(filter)"
            :model-value="contractValue(filter)"
            :filter="filter"
            :options="filter.options ?? []"
            :loading="!!filter._optionsLoading"
            :at-default="isFilterAtDefault(filter.name)"
            :data-filter="filter.name"
            @update:model-value="onContractChange(filter, $event)"
          />
          <!-- Autocomplete filter -->
          <AutoComplete
            v-else-if="filter.type === 'autocomplete'"
            v-model="autocompleteSelected[filter.name]"
            :suggestions="autocompleteSuggestions[filter.name] || []"
            @complete="onAutocompleteSearch($event, filter)"
            @item-select="onAutocompleteSelect($event, filter)"
            @clear="onAutocompleteClear(filter)"
            :optionLabel="filter.optionLabel || 'label'"
            :placeholder="filter.placeholder"
            :dropdown="true"
            :minLength="0"
            :style="{ minWidth: filter.width || '160px' }"
            :class="getFilterClass(filter)"
            :inputClass="'filter-autocomplete-input'"
          />
          <!-- Standard select filter -->
          <Select
            v-else
            v-model="localFilterValues[filter.name]"
            @update:modelValue="onFilterChange(filter.name)"
            :options="filter.options"
            :optionLabel="filter.optionLabel || 'label'"
            :optionValue="filter.optionValue || 'value'"
            :placeholder="filter.placeholder"
            :style="{ minWidth: filter.width || '160px' }"
            :class="getFilterClass(filter)"
          >
            <!-- A choice's icon (#5578), in the list and in the field -->
            <template #option="{ option }">
              <span class="qd-multi-filter-option">
                <i v-if="option?.icon" :class="option.icon" class="qd-filter-icon" aria-hidden="true"></i>
                <span>{{ choiceLabel(filter, option) }}</span>
              </span>
            </template>
            <template #value="{ value, placeholder }">
              <span v-if="chosenChoice(filter, value)" class="qd-multi-filter-option">
                <i v-if="chosenChoice(filter, value)!.icon" :class="chosenChoice(filter, value)!.icon" class="qd-filter-icon" aria-hidden="true"></i>
                <span>{{ choiceLabel(filter, chosenChoice(filter, value)) }}</span>
              </span>
              <span v-else>{{ placeholder }}</span>
            </template>
          </Select>
        </template>
        <slot name="filters" ></slot>
        <!-- Clear and the bookmark stay together, inside the bar, at the end of its last line (#5432) -->
        <span v-if="hasActiveFilters || (searchLabel && saveSearchAt === 'filters') || refreshable" class="filter-bar-actions" data-filter-actions>
          <QdButton
            v-if="hasActiveFilters"
            icon="pi pi-filter-slash"
            severity="secondary"
            text
            rounded
            size="small"
            @click="clearAllFilters"
            v-tooltip.top="'Clear filters'"
          />
          <!-- The search's bookmark, beside what it saves (#5402) -->
          <QdSaveSearch v-if="searchLabel && saveSearchAt === 'filters'" :default-name="searchLabel" :entity="entity" />
          <!-- The rows read again past the cache, last (#5462) -->
          <QdButton
            v-if="refreshable"
            :icon="refreshing ? 'pi pi-refresh pi-spin' : 'pi pi-refresh'"
            severity="secondary"
            text
            rounded
            size="small"
            :disabled="refreshing"
            :aria-label="tOr('core.list.refresh', 'Refresh')"
            :aria-busy="refreshing ? 'true' : undefined"
            data-list-refresh
            @click="emit('refresh')"
            v-tooltip.top="tOr('core.list.refresh', 'Refresh')"
          />
        </span>
      </FilterBar>

      <!-- Data Table -->
      <DataTable
        :value="items"
        :loading="loading"
        :dataKey="dataKey"
        :paginator="paginator"
        :rows="rows"
        :rowsPerPageOptions="rowsPerPageOptions"
        :totalRecords="totalRecords"
        :first="first"
        :lazy="lazy"
        :sortField="sortField ?? undefined"
        :sortOrder="sortOrder"
        :selection="selected"
        @update:selection="onSelectionChange"
        @page="onPage"
        @sort="onSort"
        @row-click="onRowClick"
        :class="{ 'datatable-row-clickable': hasRowTapAction, 'qd-table-banded': hasBand, 'qd-table-banded-above': bandAbove }"
        stripedRows
        removableSort
        v-bind="tableProps"
        ref="tableEl"
        :expandedRows="hasBand && !bandAbove ? expandedRows : undefined"
        :rowClass="hasBand ? rowClassOf : ownRowClass"
        :rowGroupMode="tableRowGroupMode"
        :groupRowsBy="tableGroupRowsBy"
        :pt="tablePt"
      >
        <!-- The row's band, above its cells, across every column (#5451) -->
        <template v-if="bandAbove" #groupheader="{ data, index }">
          <div v-if="banded(data)" :id="bandId(data)" class="qd-row-band" data-row-band @click="onBandClick(data, $event)">
            <slot name="row-band" :data="data" :index="index"></slot>
          </div>
        </template>
        <!-- The row's band, under its cells, across every column (#5437) -->
        <template v-else-if="hasBand" #expansion="{ data, index }">
          <div :id="bandId(data)" class="qd-row-band" data-row-band @click="onBandClick(data, $event)">
            <slot name="row-band" :data="data" :index="index"></slot>
          </div>
        </template>
        <!-- The page's own columns, else the declared ones (addColumn / generateColumns, #4685) -->
        <slot name="columns">
          <Column v-for="col in declaredColumns" :key="col.field" :field="col.field" :header="col.header"
            :sortable="!!col.sortable" :style="col.style">
            <template #body="{ data }">
              <slot :name="`column-${col.field}`" :data="data" :value="(data as Record<string, unknown>)[col.field]">
                <template v-if="col.body">{{ col.body(data) }}</template>
                <SeverityTag v-else-if="col.display?.severity" :entity="col.display.entity" :field="col.field"
                  :value="((data as Record<string, unknown>)[col.field] as never)" />
                <ShowDisplay v-else :field="((col.display ?? { name: col.field }) as never)" :value="((data as Record<string, unknown>)[col.field] as never)" />
              </slot>
            </template>
          </Column>
        </slot>

        <!-- Actions column -->
        <Column v-if="getActions" :header="tOr('core.table.actions', 'Actions')" :style="{ width: actionsWidth }">
          <template #body="{ data }">
            <ActionButtons :actions="getActions(data)" />
          </template>
        </Column>

        <!-- Selection column -->
        <Column v-if="selectable" selectionMode="multiple" headerStyle="width: 3rem" />
      </DataTable>
    </div>
  </div>
</template>
