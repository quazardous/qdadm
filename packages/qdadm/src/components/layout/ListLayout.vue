<script setup lang="ts">
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
import { computed, useSlots, provide, type ComputedRef } from 'vue'
import BaseLayout from './BaseLayout.vue'
import Zone from './Zone.vue'
import { LIST_ZONES } from '../../zones/zones'

// Default components for list zones
import DefaultTable from './defaults/DefaultTable.vue'
import DefaultPagination from './defaults/DefaultPagination.vue'
import FilterBar from '../lists/FilterBar.vue'

interface PageEvent {
  first: number
  rows: number
  page: number
  pageCount: number
}

interface SortEvent {
  sortField: string | ((item: unknown) => string) | undefined
  sortOrder: 1 | -1 | 0 | undefined | null
}

interface TableProps {
  items: unknown[]
  loading: boolean
  dataKey: string
  selection: unknown[] | undefined
  selectable: boolean
  sortField?: string
  sortOrder: 1 | -1
}

interface PaginationProps {
  first: number
  rows: number
  totalRecords: number
  rowsPerPageOptions: number[]
}

interface ListContext {
  items: ComputedRef<unknown[]>
  loading: ComputedRef<boolean>
  selected: ComputedRef<unknown[] | undefined>
  selectable: ComputedRef<boolean>
}

interface Props {
  // Table data
  /** Data items to display in the table */
  items?: unknown[]
  /** Loading state */
  loading?: boolean
  /** Field to use as unique key for rows */
  dataKey?: string
  // Selection
  /** Current selection (v-model compatible) */
  selected?: unknown[]
  /** Enable row selection */
  selectable?: boolean
  // Sorting
  /** Current sort field */
  sortField?: string
  /** Current sort order (1 = asc, -1 = desc) */
  sortOrder?: 1 | -1
  // Pagination
  /** Enable pagination (in table or separate) */
  paginator?: boolean
  /** Use separate pagination zone (outside table) */
  separatePagination?: boolean
  /** Number of rows per page */
  rows?: number
  /** Options for rows per page dropdown */
  rowsPerPageOptions?: number[]
  /** Total number of records (for lazy/server-side pagination) */
  totalRecords?: number
  /** First record index (for lazy pagination) */
  first?: number
  /** Enable lazy (server-side) loading */
  lazy?: boolean
  // Search/Filter
  /** Current search query (v-model compatible) */
  searchQuery?: string
  /** Search input placeholder */
  searchPlaceholder?: string
  /** Show filter bar zone */
  showFilterBar?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  loading: false,
  dataKey: 'id',
  selected: undefined,
  selectable: false,
  sortField: undefined,
  sortOrder: 1,
  paginator: true,
  separatePagination: false,
  rows: 10,
  rowsPerPageOptions: () => [10, 25, 50, 100],
  totalRecords: 0,
  first: 0,
  lazy: false,
  searchQuery: '',
  searchPlaceholder: 'Search...',
  showFilterBar: true
})

const emit = defineEmits<{
  'update:selected': [value: unknown[]]
  'update:searchQuery': [value: string]
  'page': [event: PageEvent]
  'sort': [event: SortEvent]
}>()

const slots = useSlots()

// Check for specific slot content
const hasColumnsSlot = computed((): boolean => !!slots.columns)
const hasBeforeTableSlot = computed((): boolean => !!slots['before-table'])
const hasAfterTableSlot = computed((): boolean => !!slots['after-table'])
const hasPaginationSlot = computed((): boolean => !!slots.pagination)

// Provide list context to child components (for deep customization)
provide<ListContext>('qdadmListContext', {
  items: computed(() => props.items),
  loading: computed(() => props.loading),
  selected: computed(() => props.selected),
  selectable: computed(() => props.selectable)
})

// Props bundle for table zone
const tableProps = computed((): TableProps => ({
  items: props.items,
  loading: props.loading,
  dataKey: props.dataKey,
  selection: props.selected,
  selectable: props.selectable,
  sortField: props.sortField,
  sortOrder: props.sortOrder
}))

// Props bundle for pagination zone
const paginationProps = computed((): PaginationProps => ({
  first: props.first,
  rows: props.rows,
  totalRecords: props.totalRecords,
  rowsPerPageOptions: props.rowsPerPageOptions
}))

// Event handlers
function onSelectionChange(value: unknown[]): void {
  emit('update:selected', value)
}

function onSearchChange(value: string): void {
  emit('update:searchQuery', value)
}

function onPage(event: PageEvent): void {
  emit('page', event)
}

function onSort(event: SortEvent): void {
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
          :default-component="hasColumnsSlot ? undefined : DefaultTable"
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
/*
 * Only keep styles here that REQUIRE scoping (:deep, dynamic binding, component-specific overrides).
 * Generic/reusable styles belong in src/styles/ partials (see _forms.scss, _cards.scss, etc.).
 */
.list-layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
