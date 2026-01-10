<script setup>
/**
 * TodosPage - Todo listing page from JSONPlaceholder
 *
 * Features:
 * - Completion toggle checkbox in list
 * - Filter by completed status
 * - User relation display
 *
 * Note: JSONPlaceholder is read-only, toggle is simulated locally.
 */

import { ref, onMounted } from 'vue'
import { useListPage, ListPage, useOrchestrator, useSignalToast } from 'qdadm'
import Column from 'primevue/column'
import Checkbox from 'primevue/checkbox'

const { getManager } = useOrchestrator()
const toast = useSignalToast('TodosPage')

// ============ LIST BUILDER ============
const list = useListPage({ entity: 'todos' })

// ============ LOOKUPS ============
// Load users for displaying names instead of IDs
const usersMap = ref({})

onMounted(async () => {
  const usersRes = await getManager('jp_users').list({ page_size: 100 })
  usersMap.value = Object.fromEntries(usersRes.items.map(u => [u.id, u]))
})

function getUserName(userId) {
  return usersMap.value[userId]?.name || usersMap.value[userId]?.username || `User ${userId}`
}

// ============ SEARCH ============
list.setSearch({
  placeholder: 'Search todos...',
  fields: ['title']
})

// ============ FILTERS ============
// Filter by user
list.addFilter('userId', {
  placeholder: 'All Users',
  optionsEntity: 'jp_users',
  optionLabel: 'name',
  optionValue: 'id'
})

// Filter by completed status
list.addFilter('completed', {
  placeholder: 'All Status',
  options: [
    { label: 'All Status', value: '' },
    { label: 'Completed', value: 'true' },
    { label: 'Active', value: 'false' }
  ]
})

// ============ COMPLETION TOGGLE ============
// Simulate PATCH to toggle completed status
// Note: JSONPlaceholder doesn't persist changes, but simulates success
const togglingId = ref(null)

async function toggleCompleted(todo) {
  togglingId.value = todo.id
  try {
    const todosManager = getManager('todos')
    await todosManager.patch(todo.id, { completed: !todo.completed })

    // Update local state (JSONPlaceholder doesn't persist)
    todo.completed = !todo.completed

    toast.add({
      severity: 'success',
      summary: todo.completed ? 'Completed' : 'Uncompleted',
      detail: `"${todo.title.slice(0, 30)}${todo.title.length > 30 ? '...' : ''}" marked as ${todo.completed ? 'completed' : 'active'}`,
      life: 2000
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to update todo',
      life: 3000
    })
  } finally {
    togglingId.value = null
  }
}
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column field="completed" header="Done" style="width: 70px">
        <template #body="{ data }">
          <Checkbox
            :modelValue="data.completed"
            :disabled="togglingId === data.id"
            binary
            @update:modelValue="toggleCompleted(data)"
          />
        </template>
      </Column>
      <Column field="title" header="Title" sortable>
        <template #body="{ data }">
          <span :class="{ 'todo-completed': data.completed }">
            {{ data.title }}
          </span>
        </template>
      </Column>
      <Column field="userId" header="Assigned To" sortable style="width: 200px">
        <template #body="{ data }">
          {{ getUserName(data.userId) }}
        </template>
      </Column>
    </template>
  </ListPage>
</template>

<style scoped>
.todo-completed {
  text-decoration: line-through;
  color: var(--p-surface-400, #94a3b8);
}
</style>
