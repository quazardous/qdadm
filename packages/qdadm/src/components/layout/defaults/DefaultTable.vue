<script setup lang="ts">
/**
 * DefaultTable - Default table component for ListLayout
 *
 * Renders a PrimeVue DataTable with standard configuration.
 * Used as the default for the "table" zone in ListLayout.
 *
 * Accepts props from the list page builder for data binding.
 * Supports slots for column definitions.
 *
 * This is a minimal wrapper that expects:
 * - items: Array of data to display
 * - loading: Boolean loading state
 * - Columns via default slot
 */
import { computed, useSlots, type PropType } from 'vue'
import DataTable, { type DataTableSortEvent } from 'primevue/datatable'
import Column from 'primevue/column'

defineProps({
  /**
   * Data items to display in the table
   */
  items: {
    type: Array as PropType<unknown[]>,
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
  /**
   * Current selection (for selectable tables)
   */
  selection: {
    type: Array as PropType<unknown[] | undefined>,
    default: undefined
  },
  /**
   * Enable row selection
   */
  selectable: {
    type: Boolean,
    default: false
  },
  /**
   * Enable striped rows
   */
  stripedRows: {
    type: Boolean,
    default: true
  },
  /**
   * Enable removable sort
   */
  removableSort: {
    type: Boolean,
    default: true
  },
  /**
   * Current sort field
   */
  sortField: {
    type: String as PropType<string | undefined>,
    default: undefined
  },
  /**
   * Current sort order (1 = asc, -1 = desc)
   */
  sortOrder: {
    type: Number as PropType<1 | -1>,
    default: 1
  }
})

const emit = defineEmits<{
  'update:selection': [value: unknown[]]
  'sort': [event: DataTableSortEvent]
}>()

const slots = useSlots()
const hasDefaultSlot = computed<boolean>(() => !!slots.default)

function onSelectionChange(value: unknown[]): void {
  emit('update:selection', value)
}

function onSort(event: DataTableSortEvent): void {
  emit('sort', event)
}
</script>

<template>
  <DataTable
    :value="items"
    :loading="loading"
    :dataKey="dataKey"
    :selection="selection"
    :sortField="sortField"
    :sortOrder="sortOrder"
    :stripedRows="stripedRows"
    :removableSort="removableSort"
    @update:selection="onSelectionChange"
    @sort="onSort"
    class="default-table"
  >
    <!-- Columns from slot -->
    <slot />

    <!-- Selection column if selectable -->
    <Column
      v-if="selectable && !hasDefaultSlot"
      selectionMode="multiple"
      headerStyle="width: 3rem"
    />
  </DataTable>
</template>

<style scoped>
.default-table {
  width: 100%;
}
</style>
