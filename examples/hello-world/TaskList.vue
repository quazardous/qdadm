<script setup>
import { ref, onMounted } from 'vue'
import { useOrchestrator } from 'qdadm'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const { getManager } = useOrchestrator()
const tasks = ref([])

onMounted(async () => {
  const result = await getManager('tasks').list()
  tasks.value = result.items
})
</script>

<template>
  <DataTable :value="tasks" stripedRows>
    <Column field="title" header="Title" />
    <Column field="done" header="Done">
      <template #body="{ data }">
        {{ data.done ? '✓' : '○' }}
      </template>
    </Column>
  </DataTable>
</template>
