<script setup>
/**
 * BookStats - Custom statistics page
 *
 * Demonstrates adding a custom (non-CRUD) page to a module.
 * Uses the orchestrator to fetch data and compute stats.
 */
import { ref, onMounted } from 'vue'
import { useOrchestrator, PageLayout } from 'qdadm'
import Card from 'primevue/card'

const { getManager } = useOrchestrator()
const stats = ref(null)
const loading = ref(true)

onMounted(async () => {
  const manager = getManager('books')
  const { items } = await manager.list({ page_size: 1000 })

  // Compute stats
  const byGenre = items.reduce((acc, book) => {
    acc[book.genre] = (acc[book.genre] || 0) + 1
    return acc
  }, {})

  const byDecade = items.reduce((acc, book) => {
    const decade = Math.floor(book.year / 10) * 10
    acc[decade] = (acc[decade] || 0) + 1
    return acc
  }, {})

  stats.value = {
    total: items.length,
    byGenre: Object.entries(byGenre).sort((a, b) => b[1] - a[1]),
    byDecade: Object.entries(byDecade).sort((a, b) => a[0] - b[0])
  }
  loading.value = false
})
</script>

<template>
  <PageLayout title="Book Statistics">
    <div v-if="loading" class="loading-state">
      <i class="pi pi-spin pi-spinner spinner-lg"></i>
    </div>

    <div v-else class="stats-grid">
      <Card class="stats-card stats-card--highlight">
        <template #title>
          <div class="stats-card-header">
            <i class="pi pi-book"></i>
            Total Books
          </div>
        </template>
        <template #content>
          <div class="stats-total">{{ stats.total }}</div>
        </template>
      </Card>

      <Card class="stats-card">
        <template #title>
          <div class="stats-card-header">
            <i class="pi pi-tags"></i>
            By Genre
          </div>
        </template>
        <template #content>
          <div class="stats-list">
            <div v-for="[genre, count] in stats.byGenre" :key="genre" class="stats-row">
              <span class="stats-label">{{ genre }}</span>
              <span class="stats-value">{{ count }}</span>
            </div>
          </div>
        </template>
      </Card>

      <Card class="stats-card">
        <template #title>
          <div class="stats-card-header">
            <i class="pi pi-calendar"></i>
            By Decade
          </div>
        </template>
        <template #content>
          <div class="stats-list">
            <div v-for="[decade, count] in stats.byDecade" :key="decade" class="stats-row">
              <span class="stats-label">{{ decade }}s</span>
              <span class="stats-value">{{ count }}</span>
            </div>
          </div>
        </template>
      </Card>
    </div>
  </PageLayout>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.stats-card {
  height: 100%;
}

.stats-card--highlight :deep(.p-card-body) {
  background: linear-gradient(135deg, var(--p-primary-500), var(--p-primary-600));
  color: white;
  border-radius: 0.5rem;
}

.stats-card--highlight .stats-card-header {
  color: rgba(255, 255, 255, 0.9);
}

.stats-card--highlight .stats-total {
  color: white;
}

.stats-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-surface-600);
}

.stats-card-header i {
  font-size: 1.125rem;
}

.stats-total {
  font-size: 3rem;
  font-weight: 700;
  color: var(--p-primary-500);
  line-height: 1;
}

.stats-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stats-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--p-surface-200);
}

.stats-row:last-child {
  border-bottom: none;
}

.stats-label {
  text-transform: capitalize;
  color: var(--p-surface-700);
}

.stats-value {
  font-weight: 600;
  color: var(--p-primary-600);
  background: var(--p-primary-50);
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
}
</style>
