<script setup>
/**
 * BookInfo - Custom child page on book item
 *
 * Demonstrates ctx.childPage() + useChildPage() for adding non-entity tabs
 * alongside entity child routes (like Loans).
 * useChildPage() gives access to hydrated parent data automatically.
 */
import { useChildPage, PageLayout, PageNav } from 'qdadm'
import Card from 'primevue/card'

const { parentData: book, parentLoading, parentManager } = useChildPage()
</script>

<template>
  <PageLayout title="Book Info">
    <template #nav>
      <PageNav />
    </template>

    <div v-if="parentLoading" class="loading-state">
      <i class="pi pi-spin pi-spinner spinner-lg"></i>
    </div>
    <div v-else-if="book" class="info-grid">
      <Card>
        <template #title>
          <div class="info-header">
            <i class="pi pi-info-circle"></i>
            Summary
          </div>
        </template>
        <template #content>
          <dl class="info-list">
            <div class="info-item">
              <dt>Title</dt>
              <dd>{{ book.title }}</dd>
            </div>
            <div class="info-item">
              <dt>Author</dt>
              <dd>{{ book.author }}</dd>
            </div>
            <div class="info-item">
              <dt>Year</dt>
              <dd>{{ book.year }}</dd>
            </div>
            <div class="info-item">
              <dt>Genre</dt>
              <dd>{{ book.genre }}</dd>
            </div>
            <div class="info-item">
              <dt>ID</dt>
              <dd><code>{{ book[parentManager?.idField] }}</code></dd>
            </div>
          </dl>
        </template>
      </Card>
    </div>
  </PageLayout>
</template>

<style scoped>
.info-grid {
  max-width: 600px;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-surface-600);
}

.info-list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-item {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--p-surface-200);
}

.info-item:last-child {
  border-bottom: none;
}

.info-item dt {
  font-weight: 600;
  color: var(--p-surface-500);
  min-width: 80px;
}

.info-item dd {
  margin: 0;
  color: var(--p-surface-700);
}
</style>
