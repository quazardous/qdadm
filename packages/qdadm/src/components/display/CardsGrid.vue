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
