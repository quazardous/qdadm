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
import { useNavigation } from '../../../composables/useNavigation'
import { useSettingsMenu, SETTINGS_MENU_IDS } from '../../../composables/useSettingsMenu'
import { useI18n } from '../../../i18n/useI18n'
import QdSidebarMenus from '../QdSidebarMenus.vue'

// The sections, and the settings menu behind the gear at the bottom (#5401)
const settingsMenu = useSettingsMenu(useNavigation())
const { tOr } = useI18n()
</script>

<template>
  <div class="default-menu">
    <QdSidebarMenus :settings="settingsMenu" />
    <button
      v-if="settingsMenu.available.value"
      :id="SETTINGS_MENU_IDS.toggle"
      type="button"
      class="sidebar-settings-toggle"
      :class="{ 'sidebar-settings-toggle--open': settingsMenu.open.value }"
      :aria-expanded="settingsMenu.open.value ? 'true' : 'false'"
      :aria-controls="SETTINGS_MENU_IDS.settings"
      :aria-label="settingsMenu.open.value ? tOr('core.settingsMenu.back', 'Back to the menu') : settingsMenu.label"
      data-settings-toggle
      @click="settingsMenu.toggle()"
    >
      <i :class="settingsMenu.open.value ? 'pi pi-arrow-left' : settingsMenu.icon" aria-hidden="true"></i>
      <span>{{ settingsMenu.open.value ? tOr('core.settingsMenu.back', 'Back to the menu') : settingsMenu.label }}</span>
    </button>
  </div>
</template>

<style scoped>
/*
 * Only keep styles here that REQUIRE scoping (:deep, dynamic binding, component-specific overrides).
 * Generic/reusable styles belong in src/styles/ partials (see _forms.scss, _cards.scss, etc.).
 */
/* The menus fill the zone; the gear sits at their foot */
.default-menu {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* DefaultMenu uses sidebar-nav class to inherit global nav-item styles from _sidebar.scss
   Only component-specific styles remain here */

.default-menu :deep(.sidebar-nav) {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0;
}

.default-menu :deep(.nav-section) {
  margin-bottom: 0.5rem;
}

.default-menu :deep(.nav-section-title) {
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

.default-menu :deep(.nav-section-title:hover) {
  color: var(--p-surface-200, #e2e8f0);
}

.default-menu :deep(.nav-section-active) {
  color: var(--p-primary-400, #60a5fa);
}

.default-menu :deep(.nav-section-chevron) {
  font-size: 0.625rem;
  transition: transform 0.2s;
}

.default-menu :deep(.nav-section-items) {
  max-height: 500px;
  overflow: hidden;
  transition: max-height 0.2s ease-out, opacity 0.15s;
}

.default-menu :deep(.nav-section-collapsed) {
  max-height: 0;
  opacity: 0;
}

/* Nav item styles are in _sidebar.scss (global styles)
   See .sidebar-nav .nav-item for base styles */
</style>
