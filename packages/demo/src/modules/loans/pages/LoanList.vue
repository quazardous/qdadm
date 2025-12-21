<script setup>
/**
 * LoanList - Loan listing page
 *
 * Shows loans with book/user lookups.
 */

import { ref, onMounted } from 'vue'
import { useListPageBuilder, ListPage, useOrchestrator, BoolCell } from 'qdadm'
import { useToast } from 'primevue/usetoast'
import Tag from 'primevue/tag'
import Column from 'primevue/column'

const { getManager } = useOrchestrator()
const toast = useToast()

// ============ LIST BUILDER ============
const list = useListPageBuilder({ entity: 'loans' })

// ============ LOOKUPS ============
const booksMap = ref({})
const usersMap = ref({})

onMounted(async () => {
  const [booksRes, usersRes] = await Promise.all([
    getManager('books').list({ page_size: 1000 }),
    getManager('users').list({ page_size: 1000 })
  ])
  booksMap.value = Object.fromEntries(booksRes.items.map(b => [b.id, b]))
  usersMap.value = Object.fromEntries(usersRes.items.map(u => [u.id, u]))
})

function getBookTitle(bookId) {
  return booksMap.value[bookId]?.title || bookId
}

function getUserName(userId) {
  return usersMap.value[userId]?.username || userId
}

// ============ SEARCH ============
// Custom local search on book title (lookup from booksMap)
// local_search specifies HOW to search in local mode (items < threshold)
list.setSearch({
  placeholder: 'Search by book title...',
  local_search: (item, query) => {
    const bookTitle = booksMap.value[item.book_id]?.title || ''
    return bookTitle.toLowerCase().includes(query)
  }
})

// ============ FILTERS ============
// Virtual filter - status doesn't exist on entity,
// local_filter specifies HOW to filter in local mode
list.addFilter('status', {
  placeholder: 'All Status',
  options: [
    { label: 'All', value: null },
    { label: 'Active', value: 'active' },
    { label: 'Returned', value: 'returned' }
  ],
  local_filter: (item, value) => {
    if (value === 'active') return !item.returned_at
    if (value === 'returned') return !!item.returned_at
    return true
  }
})

list.addFilter('read', {
  placeholder: 'Read Status',
  options: [
    { label: 'All', value: null },
    { label: 'Read', value: true },
    { label: 'Unread', value: false }
  ]
})

// ============ HEADER ACTIONS ============
list.addCreateAction('New Loan')
list.addBulkDeleteAction()

// Bulk toggle read status
const markingRead = ref(false)

async function bulkMarkAsRead(readValue) {
  const selected = list.selected.value
  if (selected.length === 0) return

  markingRead.value = true
  try {
    const loansManager = getManager('loans')
    await Promise.all(selected.map(loan => loansManager.patch(loan.id, { read: readValue })))

    toast.add({
      severity: 'success',
      summary: 'Updated',
      detail: `${selected.length} loan(s) marked as ${readValue ? 'read' : 'unread'}`,
      life: 3000
    })

    list.selected.value = []
    list.loadItems({}, { force: true })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to update loans',
      life: 5000
    })
  } finally {
    markingRead.value = false
  }
}

list.addHeaderAction('mark-read', {
  label: (state) => `Mark Read (${state.selectionCount})`,
  icon: 'pi pi-check',
  severity: 'success',
  onClick: () => bulkMarkAsRead(true),
  visible: (state) => state.hasSelection,
  loading: () => markingRead.value
})

list.addHeaderAction('mark-unread', {
  label: (state) => `Mark Unread (${state.selectionCount})`,
  icon: 'pi pi-times',
  severity: 'secondary',
  onClick: () => bulkMarkAsRead(false),
  visible: (state) => state.hasSelection,
  loading: () => markingRead.value
})

// ============ ROW ACTIONS ============
list.addEditAction()
list.addDeleteAction()

// ============ HELPERS ============
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
    <template #columns>
      <Column field="book_id" header="Book" sortable>
        <template #body="{ data }">
          {{ getBookTitle(data.book_id) }}
        </template>
      </Column>
      <Column field="user_id" header="Borrower" sortable>
        <template #body="{ data }">
          {{ getUserName(data.user_id) }}
        </template>
      </Column>
      <Column field="borrowed_at" header="Borrowed" sortable style="width: 120px">
        <template #body="{ data }">
          {{ formatDate(data.borrowed_at) }}
        </template>
      </Column>
      <Column field="returned_at" header="Returned" sortable style="width: 120px">
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
  </ListPage>
</template>
