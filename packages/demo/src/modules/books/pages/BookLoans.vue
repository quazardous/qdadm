<script setup>
/**
 * BookLoans - List of loans for a specific book
 *
 * Child route of book-edit: /books/:bookId/loans
 * Uses PageNav for breadcrumb + navlinks (Details | Loans)
 * Filter is auto-applied via route.meta.parent config
 */

import { ref, onMounted } from 'vue'
import { useListPageBuilder, ListPage, PageNav, useOrchestrator, BoolCell } from 'qdadm'
import Column from 'primevue/column'
import Tag from 'primevue/tag'

const { getManager } = useOrchestrator()

// ============ LIST BUILDER ============
// Parent filter (book_id) is auto-applied from route.meta.parent
const list = useListPageBuilder({ entity: 'loans' })

// ============ ROW ACTIONS ============
list.addEditAction()
list.addDeleteAction()

// ============ RELATED DATA ============
const usersManager = getManager('users')
const usersMap = ref({})

// Load users for display
onMounted(async () => {
  try {
    const { items } = await usersManager.list({ page_size: 100 })
    usersMap.value = Object.fromEntries(items.map(u => [u.id, u]))
  } catch (e) {
    console.warn('Failed to load users:', e)
  }
})

// Helpers
function getUserName(userId) {
  return usersMap.value[userId]?.username || userId
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString()
}

function getStatusSeverity(loan) {
  return loan.returned_at ? 'secondary' : 'success'
}

function getStatusLabel(loan) {
  return loan.returned_at ? 'Returned' : 'Active'
}
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #nav>
      <PageNav />
    </template>

    <template #columns>
        <Column field="user_id" header="Borrower">
          <template #body="{ data }">
            {{ getUserName(data.user_id) }}
          </template>
        </Column>
        <Column field="borrowed_at" header="Borrowed" style="width: 120px">
          <template #body="{ data }">
            {{ formatDate(data.borrowed_at) }}
          </template>
        </Column>
        <Column field="returned_at" header="Returned" style="width: 120px">
          <template #body="{ data }">
            {{ formatDate(data.returned_at) }}
          </template>
        </Column>
        <Column header="Status" style="width: 100px">
          <template #body="{ data }">
            <Tag :value="getStatusLabel(data)" :severity="getStatusSeverity(data)" />
          </template>
        </Column>
        <Column field="read" header="Read" style="width: 80px">
          <template #body="{ data }">
            <BoolCell :value="data.read" />
          </template>
        </Column>
      </template>

    <template #empty>
      <div class="text-center p-4 text-color-secondary">
        No loans for this book
      </div>
    </template>
  </ListPage>
</template>
