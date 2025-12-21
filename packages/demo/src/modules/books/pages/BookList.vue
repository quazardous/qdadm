<script setup>
/**
 * BookList - Book listing page
 *
 * Uses useListPageBuilder with simplified v-bind/v-on pattern
 */

import { useListPageBuilder, ListPage } from 'qdadm'
import Tag from 'primevue/tag'
import Column from 'primevue/column'

// ============ LIST BUILDER ============
const list = useListPageBuilder({ entity: 'books' })

// ============ SEARCH ============
list.setSearch({
  placeholder: 'Search books...',
  fields: ['title', 'author']
})

// ============ FILTERS ============
list.addFilter('genre', {
  placeholder: 'All Genres',
  options: [
    { label: 'All', value: null },
    { label: 'Fiction', value: 'fiction' },
    { label: 'Non-Fiction', value: 'non-fiction' },
    { label: 'Science Fiction', value: 'sci-fi' },
    { label: 'Fantasy', value: 'fantasy' },
    { label: 'Mystery', value: 'mystery' }
  ]
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
