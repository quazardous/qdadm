<script setup lang="ts">
/**
 * DefaultMenu - Default navigation menu for BaseLayout
 *
 * Displays sidebar navigation with collapsible sections.
 * Navigation items are auto-built from moduleRegistry.
 * Extracted from AppLayout for zone-based architecture.
 *
 * This is the default component rendered in the "menu" zone
 * when no blocks are registered.
 */
import { ref, watch, onMounted, computed, inject } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useNavigation, type NavSection } from '../../../composables/useNavigation'

interface AppConfig {
  shortName: string
  [key: string]: unknown
}

const route = useRoute()
const { navSections, isNavActive, sectionHasActiveItem, handleNavClick } = useNavigation()

// App config for storage key namespacing
const app = inject<AppConfig>('qdadmApp', { shortName: 'qdadm' })

// LocalStorage key for collapsed sections state
const STORAGE_KEY = computed<string>(() => `${app.shortName.toLowerCase()}_nav_collapsed`)

// Collapsed sections state (section title -> boolean)
const collapsedSections = ref<Record<string, boolean>>({})

/**
 * Load collapsed state from localStorage
 */
function loadCollapsedState(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY.value)
    if (stored) {
      collapsedSections.value = JSON.parse(stored) as Record<string, boolean>
    }
  } catch (e) {
    console.warn('Failed to load nav state:', e)
  }
}

/**
 * Save collapsed state to localStorage
 */
function saveCollapsedState(): void {
  try {
    localStorage.setItem(STORAGE_KEY.value, JSON.stringify(collapsedSections.value))
  } catch (e) {
    console.warn('Failed to save nav state:', e)
  }
}

/**
 * Toggle section collapsed state
 */
function toggleSection(sectionTitle: string): void {
  collapsedSections.value[sectionTitle] = !collapsedSections.value[sectionTitle]
  saveCollapsedState()
}

/**
 * Check if section should be shown expanded
 * - Never collapsed if it contains active item
 * - Otherwise respect user preference
 */
function isSectionExpanded(section: NavSection): boolean {
  if (sectionHasActiveItem(section)) {
    return true
  }
  const title = section.title || section.label || ''
  return !collapsedSections.value[title]
}

// Load state on mount
onMounted(() => {
  loadCollapsedState()
})

// Auto-expand section when navigating to an item in it
watch(() => route?.path, () => {
  if (!route) return
  for (const section of navSections.value) {
    const title = section.title || section.label || ''
    if (sectionHasActiveItem(section) && collapsedSections.value[title]) {
      // Auto-expand but don't save (user can collapse again if they want)
      collapsedSections.value[title] = false
    }
  }
})
</script>

<template>
  <!-- Use sidebar-nav class to inherit global nav-item styles from _sidebar.scss -->
  <nav class="sidebar-nav">
    <div v-for="section in navSections" :key="section.title || section.label" class="nav-section">
      <div
        class="nav-section-title"
        :class="{ 'nav-section-active': sectionHasActiveItem(section) }"
        @click="toggleSection(section.title || section.label || '')"
      >
        <span>{{ section.title }}</span>
        <i
          class="nav-section-chevron pi"
          :class="isSectionExpanded(section) ? 'pi-chevron-down' : 'pi-chevron-right'"
        ></i>
      </div>
      <div class="nav-section-items" :class="{ 'nav-section-collapsed': !isSectionExpanded(section) }">
        <RouterLink
          v-for="item in section.items"
          :key="item.route"
          :to="{ name: item.route }"
          class="nav-item"
          :class="{ 'nav-item-active': isNavActive(item) }"
          @click="handleNavClick($event, item)"
        >
          <i :class="item.icon"></i>
          <span>{{ item.label }}</span>
        </RouterLink>
      </div>
    </div>
  </nav>
</template>

<style scoped>
/* DefaultMenu uses sidebar-nav class to inherit global nav-item styles from _sidebar.scss
   Only component-specific styles remain here */

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0;
}

.nav-section {
  margin-bottom: 0.5rem;
}

.nav-section-title {
  padding: 0.5rem 1.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-surface-400, #94a3b8);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}

.nav-section-title:hover {
  color: var(--p-surface-200, #e2e8f0);
}

.nav-section-active {
  color: var(--p-primary-400, #60a5fa);
}

.nav-section-chevron {
  font-size: 0.625rem;
  transition: transform 0.2s;
}

.nav-section-items {
  max-height: 500px;
  overflow: hidden;
  transition: max-height 0.2s ease-out, opacity 0.15s;
}

.nav-section-collapsed {
  max-height: 0;
  opacity: 0;
}

/* Nav item styles are in _sidebar.scss (global styles)
   See .sidebar-nav .nav-item for base styles */
</style>
