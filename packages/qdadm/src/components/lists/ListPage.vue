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
import { computed, ref, watch, onMounted, onUnmounted, type PropType } from 'vue'
import PageHeader from '../layout/PageHeader.vue'
import CardsGrid from '../display/CardsGrid.vue'
import FilterBar from './FilterBar.vue'
import ActionButtons from './ActionButtons.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import AutoComplete from 'primevue/autocomplete'
import SplitButton from 'primevue/splitbutton'
import type { FilterConfig, CardConfig, ResolvedAction, ResolvedHeaderAction as BaseResolvedHeaderAction } from '../../composables/useListPage'

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
 * Extended header action with optional size property used in template
 */
interface ResolvedHeaderAction extends BaseResolvedHeaderAction {
  size?: string
}

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

  // Cards
  cards: { type: Array as PropType<CardConfig[]>, default: () => [] },
  cardsColumns: { type: [Number, String] as PropType<number | 'auto'>, default: 'auto' },

  // Table data
  items: { type: Array as PropType<unknown[]>, required: true },
  loading: { type: Boolean, default: false },
  dataKey: { type: String, default: 'id' },

  // Selection
  selected: { type: Array as PropType<unknown[]>, default: () => [] },
  selectable: { type: Boolean, default: false },

  // Pagination
  paginator: { type: Boolean, default: true },
  rows: { type: Number, default: 10 },
  rowsPerPageOptions: { type: Array as PropType<number[]>, default: () => [10, 50, 100] },
  totalRecords: { type: Number, default: 0 },
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

  // Row Actions
  getActions: { type: Function as unknown as PropType<((row: unknown) => ResolvedAction[]) | null>, default: null },
  actionsWidth: { type: String, default: '120px' },

  // Mobile row tap
  hasRowTapAction: { type: Boolean, default: false }
})

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

// Check if any filter or search has a non-null value
const hasActiveFilters = computed(() => {
  const hasFilters = Object.values(props.filterValues).some((v: unknown) => v !== null && v !== undefined && v !== '')
  const hasSearch = props.searchQuery && props.searchQuery.trim() !== ''
  return hasFilters || hasSearch
})

const emit = defineEmits<{
  (e: 'update:selected', value: unknown[]): void
  (e: 'update:searchQuery', value: string): void
  (e: 'update:filterValues', values: Record<string, unknown>): void
  (e: 'page', event: { page: number; rows: number }): void
  (e: 'sort', event: { sortField: string; sortOrder: number }): void
  (e: 'row-click', data: unknown, originalEvent: MouseEvent): void
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
  const cleared: Record<string, null> = {}
  for (const key of Object.keys(localFilterValues.value)) {
    cleared[key] = null
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
  emit('sort', { sortField: String(e.sortField ?? ''), sortOrder: e.sortOrder ?? 1 })
}

function onRowClick(event: { data: unknown; originalEvent: Event }): void {
  // event.data = row data, event.originalEvent = Event
  emit('row-click', event.data, event.originalEvent as MouseEvent)
}
</script>

<template>
  <div>
    <!-- Nav slot for PageNav (child routes) -->
    <slot name="nav" />

    <PageHeader :title="title" :subtitle="subtitle">
      <template #actions>
        <slot name="header-actions" ></slot>
        <!-- Mobile: split button (primary action + dropdown) -->
        <template v-if="isMobile && headerActions.length > 0 && primaryHeaderAction">
          <!-- Single action: just a button -->
          <Button
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
          <Button
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
          <!-- Autocomplete filter -->
          <AutoComplete
            v-if="filter.type === 'autocomplete'"
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
            :class="{ 'filter-active': localFilterValues[filter.name] != null && localFilterValues[filter.name] !== '' }"
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
            :class="{ 'filter-active': localFilterValues[filter.name] != null && localFilterValues[filter.name] !== '' }"
          />
        </template>
        <slot name="filters" ></slot>
        <Button
          v-if="hasActiveFilters"
          icon="pi pi-filter-slash"
          severity="secondary"
          text
          rounded
          size="small"
          @click="clearAllFilters"
          v-tooltip.top="'Clear filters'"
        />
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
        :lazy="lazy"
        :sortField="sortField ?? undefined"
        :sortOrder="sortOrder"
        :selection="selected"
        @update:selection="onSelectionChange"
        @page="onPage"
        @sort="onSort"
        @row-click="onRowClick"
        :class="{ 'datatable-row-clickable': hasRowTapAction }"
        stripedRows
        removableSort
      >
        <!-- Columns from slot -->
        <slot name="columns" ></slot>

        <!-- Actions column -->
        <Column v-if="getActions" header="Actions" :style="{ width: actionsWidth }">
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
