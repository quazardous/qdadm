<script setup>
/**
 * AvailabilityWrapper - Wraps book detail with loan availability info
 *
 * CROSS-MODULE ZONE EXTENSION: Wrap Operation
 * ============================================
 * This component WRAPS the BooksDetailPanel in 'books-detail-content' zone.
 * It demonstrates the 'wrap' operation where one module decorates content
 * from another module without replacing it.
 *
 * When viewing a book's details, this wrapper adds a banner showing:
 * - If the book is currently on loan: who has it and when it was borrowed
 * - If the book is available: ready for checkout
 *
 * The original book detail content is rendered via the default slot.
 *
 * @zone books-detail-content - Registered with operation: 'wrap', wraps: 'books-detail'
 */
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useOrchestrator } from 'qdadm'
import Message from 'primevue/message'

const route = useRoute()
const { getManager } = useOrchestrator()
const loansManager = getManager('loans')
const usersManager = getManager('users')

const activeLoan = ref(null)
const borrowerName = ref('')
const loading = ref(true)

const bookId = computed(() => route.params.id)

async function checkLoanStatus() {
  if (!bookId.value) return

  loading.value = true
  try {
    const { items } = await loansManager.list({
      page_size: 100,
      filters: { book_id: bookId.value }
    })

    // Find active loan (not returned)
    const active = items.find(loan => !loan.returned_at)
    activeLoan.value = active || null

    // Get borrower name if there's an active loan
    if (active?.user_id) {
      const user = await usersManager.get(active.user_id)
      borrowerName.value = user?.username || 'Unknown'
    }
  } finally {
    loading.value = false
  }
}

onMounted(checkLoanStatus)
watch(bookId, checkLoanStatus)

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString()
}
</script>

<template>
  <div class="availability-wrapper">
    <!-- Loan status banner (before wrapped content) -->
    <Message
      v-if="!loading && activeLoan"
      severity="warn"
      :closable="false"
      class="mb-3"
    >
      <div class="flex align-items-center gap-2">
        <i class="pi pi-user text-lg"></i>
        <span>
          Currently on loan to <strong>{{ borrowerName }}</strong>
          since {{ formatDate(activeLoan.borrowed_at) }}
        </span>
      </div>
    </Message>

    <Message
      v-else-if="!loading && !activeLoan && bookId"
      severity="success"
      :closable="false"
      class="mb-3"
    >
      <div class="flex align-items-center gap-2">
        <i class="pi pi-check-circle text-lg"></i>
        <span>This book is <strong>available</strong> for checkout</span>
      </div>
    </Message>

    <!-- Original wrapped content (BooksDetailPanel) -->
    <slot />
  </div>
</template>

<style scoped>
.availability-wrapper {
  position: relative;
}
</style>
