<script setup>
/**
 * DefaultPagination - Default pagination component for ListLayout
 *
 * Renders a PrimeVue Paginator with standard configuration.
 * Used as the default for the "pagination" zone in ListLayout.
 *
 * When `lazy` is false and pagination is handled by DataTable,
 * this component is typically not shown (DataTable has its own paginator).
 *
 * This is useful for:
 * - Separate pagination controls outside the table
 * - Custom pagination layouts
 * - Server-side (lazy) pagination with separate paginator
 */
import Paginator from 'primevue/paginator'

const props = defineProps({
  /**
   * First record index (0-based)
   */
  first: {
    type: Number,
    default: 0
  },
  /**
   * Number of rows per page
   */
  rows: {
    type: Number,
    default: 10
  },
  /**
   * Total number of records
   */
  totalRecords: {
    type: Number,
    default: 0
  },
  /**
   * Options for rows per page dropdown
   */
  rowsPerPageOptions: {
    type: Array,
    default: () => [10, 25, 50, 100]
  },
  /**
   * Template for the paginator layout
   */
  template: {
    type: String,
    default: 'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown'
  }
})

const emit = defineEmits(['page'])

function onPage(event) {
  emit('page', event)
}
</script>

<template>
  <Paginator
    :first="first"
    :rows="rows"
    :totalRecords="totalRecords"
    :rowsPerPageOptions="rowsPerPageOptions"
    :template="template"
    @page="onPage"
    class="default-pagination"
  />
</template>

<style scoped>
.default-pagination {
  margin-top: 1rem;
}
</style>
