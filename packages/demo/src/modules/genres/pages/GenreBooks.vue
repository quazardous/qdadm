<script setup>
/**
 * GenreBooks - List of books for a specific genre
 *
 * Child route: /genres/:genreId/books
 * Filter is auto-applied via route.meta.parent config (genre = genreId)
 * PageNav shows: Genres > "Fiction" > Books (with Details | Books links)
 */

import { useListPageBuilder, ListPage, PageNav, useOrchestrator } from 'qdadm'
import Column from 'primevue/column'
import Tag from 'primevue/tag'

const { getManager } = useOrchestrator()
const booksManager = getManager('books')

// ============ LIST BUILDER ============
// Parent filter (genre) is auto-applied from route.meta.parent
const list = useListPageBuilder({ entity: 'books' })

// ============ SEARCH ============
list.setSearch({
  placeholder: 'Search books...',
  fields: ['title', 'author']
})

// ============ ROW ACTIONS ============
list.addEditAction()

// Helpers
function getGenreSeverity(genre) {
  return booksManager.getSeverity('genre', genre)
}
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #nav>
      <PageNav />
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

    <template #empty>
      <div class="text-center p-4 text-color-secondary">
        No books in this genre
      </div>
    </template>
  </ListPage>
</template>
