<script setup>
/**
 * BookList - Book listing page
 *
 * Uses useListPageBuilder with simplified v-bind/v-on pattern
 * Genre filter uses SMART FILTER mode: optionsEntity
 *
 * ZONE EXTENSIBILITY DEMO
 * =======================
 * This page demonstrates cross-module zone extension:
 * - 'books-list-header' zone renders the page header area
 * - Loans module extends this zone to show loan statistics
 *
 * See: modules/loans/components/LoansZoneSetup.vue for extension code
 */

import { useListPageBuilder, ListPage, Zone } from 'qdadm'
import Tag from 'primevue/tag'
import Column from 'primevue/column'
import { useFavoriteAction } from '@/composables/useFavoriteAction'

// ============ LIST BUILDER ============
const list = useListPageBuilder({ entity: 'books' })

// ============ FAVORITE ACTION ============
useFavoriteAction(list, 'book', { labelField: 'title' })

// ============ SEARCH ============
list.setSearch({
  placeholder: 'Search books...',
  fields: ['title', 'author']
})

// ============ FILTERS ============
// Smart filter: options loaded automatically from 'genres' entity
list.addFilter('genre', {
  placeholder: 'All Genres',
  optionsEntity: 'genres',      // Fetch from genres EntityManager
  optionLabel: 'name',          // Use 'name' field as label
  optionValue: 'id'             // Use 'id' field as value
})


// ============ HEADER ACTIONS ============
list.addCreateAction('Add Book')
list.addBulkDeleteAction()

// ============ ROW ACTIONS ============
list.addEditAction()
list.addDeleteAction({ labelField: 'title' })

// ============ HELPERS ============
function getGenreSeverity(genre) {
  const map = {
    'fiction': 'info',
    'non-fiction': 'secondary',
    'sci-fi': 'primary',
    'fantasy': 'warn',
    'mystery': 'danger'
  }
  return map[genre] || 'secondary'
}
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <!-- Zone-based extensible header area -->
    <template #beforeTable>
      <Zone name="books-list-header" class="mb-3" />
    </template>

    <template #columns>
      <Column field="title" header="Title" sortable />
      <Column field="author" header="Author" sortable />
      <Column field="year" header="Year" sortable style="width: 100px" />
      <Column field="genre" header="Genre" style="width: 120px">
        <template #body="{ data }">
          <Tag :value="data.genre" :severity="getGenreSeverity(data.genre)" />
        </template>
      </Column>
    </template>
  </ListPage>
</template>
