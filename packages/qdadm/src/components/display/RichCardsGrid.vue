<script setup>
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

const router = useRouter()

defineProps({
  cards: {
    type: Array,
    default: () => []
  },
  columns: {
    type: [Number, String],
    default: 'auto',
    validator: (v) => ['auto', 2, 3, 4, 5, 6].includes(v)
  }
})

function handleClick(card) {
  if (card.onClick) {
    card.onClick()
  } else if (card.to) {
    router.push(card.to)
  }
}

function isClickable(card) {
  return card.onClick || card.to
}

function getSeverityClass(severity) {
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

<style scoped>
.rich-cards-grid {
  display: grid;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.rich-cards-grid--cols-auto {
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.rich-cards-grid--cols-2 {
  grid-template-columns: repeat(2, 1fr);
}

.rich-cards-grid--cols-3 {
  grid-template-columns: repeat(3, 1fr);
}

.rich-cards-grid--cols-4 {
  grid-template-columns: repeat(4, 1fr);
}

.rich-cards-grid--cols-5 {
  grid-template-columns: repeat(5, 1fr);
}

.rich-cards-grid--cols-6 {
  grid-template-columns: repeat(6, 1fr);
}

.rich-card {
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-200);
  border-radius: 0.5rem;
  padding: 1.25rem;
}

.rich-card--clickable {
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}

.rich-card--clickable:hover {
  border-color: var(--p-primary-300);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.rich-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.rich-card-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--p-surface-600);
}

.rich-card-icon {
  font-size: 1.25rem;
  color: var(--p-surface-400);
}

.rich-card-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--p-surface-900);
  line-height: 1.2;
}

.rich-card-subtitle {
  font-size: 0.8rem;
  color: var(--p-surface-500);
  margin-top: 0.25rem;
}

/* Severity variants */
.rich-card--success .rich-card-value {
  color: var(--p-green-600);
}

.rich-card--success .rich-card-icon {
  color: var(--p-green-500);
}

.rich-card--danger .rich-card-value {
  color: var(--p-red-600);
}

.rich-card--danger .rich-card-icon {
  color: var(--p-red-500);
}

.rich-card--warning .rich-card-value {
  color: var(--p-orange-600);
}

.rich-card--warning .rich-card-icon {
  color: var(--p-orange-500);
}

.rich-card--info .rich-card-value {
  color: var(--p-blue-600);
}

.rich-card--info .rich-card-icon {
  color: var(--p-blue-500);
}

@media (max-width: 1024px) {
  .rich-cards-grid--cols-5,
  .rich-cards-grid--cols-6 {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .rich-cards-grid--cols-3,
  .rich-cards-grid--cols-4,
  .rich-cards-grid--cols-5,
  .rich-cards-grid--cols-6 {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .rich-cards-grid {
    grid-template-columns: 1fr;
  }
}
</style>
