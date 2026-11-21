/**
 * useSettingsMenu (#5401): the side menu's second menu, the settings, behind
 * a gear. Open on a settings page by itself (a link, a reload), closed on a
 * page of the main menu; opened and closed by the gear or the back row, the
 * focus following: to the first entry of the menu opened, back to the gear.
 *
 *   const settings = useSettingsMenu()
 *   <QdSidebarMenus :settings="settings" />
 *   <button v-if="settings.available.value" :aria-expanded="settings.open.value" @click="settings.toggle()">
 */
import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import { useNavigation, type UseNavigationReturn } from './useNavigation'

/** The ids the side menu's parts carry, for aria-controls and the focus */
export const SETTINGS_MENU_IDS = {
  main: 'qd-menu-main',
  settings: 'qd-menu-settings',
  toggle: 'qd-settings-toggle',
} as const

export interface UseSettingsMenuReturn {
  nav: UseNavigationReturn
  /** There is a settings menu for this user */
  available: ComputedRef<boolean>
  /** The settings menu is the one shown */
  open: Ref<boolean>
  toggle: () => void
  /** Back to the main menu */
  close: () => void
  label: string
  icon: string
}

async function focusIn(id: string): Promise<void> {
  await nextTick()
  if (typeof document === 'undefined') return
  const el = document.getElementById(id)
  const target = el?.matches('button, a') ? el : el?.querySelector<HTMLElement>('a.nav-item')
  ;(target as HTMLElement | null | undefined)?.focus()
}

export function useSettingsMenu(given: UseNavigationReturn = useNavigation()): UseSettingsMenuReturn {
  // A navigation of its own (a test, an app's stand-in) may know nothing of the settings
  const nav: UseNavigationReturn = {
    ...given,
    settingsSections: given.settingsSections ?? computed(() => []),
    hasSettingsMenu: given.hasSettingsMenu ?? computed(() => false),
    settingsActive: given.settingsActive ?? computed(() => false),
    settingsMenu: given.settingsMenu ?? { label: 'Settings', icon: 'pi pi-cog' },
  }
  const route = useRoute() as ReturnType<typeof useRoute> | undefined
  const available = computed(() => nav.hasSettingsMenu.value)
  const open = ref(available.value && nav.settingsActive.value)

  // The page decides: a settings page opens the settings, a main page the main menu
  const follow = () => (open.value = available.value && nav.settingsActive.value)
  watch(() => route?.path, follow)
  watch(() => nav.settingsActive.value, follow)
  watch(available, (yes) => {
    if (!yes) open.value = false
  })

  function close(): void {
    if (!open.value) return
    open.value = false
    // Back to the gear; without it, to the main menu
    const gear = typeof document !== 'undefined' && document.getElementById(SETTINGS_MENU_IDS.toggle)
    void focusIn(gear ? SETTINGS_MENU_IDS.toggle : SETTINGS_MENU_IDS.main)
  }

  function toggle(): void {
    if (open.value) return close()
    if (!available.value) return
    open.value = true
    void focusIn(SETTINGS_MENU_IDS.settings)
  }

  return { nav, available, open, toggle, close, label: nav.settingsMenu.label, icon: nav.settingsMenu.icon }
}
