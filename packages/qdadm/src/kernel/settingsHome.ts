/**
 * The settings home (#5500): a page that gathers the settings menu, and the
 * root of every settings page's breadcrumb.
 *
 * - `settingsMenu.home: true` mounts qdadm's own page (`QdSettingsHome`, the
 *   settings menu's entries as cards, by section) as `settings-home`, on
 *   `/settings`, or `/settings-home` when the app already has a `/settings`;
 * - `settingsMenu.home: 'route-name'` names the app's own page instead.
 *
 * `settingsMenu.breadcrumb` says what a settings page's breadcrumb gets after
 * Home: `'section'` (default) the settings then the section, `'home'` the
 * settings only, `false` nothing.
 */
import type { RouteRecordRaw } from 'vue-router'

/** The name of qdadm's own settings home (`settingsMenu.home: true`) */
export const SETTINGS_HOME_ROUTE = 'settings-home'

export type SettingsBreadcrumb = 'section' | 'home' | false

export interface SettingsHomeConfig {
  home?: boolean | string
  breadcrumb?: SettingsBreadcrumb
}

/** The route the settings home is, or null when there is none */
export function settingsHomeRoute(config: SettingsHomeConfig | null | undefined): string | null {
  const home = config?.home
  if (home === true) return SETTINGS_HOME_ROUTE
  return typeof home === 'string' && home ? home : null
}

/** What a settings page's breadcrumb gets: nothing without a home */
export function settingsBreadcrumbMode(config: SettingsHomeConfig | null | undefined): SettingsBreadcrumb {
  if (!settingsHomeRoute(config)) return false
  const mode = config?.breadcrumb
  return mode === 'home' || mode === false ? mode : 'section'
}

const isDev = (): boolean => (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true

/**
 * qdadm's own settings home, under the layout, when `home: true`: on
 * `settings`, unless one of the app's routes already is (`taken`), then on
 * `settings-home`
 */
export function settingsHomeRecords(
  config: SettingsHomeConfig | null | undefined,
  taken: (path: string) => boolean,
  warn: (m: string) => void = console.warn
): RouteRecordRaw[] {
  if (config?.home !== true) return []
  let path = 'settings'
  if (taken(path)) {
    path = 'settings-home'
    if (isDev()) warn(`[qdadm] settingsMenu.home: the app has a route on /settings already; the settings home is on /${path}`)
  }
  return [{ path, name: SETTINGS_HOME_ROUTE, component: () => import('../components/pages/QdSettingsHome.vue') }]
}

/** A title for comparing: no case, no accents, no surrounding space */
const plain = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/** Two names that read the same (#5501): « Paramètres » and « parametres » */
export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && plain(a) === plain(b)
}

/** The anchor of a section on the settings home (#5501): `settings-<slug>` */
export function settingsSectionAnchor(title: string): string {
  const slug = plain(title).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `settings-${slug || 'section'}`
}
