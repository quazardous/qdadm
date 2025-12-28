<script setup>
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
import { computed, useSlots } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const props = defineProps({
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
  /**
   * Current selection (for selectable tables)
   */
  selection: {
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
    type: String,
    default: null
  },
  /**
   * Current sort order (1 = asc, -1 = desc)
   */
  sortOrder: {
    type: Number,
    default: 1
  }
})

const emit = defineEmits(['update:selection', 'sort'])

const slots = useSlots()
const hasDefaultSlot = computed(() => !!slots.default)

function onSelectionChange(value) {
  emit('update:selection', value)
}

function onSort(event) {
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
