<script setup>
/**
 * PostsPage - JSONPlaceholder Posts list page
 *
 * Displays posts fetched from JSONPlaceholder API.
 * Features:
 * - Filter by userId via query param (?userId=X)
 * - Link to author user detail
 * - View post detail action
 *
 * Note: JSONPlaceholder is read-only.
 */

import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useListPage, ListPage, useOrchestrator } from 'qdadm'
import Column from 'primevue/column'
import Button from 'primevue/button'

const route = useRoute()
const router = useRouter()
const { getManager } = useOrchestrator()

// ============ LIST BUILDER ============
const list = useListPage({ entity: 'posts' })

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
  placeholder: 'Search posts...',
  fields: ['title', 'body']
})

// ============ FILTERS ============
// Filter by user
list.addFilter('userId', {
  placeholder: 'All Users',
  optionsEntity: 'jp_users',
  optionLabel: 'name',
  optionValue: 'id'
})

// ============ QUERY PARAM SYNC ============
// Support ?userId=X for filtering from user detail page
watch(() => route.query.userId, (userId) => {
  if (userId) {
    list.setFilterValue('userId', parseInt(userId, 10))
  }
}, { immediate: true })

// ============ ROW ACTIONS ============
list.addViewAction()

// ============ USER LINK ============
function goToUser(userId) {
  router.push({ name: 'jp_user-show', params: { id: userId } })
}

// ============ TITLE TRUNCATION ============
function truncateTitle(title, maxLength = 60) {
  if (!title) return ''
  return title.length > maxLength ? title.slice(0, maxLength) + '...' : title
}
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column field="title" header="Title" sortable>
        <template #body="{ data }">
          {{ truncateTitle(data.title) }}
        </template>
      </Column>
      <Column field="userId" header="Author" sortable style="width: 200px">
        <template #body="{ data }">
          <Button
            :label="getUserName(data.userId)"
            link
            class="p-0"
            @click.stop="goToUser(data.userId)"
          />
        </template>
      </Column>
    </template>
  </ListPage>
</template>
