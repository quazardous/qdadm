<script setup>
/**
 * LoanAwareBooksHeader - Loan-aware replacement for BooksListHeader
 *
 * CROSS-MODULE ZONE EXTENSION: Replace Operation
 * ================================================
 * This component REPLACES the default BooksListHeader in 'books-list-header' zone.
 * It demonstrates the 'replace' operation where one module completely substitutes
 * a block contributed by another module.
 *
 * The Loans module replaces the Books header to add loan statistics,
 * showing how many books are currently on loan without modifying Books module code.
 *
 * @zone books-list-header - Registered with operation: 'replace', replaces: 'books-header'
 */
import { ref, onMounted, computed } from 'vue'
import { useOrchestrator } from 'qdadm'
import Badge from 'primevue/badge'

const { getManager } = useOrchestrator()
const booksManager = getManager('books')
const loansManager = getManager('loans')

const label = computed(() => booksManager?.config?.labelPlural || 'Books')

// Loan statistics
const activeLoansCount = ref(0)
const loading = ref(true)

onMounted(async () => {
  try {
    const { items } = await loansManager.list({ page_size: 1000 })
    activeLoansCount.value = items.filter(loan => !loan.returned_at).length
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="books-list-header loan-aware">
    <div class="flex align-items-center gap-2">
      <h2 class="text-xl font-semibold m-0">{{ label }} Catalog</h2>
      <Badge
        v-if="!loading && activeLoansCount > 0"
        :value="`${activeLoansCount} on loan`"
        severity="warn"
      />
    </div>
    <p class="text-color-secondary mt-1 mb-0">
      Browse and manage your book collection
      <span v-if="activeLoansCount > 0" class="text-orange-500">
        ({{ activeLoansCount }} currently loaned out)
      </span>
    </p>
  </div>
</template>

<style scoped>
.loan-aware {
  border-left: 3px solid var(--p-orange-500);
  padding-left: 1rem;
}
</style>
