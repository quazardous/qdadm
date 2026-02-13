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
