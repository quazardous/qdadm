<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
/**
 * Breadcrumb - Navigation breadcrumb component
 *
 * Props:
 * - items: Array of { label, to?, icon? }
 *
 * Last item is always rendered as current page (no link)
 */
import { RouterLink, type RouteLocationRaw } from 'vue-router'

interface BreadcrumbItem {
  label: string
  to?: RouteLocationRaw
  icon?: string
}

withDefaults(defineProps<{
  items?: BreadcrumbItem[]
}>(), {
  items: () => []
})
</script>

<template>
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <ol class="breadcrumb-list">
      <li
        v-for="(item, index) in items"
        :key="index"
        class="breadcrumb-item"
        :class="{ 'is-current': index === items.length - 1 }"
      >
        <template v-if="index > 0">
          <i class="pi pi-chevron-right breadcrumb-separator" ></i>
        </template>

        <RouterLink
          v-if="item.to && index < items.length - 1"
          :to="item.to"
          class="breadcrumb-link"
        >
          <i v-if="item.icon" :class="item.icon" ></i>
          <span>{{ item.label }}</span>
        </RouterLink>

        <span v-else class="breadcrumb-text">
          <i v-if="item.icon" :class="item.icon" ></i>
          <span>{{ item.label }}</span>
        </span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.breadcrumb {
  margin-bottom: 0.5rem;
}

.breadcrumb-list {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.875rem;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.breadcrumb-separator {
  font-size: 0.75rem;
  color: var(--p-text-muted-color, #888);
}

.breadcrumb-link {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--p-primary-color, #3b82f6);
  text-decoration: none;
  transition: color 0.2s;
}

.breadcrumb-link:hover {
  color: var(--p-primary-hover-color, #2563eb);
  text-decoration: underline;
}

.breadcrumb-link i {
  font-size: 0.875rem;
}

.breadcrumb-text {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--p-text-muted-color, #888);
}

.breadcrumb-item.is-current .breadcrumb-text {
  color: var(--p-text-color, #333);
  font-weight: 500;
}
</style>
