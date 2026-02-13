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
