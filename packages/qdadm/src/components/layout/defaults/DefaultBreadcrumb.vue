<script setup lang="ts">
/**
 * DefaultBreadcrumb - Default breadcrumb component for BaseLayout
 *
 * Displays breadcrumb trail and optional navlinks.
 * Extracted from AppLayout for zone-based architecture.
 *
 * This is the default component rendered in the "breadcrumb" zone
 * when no blocks are registered.
 */
import { computed, inject, ref, type Ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useNavContext, type BreadcrumbItem, type NavLinkItem } from '../../../composables/useNavContext'
import Breadcrumb from 'primevue/breadcrumb'
import NavlinksGroup from '../NavlinksGroup.vue'

interface FeaturesConfig {
  breadcrumb?: boolean
  [key: string]: unknown
}

const route = useRoute()
const features = inject<FeaturesConfig>('qdadmFeatures', { breadcrumb: true })

// Navigation context (breadcrumb + navlinks from route config)
const { breadcrumb: defaultBreadcrumb, navlinks: defaultNavlinks, modeLinks } = useNavContext()

// Allow child pages to override breadcrumb/navlinks via provide/inject
const breadcrumbOverride = inject<Ref<BreadcrumbItem[] | null>>('qdadmBreadcrumbOverride', ref(null))
const navlinksOverride = inject<Ref<NavLinkItem[] | null>>('qdadmNavlinksOverride', ref(null))

// Use override if provided, otherwise default from useNavContext
const breadcrumbItems = computed<BreadcrumbItem[]>(() => breadcrumbOverride.value || defaultBreadcrumb.value)
const navlinks = computed<NavLinkItem[]>(() => navlinksOverride.value || defaultNavlinks.value)

// Show breadcrumb if enabled, has items, and not on home page
const showBreadcrumb = computed<boolean>(() => {
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

    <!-- Navlinks (provided by PageNav for child routes) + View↔Edit mode
         links (#1332/#1341/#1353) — shared rendering + dedup (#1357) -->
    <NavlinksGroup :navlinks="navlinks" :mode-links="modeLinks" variant="breadcrumb" />
  </div>
</template>

<style scoped>
/*
 * Only keep styles here that REQUIRE scoping (:deep, dynamic binding, component-specific overrides).
 * Generic/reusable styles belong in src/styles/ partials (see _forms.scss, _cards.scss, etc.).
 */
.default-breadcrumb {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  padding-bottom: 0;
}

/* Navlinks styles moved to NavlinksGroup.vue (#1357) */

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
