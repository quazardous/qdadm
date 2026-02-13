<script setup>
/**
 * GenreList - List of book genres
 *
 * Parent page for genre → books child route.
 */
import { useListPage, ListPage, SeverityTag } from 'qdadm'
import Column from 'primevue/column'

const list = useListPage({ entity: 'genres' })

list.addEditAction()
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column field="name" header="Genre" sortable>
        <template #body="{ data }">
          <SeverityTag field="id" :value="data.id" entity="genres" />
        </template>
      </Column>
      <Column field="description" header="Description" sortable />
    </template>
  </ListPage>
</template>
