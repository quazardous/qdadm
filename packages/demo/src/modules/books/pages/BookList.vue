<script setup>
/**
 * BookList - Book listing page
 *
 * Uses useListPageBuilder with simplified v-bind/v-on pattern
 * Genre filter options are loaded dynamically from genres entity
 */

import { onMounted } from 'vue'
import { useListPageBuilder, ListPage, useOrchestrator } from 'qdadm'
import Tag from 'primevue/tag'
import Column from 'primevue/column'

const { getManager } = useOrchestrator()
const genresManager = getManager('genres')

// ============ LIST BUILDER ============
const list = useListPageBuilder({ entity: 'books' })

// ============ SEARCH ============
list.setSearch({
  placeholder: 'Search books...',
  fields: ['title', 'author']
})

// ============ FILTERS ============
// Start with placeholder, options loaded on mount
list.addFilter('genre', {
  placeholder: 'All Genres',
  options: [{ label: 'All', value: null }]
})

// Load genre options from entity manager
onMounted(async () => {
  const { items } = await genresManager.list({ page_size: 100 })
  const options = [
    { label: 'All', value: null },
    ...items.map(g => ({ label: g.name, value: g.id }))
  ]
  // Update filter options
  list.removeFilter('genre')
  list.addFilter('genre', {
    placeholder: 'All Genres',
    options
  })
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
