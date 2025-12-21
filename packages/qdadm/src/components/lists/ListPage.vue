<script setup>
/**
 * ListPage - Unified list page component
 *
 * Renders a complete CRUD list page with:
 * - PageHeader with title and create button
 * - CardsGrid for stats/custom cards
 * - FilterBar with search and custom filters
 * - DataTable with actions column
 *
 * Props come from useListPageBuilder composable
 *
 * Filter types:
 * - 'select' (default): Standard dropdown
 * - 'autocomplete': Searchable dropdown with type-ahead
 */
import { computed, ref, watch } from 'vue'
import PageHeader from '../layout/PageHeader.vue'
import CardsGrid from '../display/CardsGrid.vue'
import FilterBar from './FilterBar.vue'
import ActionButtons from './ActionButtons.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import AutoComplete from 'primevue/autocomplete'

const props = defineProps({
  // Header
  title: { type: String, required: true },
  subtitle: { type: String, default: null },
  headerActions: { type: Array, default: () => [] },

  // Cards
  cards: { type: Array, default: () => [] },
  cardsColumns: { type: [Number, String], default: 'auto' },

  // Table data
  items: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  dataKey: { type: String, default: 'id' },

  // Selection
  selected: { type: Array, default: () => [] },
  selectable: { type: Boolean, default: false },

  // Pagination
  paginator: { type: Boolean, default: true },
  rows: { type: Number, default: 10 },
  rowsPerPageOptions: { type: Array, default: () => [10, 50, 100] },
  totalRecords: { type: Number, default: 0 },
  lazy: { type: Boolean, default: false },

  // Sorting
  sortField: { type: String, default: null },
  sortOrder: { type: Number, default: 1 },

  // Search
  searchQuery: { type: String, default: '' },
  searchPlaceholder: { type: String, default: 'Search...' },

  // Filters
  filters: { type: Array, default: () => [] },
  filterValues: { type: Object, default: () => ({}) },

  // Row Actions
  getActions: { type: Function, default: null },
  actionsWidth: { type: String, default: '120px' }
})

function resolveLabel(label, _action) {
  return typeof label === 'function' ? label({ selectionCount: props.selected?.length || 0 }) : label
}

// Local copy of filterValues for proper v-model binding
// PrimeVue Select needs v-model to fire change events reliably
const localFilterValues = ref({})

// Autocomplete suggestions per filter (keyed by filter name)
const autocompleteSuggestions = ref({})

// For autocomplete filters, we store the selected option object (not just value)
// to display the label properly. This maps filter.name -> selected option object
const autocompleteSelected = ref({})

// Sync from prop to local (when parent updates)
watch(() => props.filterValues, (newVal) => {
  localFilterValues.value = { ...newVal }
  // Sync autocomplete selections - find matching option by value
  for (const filter of props.filters) {
    if (filter.type === 'autocomplete' && newVal[filter.name] != null) {
      const option = filter.options?.find(opt =>
        (opt.value ?? opt) === newVal[filter.name]
      )
      if (option) {
        autocompleteSelected.value[filter.name] = option
      }
    } else if (filter.type === 'autocomplete' && newVal[filter.name] == null) {
      autocompleteSelected.value[filter.name] = null
    }
  }
}, { immediate: true, deep: true })

// Check if any filter or search has a non-null value
const hasActiveFilters = computed(() => {
  const hasFilters = Object.values(props.filterValues).some(v => v !== null && v !== undefined && v !== '')
  const hasSearch = props.searchQuery && props.searchQuery.trim() !== ''
  return hasFilters || hasSearch
})

const emit = defineEmits([
  'update:selected',
  'update:searchQuery',
  'update:filterValues',
  'page',
  'sort'
])

function clearAllFilters() {
  // Build empty filter values object
  const cleared = {}
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

function onSelectionChange(value) {
  emit('update:selected', value)
}

function onSearchChange(value) {
  emit('update:searchQuery', value)
}

function onFilterChange(_name) {
  emit('update:filterValues', { ...localFilterValues.value })
}

/**
 * Handle autocomplete search/filter
 * @param {Object} event - PrimeVue autocomplete event with query property
 * @param {Object} filter - Filter definition from props.filters
 */
function onAutocompleteSearch(event, filter) {
  const query = (event.query || '').toLowerCase()
  const labelField = filter.optionLabel || 'label'

  if (!query) {
    // Show all options when query is empty
    autocompleteSuggestions.value[filter.name] = [...(filter.options || [])]
  } else {
    // Filter options by label
    autocompleteSuggestions.value[filter.name] = (filter.options || []).filter(opt => {
      const label = typeof opt === 'string' ? opt : (opt[labelField] || '')
      return label.toLowerCase().includes(query)
    })
  }
}

/**
 * Handle autocomplete selection
 * @param {Object} event - PrimeVue event with value property (selected option)
 * @param {Object} filter - Filter definition
 */
function onAutocompleteSelect(event, filter) {
  const selected = event.value
  const valueField = filter.optionValue || 'value'

  // Store the selected option for display
  autocompleteSelected.value[filter.name] = selected

  // Extract the actual value to send to API
  const value = selected != null
    ? (typeof selected === 'string' ? selected : selected[valueField])
    : null

  localFilterValues.value[filter.name] = value
  emit('update:filterValues', { ...localFilterValues.value })
}

/**
 * Handle autocomplete clear (user clears the input)
 */
function onAutocompleteClear(filter) {
  autocompleteSelected.value[filter.name] = null
  localFilterValues.value[filter.name] = null
  emit('update:filterValues', { ...localFilterValues.value })
}

function onPage(event) {
  emit('page', event)
}

function onSort(event) {
  emit('sort', event)
}
</script>

<template>
  <div>
    <!-- Nav slot for PageNav (child routes) -->
    <slot name="nav" />

    <PageHeader :title="title" :subtitle="subtitle">
      <template #actions>
        <slot name="header-actions" ></slot>
        <Button
          v-for="action in headerActions"
          :key="action.name"
          :label="resolveLabel(action.label)"
          :icon="action.icon"
          :severity="action.severity"
          :loading="action.isLoading"
          @click="action.onClick"
        />
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
        :sortField="sortField"
        :sortOrder="sortOrder"
        :selection="selected"
        @update:selection="onSelectionChange"
        @page="onPage"
        @sort="onSort"
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
