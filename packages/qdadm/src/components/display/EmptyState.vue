<script setup lang="ts">
/**
 * EmptyState - Reusable empty state display
 *
 * Usage:
 *   <EmptyState
 *     icon="pi-users"
 *     title="No agents found"
 *     description="Assign agents from their profile page"
 *   />
 *
 *   <!-- With slot for custom content -->
 *   <EmptyState icon="pi-inbox" title="No items">
 *     <Button label="Create Item" @click="create" />
 *   </EmptyState>
 */

type SizeVariant = 'sm' | 'md' | 'lg'

defineProps({
  // PrimeIcon name (without "pi-" prefix if you want, both work)
  icon: {
    type: String,
    default: 'inbox'
  },
  // Main message
  title: {
    type: String,
    default: 'No items found'
  },
  // Secondary description (optional)
  description: {
    type: String,
    default: ''
  },
  // Size variant
  size: {
    type: String as () => SizeVariant,
    default: 'md', // sm, md, lg
    validator: (v: string) => ['sm', 'md', 'lg'].includes(v)
  }
})

// Normalize icon name (accept both "pi-inbox" and "inbox")
function getIconClass(icon: string): string {
  if (icon.startsWith('pi-')) {
    return `pi ${icon}`
  }
  return `pi pi-${icon}`
}
</script>

<template>
  <div class="empty-state" :class="`empty-state--${size}`">
    <i :class="getIconClass(icon)" class="empty-state-icon" />
    <p class="empty-state-title">{{ title }}</p>
    <small v-if="description" class="empty-state-description">{{ description }}</small>
    <div v-if="$slots.default" class="empty-state-actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
  color: var(--text-color-secondary);
}

.empty-state--sm {
  padding: 1rem;
}

.empty-state--lg {
  padding: 3rem;
}

.empty-state-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  opacity: 0.5;
}

.empty-state--sm .empty-state-icon {
  font-size: 1.5rem;
}

.empty-state--lg .empty-state-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state-title {
  margin: 0 0 0.25rem 0;
  font-weight: 500;
  color: var(--text-color-secondary);
}

.empty-state--lg .empty-state-title {
  font-size: 1.1rem;
}

.empty-state-description {
  opacity: 0.7;
  max-width: 300px;
}

.empty-state-actions {
  margin-top: 1rem;
}
</style>
