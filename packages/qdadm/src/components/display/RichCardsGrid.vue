<script setup lang="ts">
/**
 * RichCardsGrid - Grid of rich stat cards with title, value, subtitle
 *
 * Props:
 * - cards: Array of card objects
 * - columns: Number of columns (2, 3, 4, or 'auto')
 *
 * Card object:
 * {
 *   name: 'users',           // unique key
 *   title: 'Users',          // card title
 *   value: 42,               // main value
 *   subtitle: '10 active',   // optional subtitle
 *   icon: 'pi pi-users',     // optional icon
 *   severity: 'success',     // optional: success, danger, warning, info
 *   onClick: () => {},       // optional click handler
 *   to: '/dashboard/users',  // optional router link
 *   custom: true             // use slot instead
 * }
 */
import { useRouter } from 'vue-router'
import type { PropType } from 'vue'

type CardSeverity = 'success' | 'danger' | 'warning' | 'info'
type ColumnsType = 'auto' | 2 | 3 | 4 | 5 | 6

export interface RichCard {
  name: string
  title?: string
  value?: string | number
  subtitle?: string
  icon?: string
  severity?: CardSeverity
  onClick?: () => void
  to?: string
  custom?: boolean
  class?: string
}

const router = useRouter()

defineProps({
  cards: {
    type: Array as PropType<RichCard[]>,
    default: () => []
  },
  columns: {
    type: [Number, String] as PropType<ColumnsType>,
    default: 'auto',
    validator: (v: ColumnsType) => ['auto', 2, 3, 4, 5, 6].includes(v)
  }
})

function handleClick(card: RichCard): void {
  if (card.onClick) {
    card.onClick()
  } else if (card.to) {
    router.push(card.to)
  }
}

function isClickable(card: RichCard): boolean {
  return !!(card.onClick || card.to)
}

function getSeverityClass(severity: CardSeverity | undefined): string {
  if (!severity) return ''
  return `rich-card--${severity}`
}
</script>

<template>
  <div v-if="cards.length > 0" class="rich-cards-grid" :class="`rich-cards-grid--cols-${columns}`">
    <template v-for="card in cards" :key="card.name">
      <!-- Custom card: render slot -->
      <div v-if="card.custom" class="rich-card rich-card--custom" :class="card.class">
        <slot :name="`card-${card.name}`" :card="card" ></slot>
      </div>

      <!-- Rich stat card -->
      <div
        v-else
        class="rich-card"
        :class="[
          getSeverityClass(card.severity),
          { 'rich-card--clickable': isClickable(card) },
          card.class
        ]"
        @click="handleClick(card)"
      >
        <div class="rich-card-header">
          <span class="rich-card-title">{{ card.title }}</span>
          <i v-if="card.icon" :class="card.icon" class="rich-card-icon"></i>
        </div>
        <div class="rich-card-value">{{ card.value }}</div>
        <div v-if="card.subtitle" class="rich-card-subtitle">{{ card.subtitle }}</div>
      </div>
    </template>
  </div>
</template>
