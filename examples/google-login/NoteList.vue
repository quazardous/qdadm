<script setup>
/**
 * Nothing here knows about Google. Once the backend has issued a session, the
 * app is an ordinary qdadm app — which is the point of keeping identity out
 * of the pages.
 */
import { useListPage, ListPage } from '@quazardous/qdadm'
import Column from 'primevue/column'

const list = useListPage({ entity: 'notes' })
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column field="title" header="Title" sortable />
      <Column field="body" header="Body" />
    </template>
  </ListPage>
</template>
