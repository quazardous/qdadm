<script setup lang="ts">
import { useListPage, ListPage } from '@quazardous/qdadm'
import Column from 'primevue/column'

const list = useListPage({ entity: 'books' })

list.setSearch({ placeholder: 'Search books...', fields: ['title', 'author'] })

list.addCreateAction('Add Book')
list.addEditAction()
list.addDeleteAction({ labelField: 'title' })
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column field="title" header="Title" sortable />
      <Column field="author" header="Author" sortable />
      <Column field="year" header="Year" sortable style="width: 100px" />
    </template>
  </ListPage>
</template>
