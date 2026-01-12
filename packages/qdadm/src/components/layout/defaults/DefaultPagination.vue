<script setup lang="ts">
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

interface PageEvent {
  first: number
  rows: number
  page: number
  pageCount?: number
}

interface Props {
  /** First record index (0-based) */
  first?: number
  /** Number of rows per page */
  rows?: number
  /** Total number of records */
  totalRecords?: number
  /** Options for rows per page dropdown */
  rowsPerPageOptions?: number[]
  /** Template for the paginator layout */
  template?: string
}

withDefaults(defineProps<Props>(), {
  first: 0,
  rows: 10,
  totalRecords: 0,
  rowsPerPageOptions: () => [10, 25, 50, 100],
  template: 'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown'
})

const emit = defineEmits<{
  page: [event: PageEvent]
}>()

function onPage(event: PageEvent): void {
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
