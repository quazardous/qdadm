<script setup>
/**
 * ListLayout - Second level of 3-level layout inheritance for list pages
 *
 * Extends BaseLayout by providing content to the "main" zone and
 * defining list-specific zones within:
 * - before-table: Filter bar, search, bulk actions
 * - table: DataTable component
 * - after-table: Summary, additional actions
 * - pagination: Paginator controls
 *
 * Inheritance pattern (Twig-style):
 *   BaseLayout (root)
 *     -> ListLayout (fills main zone, defines list zones)
 *       -> EntityListPage (fills list-specific slots)
 *
 * Usage:
 * <ListLayout :items="data" :loading="isLoading">
 *   <template #columns>
 *     <Column field="name" header="Name" />
 *   </template>
 * </ListLayout>
 *
 * Zone customization via ZoneRegistry:
 * ```js
 * registry.registerBlock(LIST_ZONES.BEFORE_TABLE, {
 *   component: CustomFilterBar,
 *   id: 'custom-filter'
 * })
 * ```
 */
import { computed, useSlots, provide } from 'vue'
import BaseLayout from './BaseLayout.vue'
import Zone from './Zone.vue'
import { LIST_ZONES } from '../../zones/zones'

// Default components for list zones
import DefaultTable from './defaults/DefaultTable.vue'
import DefaultPagination from './defaults/DefaultPagination.vue'
import FilterBar from '../lists/FilterBar.vue'

const props = defineProps({
  // ============================================================================
  // Table data
  // ============================================================================

  /**
   * Data items to display in the table
   */
  items: {
    type: Array,
    default: () => []
  },

  /**
   * Loading state
   */
  loading: {
    type: Boolean,
    default: false
  },

  /**
   * Field to use as unique key for rows
   */
  dataKey: {
    type: String,
    default: 'id'
  },

  // ============================================================================
  // Selection
  // ============================================================================

  /**
   * Current selection (v-model compatible)
   */
  selected: {
    type: Array,
    default: undefined
  },

  /**
   * Enable row selection
   */
  selectable: {
    type: Boolean,
    default: false
  },

  // ============================================================================
  // Sorting
  // ============================================================================

  /**
   * Current sort field
   */
  sortField: {
    type: String,
    default: null
  },

  /**
   * Current sort order (1 = asc, -1 = desc)
   */
  sortOrder: {
    type: Number,
    default: 1
  },

  // ============================================================================
  // Pagination
  // ============================================================================

  /**
   * Enable pagination (in table or separate)
   */
  paginator: {
    type: Boolean,
    default: true
  },

  /**
   * Use separate pagination zone (outside table)
   */
  separatePagination: {
    type: Boolean,
    default: false
  },

  /**
   * Number of rows per page
   */
  rows: {
    type: Number,
    default: 10
  },

  /**
   * Options for rows per page dropdown
   */
  rowsPerPageOptions: {
    type: Array,
    default: () => [10, 25, 50, 100]
  },

  /**
   * Total number of records (for lazy/server-side pagination)
   */
  totalRecords: {
    type: Number,
    default: 0
  },

  /**
   * First record index (for lazy pagination)
   */
  first: {
    type: Number,
    default: 0
  },

  /**
   * Enable lazy (server-side) loading
   */
  lazy: {
    type: Boolean,
    default: false
  },

  // ============================================================================
  // Search/Filter
  // ============================================================================

  /**
   * Current search query (v-model compatible)
   */
  searchQuery: {
    type: String,
    default: ''
  },

  /**
   * Search input placeholder
   */
  searchPlaceholder: {
    type: String,
    default: 'Search...'
  },

  /**
   * Show filter bar zone
   */
  showFilterBar: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits([
  'update:selected',
  'update:searchQuery',
  'page',
  'sort'
])

const slots = useSlots()

// Check for specific slot content
const hasColumnsSlot = computed(() => !!slots.columns)
const hasBeforeTableSlot = computed(() => !!slots['before-table'])
const hasAfterTableSlot = computed(() => !!slots['after-table'])
const hasPaginationSlot = computed(() => !!slots.pagination)

// Provide list context to child components (for deep customization)
provide('qdadmListContext', {
  items: computed(() => props.items),
  loading: computed(() => props.loading),
  selected: computed(() => props.selected),
  selectable: computed(() => props.selectable)
})

// Props bundle for table zone
const tableProps = computed(() => ({
  items: props.items,
  loading: props.loading,
  dataKey: props.dataKey,
  selection: props.selected,
  selectable: props.selectable,
  sortField: props.sortField,
  sortOrder: props.sortOrder
}))

// Props bundle for pagination zone
const paginationProps = computed(() => ({
  first: props.first,
  rows: props.rows,
  totalRecords: props.totalRecords,
  rowsPerPageOptions: props.rowsPerPageOptions
}))

// Event handlers
function onSelectionChange(value) {
  emit('update:selected', value)
}

function onSearchChange(value) {
  emit('update:searchQuery', value)
}

function onPage(event) {
  emit('page', event)
}

function onSort(event) {
  emit('sort', event)
}
</script>

<template>
  <BaseLayout>
    <template #main>
      <div class="list-layout">
        <!-- Before-table zone: Filter bar, search, bulk actions -->
        <Zone
          v-if="showFilterBar"
          :name="LIST_ZONES.BEFORE_TABLE"
          :default-component="FilterBar"
          :block-props="{
            modelValue: searchQuery,
            placeholder: searchPlaceholder,
            'onUpdate:modelValue': onSearchChange
          }"
        >
          <!-- Slot fallback if no blocks and no default -->
          <template v-if="hasBeforeTableSlot">
            <slot name="before-table" />
          </template>
        </Zone>

        <!-- Table zone: DataTable -->
        <!-- When columns slot is provided, we don't set default-component so slot content renders -->
        <Zone
          :name="LIST_ZONES.TABLE"
          :default-component="hasColumnsSlot ? null : DefaultTable"
          :block-props="{
            ...tableProps,
            'onUpdate:selection': onSelectionChange,
            onSort: onSort
          }"
        >
          <!-- Render DefaultTable with columns slot when slot is provided -->
          <DefaultTable
            v-bind="tableProps"
            @update:selection="onSelectionChange"
            @sort="onSort"
          >
            <slot name="columns" />
          </DefaultTable>
        </Zone>

        <!-- After-table zone: Summary, additional actions -->
        <Zone :name="LIST_ZONES.AFTER_TABLE">
          <template v-if="hasAfterTableSlot">
            <slot name="after-table" />
          </template>
        </Zone>

        <!-- Pagination zone: Paginator (when separate from table) -->
        <Zone
          v-if="paginator && separatePagination"
          :name="LIST_ZONES.PAGINATION"
          :default-component="DefaultPagination"
          :block-props="{
            ...paginationProps,
            onPage: onPage
          }"
        >
          <template v-if="hasPaginationSlot">
            <slot name="pagination" />
          </template>
        </Zone>
      </div>
    </template>
  </BaseLayout>
</template>

<style scoped>
.list-layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
