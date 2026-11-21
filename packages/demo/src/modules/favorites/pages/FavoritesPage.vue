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

import { useListPage, ListPage, useOrchestrator, useSignalToast } from '@quazardous/qdadm'
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
  fields: ['label']
})

// ============ FILTERS ============
list.addFilter('kind', {
  placeholder: 'All kinds',
  options: [
    { label: 'All kinds', value: '' },
    { label: 'Record', value: 'item' },
    { label: 'List', value: 'list' },
    { label: 'Search', value: 'search' },
    { label: 'Board', value: 'board' }
  ]
})

// ============ ACTIONS ============
list.addCreateAction()
list.addEditAction()
list.addDeleteAction()

// ============ SEVERITY MAP ============
const entityTypeSeverity = {
  item: 'info',
  list: 'success',
  search: 'warn',
  board: 'secondary'
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
  // The shape qdadm's star writes (#5349)
  const at = new Date().toISOString()
  const samples = [
    { label: 'Dune', kind: 'item', entity: 'books', to: '/books/01JFXYZ010BOOK0DUNE0001', at },
    { label: 'Books', kind: 'list', entity: 'books', to: '/books', at },
    { label: 'Genres', kind: 'list', entity: 'genres', to: '/genres', at }
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
      <Column v-bind="list.column('label')" sortable />
      <Column v-bind="list.column('kind')" sortable style="width: 130px">
        <template #body="{ data }">
          <Tag :value="data.kind" :severity="getTypeSeverity(data.kind)" />
        </template>
      </Column>
      <Column v-bind="list.column('to')">
        <template #body="{ data }">
          <RouterLink v-if="data.to" :to="data.to">{{ data.to }}</RouterLink>
        </template>
      </Column>
      <Column v-bind="list.column('at')" sortable style="width: 180px">
        <template #body="{ data }">
          {{ formatDate(data.at) }}
        </template>
      </Column>
    </template>

    <template #empty>
      <div class="text-center p-6">
        <i class="pi pi-bookmark text-4xl text-surface-400 mb-4" />
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
