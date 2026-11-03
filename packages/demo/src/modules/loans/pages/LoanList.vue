<script setup>
/**
 * LoanList - Loan listing page
 *
 * Shows loans with book/user lookups.
 */

import { ref, onMounted } from 'vue'
import { useListPage, ListPage, useOrchestrator, BoolCell, useSignalToast, useI18n } from '@quazardous/qdadm'
import Tag from 'primevue/tag'
import Column from 'primevue/column'

const { getManager } = useOrchestrator()
const toast = useSignalToast('LoanList')
// Every string on screen comes from the catalogue (LoansModule's messages)
const { t } = useI18n()

// ============ LIST BUILDER ============
const list = useListPage({ entity: 'loans' })

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
// PRD-009: Search uses searchFields capability - no local_search callback needed
// Storage declares searchFields: ['book.title', 'user.username']
// Override to only search by book title (not username)
list.setSearch({
  fields: ['book.title']  // ← Override: only search book titles
})

// ============ FILTERS ============
// Smart filter: optionsEntity - options from books EntityManager
// Using explicit autocomplete component for testing
// No placeholder: the field's label, and "All …", come from the catalogue
list.addFilter('book_id', {
  optionsEntity: 'books',
  optionLabel: 'title',
  optionValue: 'bookId',
  component: 'autocomplete'  // Force autocomplete for testing
})

// Virtual filter - status maps to returned_at field
// toQuery transforms the value to MongoDB-like query for QueryExecutor
// default: 'active' - show only active loans by default (blue indicator)
// when user changes to another value, indicator turns orange
// Option labels: entities.loans.fields.status.options.<value>
list.addFilter('status', {
  default: 'active',
  options: [
    { label: 'Active', value: 'active' },
    { label: 'Returned', value: 'returned' }
  ],
  toQuery: (value) => {
    if (value === 'active') return { returned_at: null }
    if (value === 'returned') return { returned_at: { $ne: null } }
    return {}
  }
})

// Smart filter: optionsFromCache - extract unique 'read' values from loaded items
// Options from the loaded rows: true / false, labelled by
// entities.loans.fields.read.options.true|false
list.addFilter('read', {
  optionsFromCache: true
})

// ============ HEADER ACTIONS ============
list.addCreateAction()

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
      summary: t('core.messages.updated'),
      detail: t(readValue ? 'loans.markedRead' : 'loans.markedUnread', { count: selected.length }),
      life: 3000
    })

    list.selected.value = []
    list.loadItems({}, { force: true })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('loans.error'),
      detail: t('loans.failed'),
      life: 5000
    })
  } finally {
    markingRead.value = false
  }
}

list.addHeaderAction('mark-read', {
  label: (state) => t('loans.markRead', { count: state.selectionCount }),
  icon: 'pi pi-check',
  severity: 'success',
  onClick: () => bulkMarkAsRead(true),
  visible: (state) => state.hasSelection,
  loading: () => markingRead.value
})

list.addHeaderAction('mark-unread', {
  label: (state) => t('loans.markUnread', { count: state.selectionCount }),
  icon: 'pi pi-times',
  severity: 'secondary',
  onClick: () => bulkMarkAsRead(false),
  visible: (state) => state.hasSelection,
  loading: () => markingRead.value
})

// Delete is last so it's the primary action in mobile split button
list.addBulkDeleteAction()

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
  return t(`entities.loans.fields.status.options.${loan.returned_at ? 'returned' : 'active'}`)
}
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column v-bind="list.column('book_id')" sortable>
        <template #body="{ data }">
          {{ getBookTitle(data.book_id) }}
        </template>
      </Column>
      <Column v-bind="list.column('user_id')" sortable>
        <template #body="{ data }">
          {{ getUserName(data.user_id) }}
        </template>
      </Column>
      <Column v-bind="list.column('borrowed_at')" sortable style="width: 120px">
        <template #body="{ data }">
          {{ formatDate(data.borrowed_at) }}
        </template>
      </Column>
      <Column v-bind="list.column('returned_at')" sortable style="width: 120px">
        <template #body="{ data }">
          {{ formatDate(data.returned_at) }}
        </template>
      </Column>
      <Column v-bind="list.column('status')" style="width: 100px">
        <template #body="{ data }">
          <Tag :value="getStatusLabel(data)" :severity="getStatusSeverity(data)" />
        </template>
      </Column>
      <Column v-bind="list.column('read')" style="width: 80px">
        <template #body="{ data }">
          <BoolCell :value="data.read" />
        </template>
      </Column>
    </template>
  </ListPage>
</template>
