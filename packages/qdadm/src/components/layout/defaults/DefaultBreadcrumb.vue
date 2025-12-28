<script setup>
/**
 * DefaultBreadcrumb - Default breadcrumb component for BaseLayout
 *
 * Displays breadcrumb trail and optional navlinks.
 * Extracted from AppLayout for zone-based architecture.
 *
 * This is the default component rendered in the "breadcrumb" zone
 * when no blocks are registered.
 */
import { computed, inject, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useNavContext } from '../../../composables/useNavContext'
import Breadcrumb from 'primevue/breadcrumb'

const route = useRoute()
const features = inject('qdadmFeatures', { breadcrumb: true })

// Navigation context (breadcrumb + navlinks from route config)
const { breadcrumb: defaultBreadcrumb, navlinks: defaultNavlinks } = useNavContext()

// Allow child pages to override breadcrumb/navlinks via provide/inject
const breadcrumbOverride = inject('qdadmBreadcrumbOverride', ref(null))
const navlinksOverride = inject('qdadmNavlinksOverride', ref(null))

// Use override if provided, otherwise default from useNavContext
const breadcrumbItems = computed(() => breadcrumbOverride.value || defaultBreadcrumb.value)
const navlinks = computed(() => navlinksOverride.value || defaultNavlinks.value)

// Show breadcrumb if enabled, has items, and not on home page
const showBreadcrumb = computed(() => {
  if (!features.breadcrumb || breadcrumbItems.value.length === 0) return false
  // Don't show on home page (just "Dashboard" with no parents)
  if (route.name === 'dashboard') return false
  return true
})
</script>

<template>
  <div v-if="showBreadcrumb" class="default-breadcrumb">
    <Breadcrumb :model="breadcrumbItems" class="breadcrumb-component">
      <template #item="{ item }">
        <RouterLink v-if="item.to" :to="item.to" class="breadcrumb-link">
          <i v-if="item.icon" :class="item.icon"></i>
          <span>{{ item.label }}</span>
        </RouterLink>
        <span v-else class="breadcrumb-current">
          <i v-if="item.icon" :class="item.icon"></i>
          <span>{{ item.label }}</span>
        </span>
      </template>
    </Breadcrumb>

    <!-- Navlinks (provided by PageNav for child routes) -->
    <div v-if="navlinks.length > 0" class="breadcrumb-navlinks">
      <template v-for="(link, index) in navlinks" :key="link.to?.name || index">
        <span v-if="index > 0" class="navlinks-separator">|</span>
        <RouterLink
          :to="link.to"
          class="navlink"
          :class="{ 'navlink--active': link.active }"
        >
          {{ link.label }}
        </RouterLink>
      </template>
    </div>
  </div>
</template>

<style scoped>
.default-breadcrumb {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  padding-bottom: 0;
}

.breadcrumb-navlinks {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.navlinks-separator {
  color: var(--p-surface-400, #94a3b8);
}

.navlink {
  color: var(--p-primary-500, #3b82f6);
  text-decoration: none;
  transition: color 0.15s;
}

.navlink:hover {
  color: var(--p-primary-700, #1d4ed8);
  text-decoration: underline;
}

.navlink--active {
  color: var(--p-surface-700, #334155);
  font-weight: 500;
  pointer-events: none;
}

/* Override PrimeVue Breadcrumb styles for flat look */
.default-breadcrumb :deep(.p-breadcrumb) {
  background: transparent;
  border: none;
  padding: 0;
  border-radius: 0;
}

.default-breadcrumb :deep(.p-breadcrumb-list) {
  gap: 0.5rem;
}

.default-breadcrumb :deep(.p-breadcrumb-item-link),
.breadcrumb-link {
  color: var(--p-primary-500, #3b82f6);
  text-decoration: none;
  font-size: 0.875rem;
}

.default-breadcrumb :deep(.p-breadcrumb-item-link:hover),
.breadcrumb-link:hover {
  color: var(--p-primary-700, #1d4ed8);
  text-decoration: underline;
}

.breadcrumb-current {
  color: var(--p-surface-600, #475569);
  font-size: 0.875rem;
}

.default-breadcrumb :deep(.p-breadcrumb-separator) {
  color: var(--p-surface-400, #94a3b8);
}
</style>
