<script setup>
/**
 * LoanStatusColumn - Loan status indicator for book list
 *
 * CROSS-MODULE ZONE EXTENSION: Extend Operation
 * ==============================================
 * This component is INSERTED AFTER the Books list header in 'books-list-header' zone.
 * It demonstrates the 'extend' operation where one module adds content
 * relative to an existing block without replacing it.
 *
 * Shows active loan status for the books being displayed, adding value
 * to the Books list page without modifying the Books module.
 *
 * Note: In a real implementation, this would be a table column component.
 * For the demo, we show it as a banner after the header to keep things simple.
 *
 * @zone books-list-header - Registered with operation: 'extend', after: 'books-header'
 */
import { ref, onMounted } from 'vue'
import { useOrchestrator } from 'qdadm'
import { InfoBanner } from 'qdadm/components'

const { getManager } = useOrchestrator()
const loansManager = getManager('loans')

const overdueCount = ref(0)
const loading = ref(true)

// Calculate overdue loans (borrowed more than 14 days ago and not returned)
onMounted(async () => {
  try {
    const { items } = await loansManager.list({ page_size: 1000 })
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    overdueCount.value = items.filter(loan => {
      if (loan.returned_at) return false
      const borrowedDate = new Date(loan.borrowed_at)
      return borrowedDate < twoWeeksAgo
    }).length
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <InfoBanner v-if="!loading && overdueCount > 0" severity="error" class="mt-2 mb-0">
    {{ overdueCount }} book(s) overdue - borrowed more than 2 weeks ago
  </InfoBanner>
</template>
