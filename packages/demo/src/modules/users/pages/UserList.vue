<script setup>
/**
 * UserList - User listing page
 */

import { useListPage, ListPage } from 'qdadm'
import Column from 'primevue/column'

// ============ LIST BUILDER ============
const list = useListPage({ entity: 'users' })

// ============ SEARCH ============
list.setSearch({
  placeholder: 'Search users...',
  fields: ['username']
})

// ============ FILTERS ============
// Dynamic filter: options loaded from roles entity
// optionLabel can be a callback for custom display
list.addFilter('role', {
  placeholder: 'All Roles',
  optionsEntity: 'roles',
  optionLabel: (role) => `${role.label} - ${role.name}`,
  optionValue: 'name'
})

// ============ HEADER ACTIONS ============
list.addCreateAction('Add User')
list.addBulkDeleteAction()

// ============ ROW ACTIONS ============
list.addEditAction()
list.addDeleteAction({ labelField: 'username' })

</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column field="username" header="Username" sortable />
      <Column field="role" header="Role" sortable style="width: 120px">
        <template #body="{ data }">
          <span class="p-role-label">{{ data.role }}</span>
        </template>
      </Column>
    </template>
  </ListPage>
</template>
