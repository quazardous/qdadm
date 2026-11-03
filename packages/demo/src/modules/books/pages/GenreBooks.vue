<script setup>
/**
 * GenreBooks - Books for a specific genre
 *
 * Child route of genre: /genres/:id/books
 * Parent filter auto-applied via route.meta.parent (genre = id)
 */
import { useListPage, ListPage, PageNav } from '@quazardous/qdadm'
import Column from 'primevue/column'

const list = useListPage({ entity: 'books' })

list.addEditAction()
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #nav>
      <PageNav showDetailsLink />
    </template>

    <template #columns>
      <Column v-bind="list.column('title', { header: 'Title' })" sortable />
      <Column v-bind="list.column('author', { header: 'Author' })" sortable />
      <Column v-bind="list.column('year', { header: 'Year' })" sortable style="width: 100px" />
    </template>

    <template #empty>
      <div class="text-center p-4 text-color-secondary">
        No books in this genre
      </div>
    </template>
  </ListPage>
</template>
