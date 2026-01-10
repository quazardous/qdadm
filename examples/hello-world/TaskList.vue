<script setup>
import { useListPage, ListPage } from 'qdadm'
import Column from 'primevue/column'

const list = useListPage({ entity: 'tasks' })
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column field="title" header="Title" sortable />
      <Column field="done" header="Done" style="width: 100px">
        <template #body="{ data }">
          {{ data.done ? '✓' : '○' }}
        </template>
      </Column>
    </template>
  </ListPage>
</template>
