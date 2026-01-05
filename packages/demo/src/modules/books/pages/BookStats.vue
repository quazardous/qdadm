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
    <div v-if="loading" class="text-center p-4">
      <i class="pi pi-spin pi-spinner text-2xl"></i>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <template #title>Total Books</template>
        <template #content>
          <div class="text-4xl font-bold text-primary">{{ stats.total }}</div>
        </template>
      </Card>

      <Card>
        <template #title>By Genre</template>
        <template #content>
          <div v-for="[genre, count] in stats.byGenre" :key="genre" class="flex justify-between py-1">
            <span class="capitalize">{{ genre }}</span>
            <span class="font-semibold">{{ count }}</span>
          </div>
        </template>
      </Card>

      <Card>
        <template #title>By Decade</template>
        <template #content>
          <div v-for="[decade, count] in stats.byDecade" :key="decade" class="flex justify-between py-1">
            <span>{{ decade }}s</span>
            <span class="font-semibold">{{ count }}</span>
          </div>
        </template>
      </Card>
    </div>
  </PageLayout>
</template>
