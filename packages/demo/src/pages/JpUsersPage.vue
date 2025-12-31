<script setup>
/**
 * JpUsersPage - JSONPlaceholder Users list page
 *
 * Displays users fetched from JSONPlaceholder API.
 * Uses useListPageBuilder with simplified v-bind/v-on pattern.
 *
 * Note: JSONPlaceholder is read-only, so no create/edit/delete actions.
 */

import { useListPageBuilder, ListPage } from 'qdadm'
import Column from 'primevue/column'

// ============ LIST BUILDER ============
// Uses jp_users entity (JSONPlaceholder users via orchestrator)
const list = useListPageBuilder({ entity: 'jp_users' })

// ============ SEARCH ============
list.setSearch({
  placeholder: 'Search users...',
  fields: ['name', 'username', 'email']
})

// ============ ROW ACTIONS ============
// View action navigates to detail page
list.addViewAction()
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column field="name" header="Name" sortable />
      <Column field="username" header="Username" sortable />
      <Column field="email" header="Email" sortable />
    </template>
  </ListPage>
</template>
