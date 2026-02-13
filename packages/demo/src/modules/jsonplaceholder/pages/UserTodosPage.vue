<script setup>
/**
 * UserTodosPage - Todos for a specific JP user
 *
 * Child route of jp_user: /jp-users/:id/todos
 * Parent filter auto-applied via route.meta.parent (userId = id)
 */
import { useListPage, ListPage, PageNav, BoolCell } from 'qdadm'
import Column from 'primevue/column'

const list = useListPage({ entity: 'todos' })

function truncateTitle(title, maxLength = 80) {
  if (!title) return ''
  return title.length > maxLength ? title.slice(0, maxLength) + '...' : title
}
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #nav>
      <PageNav />
    </template>

    <template #columns>
      <Column field="id" header="ID" sortable style="width: 60px" />
      <Column field="title" header="Title" sortable>
        <template #body="{ data }">
          {{ truncateTitle(data.title) }}
        </template>
      </Column>
      <Column field="completed" header="Done" sortable style="width: 80px">
        <template #body="{ data }">
          <BoolCell :value="data.completed" />
        </template>
      </Column>
    </template>

    <template #empty>
      <div class="text-center p-4 text-color-secondary">
        No todos for this user
      </div>
    </template>
  </ListPage>
</template>
