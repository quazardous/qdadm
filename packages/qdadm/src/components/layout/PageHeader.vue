<script setup>
/**
 * PageHeader - Reusable page header with breadcrumb, title and actions
 *
 * Props:
 * - title: Page title (required)
 * - breadcrumb: Array of { label, to?, icon? } - optional breadcrumb items
 *
 * Slots:
 * - subtitle: Optional content next to title
 * - actions: Action buttons on the right
 */
import Breadcrumb from './Breadcrumb.vue'

defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: null
  },
  breadcrumb: {
    type: Array,
    default: null
  }
})
</script>

<template>
  <div class="page-header">
    <div class="page-header-content">
      <Breadcrumb v-if="breadcrumb?.length" :items="breadcrumb" />
      <div class="page-header-row">
        <div class="page-header-left">
          <div>
            <h1 class="page-title">{{ title }}</h1>
            <p v-if="subtitle" class="page-subtitle">{{ subtitle }}</p>
          </div>
          <slot name="subtitle" ></slot>
        </div>
        <div class="header-actions">
          <slot name="actions" ></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.page-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.page-subtitle {
  margin: 0.25rem 0 0 0;
  font-size: 0.875rem;
  color: var(--p-text-secondary);
}
</style>
