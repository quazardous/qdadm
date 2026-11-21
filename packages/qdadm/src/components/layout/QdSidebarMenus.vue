<script setup lang="ts">
/**
 * QdSidebarMenus: the side menu's sections, collapsible, the current entry
 * marked; and, when the app declares one (#5401), the settings menu behind
 * the gear: the main menu slides up and the settings take its place, the
 * closed one inert. AppLayout and DefaultMenu draw it; the gear is theirs.
 *
 * The settings menu (#5410): no head row unless `settingsMenu.back` (then
 * "← Menu"), Escape takes it back to the gear; a section alone there has no
 * title (it would repeat the menu's name), unless `settingsMenu.flat` says
 * otherwise; its own colours (`--qd-settings-menu-*`) unless `tone: false`.
 */
import { computed, inject, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import type { NavSection } from '../../composables/useNavigation'
import { SETTINGS_MENU_IDS, type UseSettingsMenuReturn } from '../../composables/useSettingsMenu'
import { useI18n } from '../../i18n/useI18n'

const props = defineProps<{ settings: UseSettingsMenuReturn }>()

const route = useRoute() as ReturnType<typeof useRoute> | undefined
const { tOr } = useI18n()
const nav = props.settings.nav
const { isNavActive, sectionHasActiveItem, handleNavClick } = nav

// The sections each person folded, kept per app
const app = inject<{ shortName: string }>('qdadmApp', { shortName: 'qdadm' })
const STORAGE_KEY = computed(() => `${app.shortName.toLowerCase()}_nav_collapsed`)
const collapsedSections = ref<Record<string, boolean>>({})
onMounted(() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY.value)
    if (stored) collapsedSections.value = JSON.parse(stored) as Record<string, boolean>
  } catch (e) {
    console.warn('Failed to load nav state:', e)
  }
})
function toggleSection(title: string): void {
  collapsedSections.value[title] = !collapsedSections.value[title]
  try {
    localStorage.setItem(STORAGE_KEY.value, JSON.stringify(collapsedSections.value))
  } catch (e) {
    console.warn('Failed to save nav state:', e)
  }
}
const titleOf = (section: NavSection) => section.title || section.label || ''
type PaneKey = 'main' | 'settings'
/** The settings' sections have titles when there are several, unless flat says otherwise */
const titled = (pane: PaneKey, count: number) => pane === 'main' || (props.settings.flat === null ? count > 1 : !props.settings.flat)
/** Never folded while it holds the current entry; nor without a title to unfold it */
const isSectionExpanded = (section: NavSection, pane: PaneKey = 'main', count = 2) =>
  !titled(pane, count) || sectionHasActiveItem(section) || !collapsedSections.value[titleOf(section)]

// The section of the current page unfolds (not saved: the person may fold it again)
watch(
  () => route?.path,
  () => {
    for (const section of [...nav.navSections.value, ...nav.settingsSections.value]) {
      if (sectionHasActiveItem(section) && collapsedSections.value[titleOf(section)]) collapsedSections.value[titleOf(section)] = false
    }
  }
)

const panes = computed<{ key: PaneKey; id: string; sections: NavSection[] }[]>(() => [
  { key: 'main', id: SETTINGS_MENU_IDS.main, sections: nav.navSections.value },
  { key: 'settings', id: SETTINGS_MENU_IDS.settings, sections: nav.settingsSections.value },
])
const shownPane = computed(() => (props.settings.open.value ? 'settings' : 'main'))
</script>

<template>
  <div
    class="sidebar-menus"
    :class="{ 'sidebar-menus--two': settings.available.value, 'sidebar-menus--settings': settings.open.value }"
  >
    <template v-for="pane in panes" :key="pane.key">
      <nav
        v-if="pane.key === 'main' || settings.available.value"
        :id="pane.id"
        class="sidebar-nav"
        :class="[`sidebar-menu sidebar-menu--${pane.key}`, { 'sidebar-menu--toned': pane.key === 'settings' && settings.tone }]"
        :aria-label="pane.key === 'settings' ? settings.label : undefined"
        :inert="settings.available.value && pane.key !== shownPane ? true : undefined"
        :aria-hidden="settings.available.value && pane.key !== shownPane ? 'true' : undefined"
        :data-menu="pane.key"
        @keydown.esc="pane.key === 'settings' && settings.close()"
      >
        <!-- The settings' own head, when asked for: back to the main menu -->
        <button
          v-if="pane.key === 'settings' && settings.back"
          type="button"
          class="nav-item sidebar-menu-back"
          :aria-label="tOr('core.settingsMenu.back', 'Back to the menu')"
          :title="tOr('core.settingsMenu.back', 'Back to the menu')"
          data-settings-back
          @click="settings.close()"
        >
          <i class="pi pi-arrow-left" aria-hidden="true"></i>
          <span>{{ tOr('core.settingsMenu.menu', 'Menu') }}</span>
        </button>
        <div v-for="section in pane.sections" :key="titleOf(section)" class="nav-section">
          <div
            v-if="titled(pane.key, pane.sections.length)"
            class="nav-section-title"
            :class="{ 'nav-section-active': sectionHasActiveItem(section) }"
            @click="toggleSection(titleOf(section))"
          >
            <span>{{ section.title }}</span>
            <i class="nav-section-chevron pi" :class="isSectionExpanded(section, pane.key, pane.sections.length) ? 'pi-chevron-down' : 'pi-chevron-right'"></i>
          </div>
          <div class="nav-section-items" :class="{ 'nav-section-collapsed': !isSectionExpanded(section, pane.key, pane.sections.length) }">
            <template v-for="item in section.items" :key="item.route ?? item.href">
              <a v-if="item.href" :href="item.href" :target="item.target" :rel="item.rel" class="nav-item nav-item-link">
                <i :class="item.icon"></i>
                <span>{{ item.label }}</span>
                <span v-if="item.external" class="pi pi-external-link nav-item-external" aria-label="opens in a new tab"></span>
              </a>
              <RouterLink
                v-else
                :to="{ name: item.route }"
                class="nav-item"
                :class="{ 'nav-item-active': isNavActive(item) }"
                @click="handleNavClick($event, item)"
              >
                <i :class="item.icon"></i>
                <span>{{ item.label }}</span>
              </RouterLink>
            </template>
          </div>
        </div>
      </nav>
    </template>
  </div>
</template>
