<script setup>
/**
 * FavoritesPage - LocalStorage Demo
 *
 * Displays favorites stored in browser localStorage.
 * Demonstrates:
 * - LocalStorage adapter (data persists across sessions)
 * - Full CRUD operations
 * - Entity type filtering
 *
 * Storage key: qdadm-demo-favorites
 */

import { useListPage, ListPage, useOrchestrator, useSignalToast } from 'qdadm'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Button from 'primevue/button'

const { getManager } = useOrchestrator()
const toast = useSignalToast('FavoritesPage')

// ============ LIST BUILDER ============
const list = useListPage({ entity: 'favorites' })

// ============ SEARCH ============
list.setSearch({
  placeholder: 'Search favorites...',
  fields: ['name']
})

// ============ FILTERS ============
list.addFilter('entityType', {
  placeholder: 'All Types',
  options: [
    { label: 'All Types', value: '' },
    { label: 'Book', value: 'book' },
    { label: 'User', value: 'user' },
    { label: 'Genre', value: 'genre' },
    { label: 'Loan', value: 'loan' }
  ]
})

// ============ ACTIONS ============
list.addCreateAction()
list.addEditAction()
list.addDeleteAction()

// ============ SEVERITY MAP ============
const entityTypeSeverity = {
  book: 'info',
  user: 'success',
  genre: 'warn',
  loan: 'secondary'
}

function getTypeSeverity(type) {
  return entityTypeSeverity[type] || 'secondary'
}

// ============ DATE FORMATTING ============
function formatDate(isoString) {
  if (!isoString) return '-'
  const date = new Date(isoString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ============ DEMO: ADD SAMPLE DATA ============
async function addSampleFavorites() {
  const manager = getManager('favorites')
  const samples = [
    { name: 'Le Petit Prince', entityType: 'book', entityId: '1' },
    { name: 'Admin User', entityType: 'user', entityId: '1' },
    { name: 'Science Fiction', entityType: 'genre', entityId: 'sci-fi' }
  ]

  for (const sample of samples) {
    await manager.create(sample)
  }

  toast.add({
    severity: 'success',
    summary: 'Sample Data Added',
    detail: `Added ${samples.length} sample favorites. Refresh to verify persistence.`,
    life: 3000
  })

  // Trigger list refresh
  list.loadItems({}, { force: true })
}
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #header-actions>
      <Button
        label="Add Samples"
        icon="pi pi-plus-circle"
        severity="secondary"
        outlined
        size="small"
        @click="addSampleFavorites"
      />
    </template>

    <template #columns>
      <Column field="name" header="Name" sortable />
      <Column field="entityType" header="Type" sortable style="width: 150px">
        <template #body="{ data }">
          <Tag :value="data.entityType" :severity="getTypeSeverity(data.entityType)" />
        </template>
      </Column>
      <Column field="entityId" header="Entity ID" style="width: 150px" />
      <Column field="createdAt" header="Created" sortable style="width: 180px">
        <template #body="{ data }">
          {{ formatDate(data.createdAt) }}
        </template>
      </Column>
    </template>

    <template #empty>
      <div class="text-center p-6">
        <i class="pi pi-star text-4xl text-surface-400 mb-4" />
        <p class="text-surface-500 mb-4">No favorites yet.</p>
        <p class="text-surface-400 text-sm mb-4">
          Data is stored in browser localStorage and survives page refresh.
        </p>
        <Button
          label="Add Sample Favorites"
          icon="pi pi-plus-circle"
          @click="addSampleFavorites"
        />
      </div>
    </template>
  </ListPage>
</template>
