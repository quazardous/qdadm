<script setup lang="ts">
/**
 * CardsGrid - Dynamic card zone component
 *
 * Props:
 * - cards: Array of card objects from useCardsZone composable
 * - columns: Number of columns (2, 3, 4, or 'auto')
 *
 * Card types:
 * 1. Simple stat card (default):
 *    { name: 'total', value: 42, label: 'Total', severity: 'success', icon: 'pi pi-check' }
 *
 * 2. Custom card with slot:
 *    { name: 'preview', custom: true }
 *    Then use: <template #card-preview>...</template>
 *
 * If no cards provided, renders nothing.
 */

type Severity = 'success' | 'danger' | 'warning' | 'info'

interface Card {
  name: string
  value?: string | number
  label?: string
  severity?: Severity
  icon?: string
  custom?: boolean
  class?: string
  onClick?: () => void
}

interface Props {
  cards?: Card[]
  columns?: number | 'auto'
}

withDefaults(defineProps<Props>(), {
  cards: () => [],
  columns: 'auto'
})

function getSeverityClass(severity?: Severity): string {
  if (!severity) return ''
  return `stat-value--${severity}`
}
</script>

<template>
  <div v-if="cards.length > 0" class="cards-grid" :class="`cards-grid--cols-${columns}`">
    <template v-for="card in cards" :key="card.name">
      <!-- Custom card: render slot -->
      <div v-if="card.custom" class="card-custom" :class="card.class">
        <slot :name="`card-${card.name}`" :card="card" ></slot>
      </div>

      <!-- Simple stat card -->
      <div
        v-else
        class="stat-card"
        :class="[{ 'stat-card--clickable': card.onClick }, card.class]"
        @click="card.onClick?.()"
      >
        <div class="stat-value" :class="getSeverityClass(card.severity)">
          <i v-if="card.icon" :class="card.icon" class="stat-icon"></i>
          {{ card.value }}
        </div>
        <div class="stat-label">{{ card.label }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cards-grid {
  display: grid;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.cards-grid--cols-auto {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.cards-grid--cols-2 {
  grid-template-columns: repeat(2, 1fr);
}

.cards-grid--cols-3 {
  grid-template-columns: repeat(3, 1fr);
}

.cards-grid--cols-4 {
  grid-template-columns: repeat(4, 1fr);
}

.stat-card,
.card-custom {
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-200);
  border-radius: 0.5rem;
  padding: 1.25rem;
}

.stat-card {
  text-align: center;
}

.stat-card--clickable {
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.stat-card--clickable:hover {
  border-color: var(--p-primary-300);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.stat-value {
  font-size: 2rem;
  font-weight: 600;
  color: var(--p-primary-500);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.stat-value--success {
  color: var(--p-green-500);
}

.stat-value--danger {
  color: var(--p-red-500);
}

.stat-value--warning {
  color: var(--p-orange-500);
}

.stat-value--info {
  color: var(--p-blue-500);
}

.stat-icon {
  font-size: 1.5rem;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--p-surface-600);
  margin-top: 0.25rem;
}

@media (max-width: 768px) {
  .cards-grid--cols-3,
  .cards-grid--cols-4 {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
}
</style>
