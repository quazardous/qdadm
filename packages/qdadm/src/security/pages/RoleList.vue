<script setup>
/**
 * RoleList - Role listing page (standard ListPage pattern)
 */

import { useListPage, ListPage, useOrchestrator } from '../../index.js'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Chip from 'primevue/chip'
import Message from 'primevue/message'

// ============ LIST BUILDER ============
const list = useListPage({ entity: 'roles' })

// ============ SEARCH ============
list.setSearch({
  placeholder: 'Search roles...',
  fields: ['name', 'label']
})

// ============ HEADER ACTIONS ============
list.addCreateAction('New Role')

// ============ ROW ACTIONS ============
list.addEditAction()
list.addDeleteAction({ labelField: 'label' })

// ============ HELPERS ============
const { getManager } = useOrchestrator()
const manager = getManager('roles')
const canPersist = manager?.canPersist ?? false
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <!-- Read-only Warning -->
    <template #before-table>
      <Message v-if="!canPersist" severity="info" :closable="false" class="mb-4">
        <div class="flex align-items-center gap-2">
          <i class="pi pi-info-circle text-xl"></i>
          <span>
            <strong>Read-only:</strong> Roles are configured statically.
            Use a PersistableRoleGranterAdapter for editing.
          </span>
        </div>
      </Message>
    </template>

    <template #columns>
      <Column field="name" header="Role" sortable style="width: 25%">
        <template #body="{ data }">
          <div>
            <code class="role-name">{{ data.name }}</code>
            <div v-if="data.label && data.label !== data.name" class="text-sm text-color-secondary mt-1">
              {{ data.label }}
            </div>
          </div>
        </template>
      </Column>

      <Column header="Inherits" style="width: 20%">
        <template #body="{ data }">
          <div v-if="data.inherits?.length" class="flex flex-wrap gap-1">
            <Tag
              v-for="parent in data.inherits"
              :key="parent"
              :value="parent"
              severity="secondary"
            />
          </div>
          <span v-else class="text-color-secondary">-</span>
        </template>
      </Column>

      <Column header="Permissions" style="width: 40%">
        <template #body="{ data }">
          <div v-if="data.permissions?.length" class="flex flex-wrap gap-1">
            <Chip
              v-for="perm in data.permissions.slice(0, 5)"
              :key="perm"
              :label="perm"
              class="text-xs"
            />
            <Chip
              v-if="data.permissions.length > 5"
              :label="`+${data.permissions.length - 5} more`"
              class="text-xs"
            />
          </div>
          <span v-else class="text-color-secondary">No permissions</span>
        </template>
      </Column>
    </template>
  </ListPage>
</template>

<style scoped>
.role-name {
  padding: 0.2rem 0.4rem;
  background: var(--p-surface-100);
  border-radius: 4px;
  font-size: 0.875rem;
  color: var(--p-primary-color);
  font-weight: 500;
}
</style>
