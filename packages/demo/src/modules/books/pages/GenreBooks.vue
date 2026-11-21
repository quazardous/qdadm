<script setup>
/**
 * GenreBooks - Books for a specific genre
 *
 * Child route of genre: /genres/:id/books
 * Parent filter auto-applied via route.meta.parent (genre = id)
 */
import { useRoute } from 'vue-router'
import { useListPage, ListPage, PageNav } from '@quazardous/qdadm'
import Column from 'primevue/column'

// A session memory per genre page (#5440): its sort is not the books list's
const route = useRoute()
const list = useListPage({ entity: 'books', sessionKey: `books:genre:${route.params.id}` })

list.addEditAction()
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #nav>
      <PageNav showDetailsLink />
    </template>

    <template #columns>
      <Column v-bind="list.column('title')" sortable />
      <Column v-bind="list.column('author')" sortable />
      <Column v-bind="list.column('year')" sortable style="width: 100px" />
    </template>

    <template #empty>
      <div class="text-center p-4 text-color-secondary">
        No books in this genre
      </div>
    </template>
  </ListPage>
</template>
