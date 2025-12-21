<script setup>
/**
 * GenreList - List of all genres with link to child books
 */

import { useListPageBuilder, ListPage } from 'qdadm'
import Column from 'primevue/column'
import Button from 'primevue/button'
import { useRouter } from 'vue-router'

const router = useRouter()

// ============ LIST BUILDER ============
const list = useListPageBuilder({ entity: 'genres' })

// ============ SEARCH ============
list.setSearch({
  placeholder: 'Search genres...',
  fields: ['name', 'description']
})

// ============ ROW ACTIONS ============
list.addEditAction()

// Navigate to genre books
function viewBooks(genre) {
  router.push({ name: 'genre-books', params: { genreId: genre.id } })
}
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column field="name" header="Name" sortable />
      <Column field="description" header="Description" />
      <Column header="Books" style="width: 120px">
        <template #body="{ data }">
          <Button
            label="View Books"
            icon="pi pi-book"
            size="small"
            severity="secondary"
            text
            @click="viewBooks(data)"
          />
        </template>
      </Column>
    </template>
  </ListPage>
</template>
