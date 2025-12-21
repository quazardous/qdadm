<script setup>
/**
 * UserList - User listing page
 */

import { useListPageBuilder, ListPage } from 'qdadm'
import Tag from 'primevue/tag'
import Column from 'primevue/column'

// ============ LIST BUILDER ============
const list = useListPageBuilder({ entity: 'users' })

// ============ SEARCH ============
list.setSearch({
  placeholder: 'Search users...',
  fields: ['username']
})

// ============ FILTERS ============
list.addFilter('role', {
  placeholder: 'All Roles',
  options: [
    { label: 'All', value: null },
    { label: 'Admin', value: 'admin' },
    { label: 'User', value: 'user' }
  ]
})

// ============ HEADER ACTIONS ============
list.addCreateAction('Add User')
list.addBulkDeleteAction()

// ============ ROW ACTIONS ============
list.addEditAction()
list.addDeleteAction({ labelField: 'username' })

// ============ HELPERS ============
function getRoleSeverity(role) {
  return role === 'admin' ? 'danger' : 'info'
}
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column field="username" header="Username" sortable />
      <Column field="role" header="Role" sortable style="width: 120px">
        <template #body="{ data }">
          <Tag :value="data.role" :severity="getRoleSeverity(data.role)" />
        </template>
      </Column>
    </template>
  </ListPage>
</template>
