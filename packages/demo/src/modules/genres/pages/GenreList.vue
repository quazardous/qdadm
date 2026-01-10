<script setup>
/**
 * GenreList - Simplest qdadm pattern demo
 *
 * Pattern: ~10 lines for reference/lookup data
 * - Entity config via useListPage
 * - Search + edit action via builder methods
 * - Columns via #columns slot (pure declarative)
 */
import { useListPage, ListPage } from 'qdadm'
import Column from 'primevue/column'

const list = useListPage({ entity: 'genres' })
list.setSearch({ placeholder: 'Search genres...', fields: ['name', 'description'] })
list.addCreateAction()
list.addEditAction()
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column field="name" header="Name" sortable />
      <Column field="description" header="Description" />
    </template>
  </ListPage>
</template>
