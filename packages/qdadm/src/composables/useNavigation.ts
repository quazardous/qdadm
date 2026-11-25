/**
 * useNavigation - Navigation composable for AppLayout
 *
 * Provides reactive navigation state from moduleRegistry.
 * All data comes from module init declarations.
 * Nav items are filtered based on EntityManager.canRead() permissions.
 *
 * Invokes 'menu:alter' hook on first access to allow modules to modify
 * the navigation structure dynamically.
 */

import { routePermissions } from '../security/routeAccess'
import { computed, inject, ref, onMounted, type ComputedRef, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getNavSections, alterMenuSections, isMenuAltered } from '../module/moduleRegistry'
import { useSemanticBreadcrumb } from './useSemanticBreadcrumb'
import { useAuth } from './useAuth'
import { useI18n } from '../i18n/useI18n'
import type { HookRegistry } from '../hooks/HookRegistry'
import type { OrchestratorLike } from '../entity/EntityManager.interface'
import { leaveDomain } from '../domain/keep'
import { settingsHomeRoute, settingsBreadcrumbMode, type SettingsBreadcrumb, type SettingsHomeConfig } from '../kernel/settingsHome'

// #1191 — shared minimal structural view (was: local redeclaration)
type Orchestrator = OrchestratorLike


/**
 * Navigation item interface
 */
export interface NavItem {
  label: string
  route?: string
  /**
   * A link out of the app instead of a route (#3675) — exactly one of `route`
   * and `href`. An absolute URL opens in a new tab unless `target` says otherwise.
   */
  href?: string
  /** Where an `href` entry opens: default `_blank` for an absolute URL, same tab otherwise. */
  target?: string
  /** The entry is shown only to whoever is granted this attribute (`route` or `href`). */
  permission?: string
  /** Set on `href` entries by `navSections`: opens outside the app in another tab. */
  external?: boolean
  rel?: string
  icon?: string
  entity?: string
  exact?: boolean
  /** The menu it belongs to (#5401): the main one, or the settings behind the gear */
  menu?: 'main' | 'settings'
}

/**
 * Navigation section interface
 */
export interface NavSection {
  label?: string
  title?: string
  items: NavItem[]
}

/**
 * Entity manager interface
 */

/**
 * Orchestrator interface
 */

/**
 * Return type for useNavigation
 */
/** The settings menu's name, icon and look (#5401, #5410) */
export interface SettingsMenuLook {
  label: string
  icon: string
  /** A "← Menu" row at its head */
  back: boolean
  /** No section titles (#5418: drawn by default, even a lone one's) */
  flat: boolean
  /** Its own colours (`--qd-settings-menu-*`) */
  tone: boolean
  /** The settings home's route (#5500), or null */
  home: string | null
  /** What a settings page's breadcrumb gets after Home (#5500) */
  breadcrumb: SettingsBreadcrumb
}

export interface UseNavigationReturn {
  /** The main menu's sections (filtered by permissions) */
  navSections: ComputedRef<NavSection[]>
  /** The settings menu's sections, behind the gear (#5401); empty for whoever may not see it */
  settingsSections: ComputedRef<NavSection[]>
  /** There is a settings menu for this user */
  hasSettingsMenu: ComputedRef<boolean>
  /** The page on screen is one of the settings menu's, or its home */
  settingsActive: ComputedRef<boolean>
  /** The settings section holding the page on screen (#5500), or null */
  settingsSection: ComputedRef<NavSection | null>
  /** The settings menu's name, icon and look (`features.settingsMenu`) */
  settingsMenu: SettingsMenuLook
  /** Whether menu:alter has completed */
  isReady: Ref<boolean>
  /** Check if nav item is active */
  isNavActive: (item: NavItem) => boolean
  /** Check if section has active item */
  sectionHasActiveItem: (section: NavSection) => boolean
  /** Handle nav item click */
  handleNavClick: (event: Event, item: NavItem) => void
  /** Current route name */
  currentRouteName: ComputedRef<string | symbol | null | undefined>
  /** Current route path */
  currentRoutePath: ComputedRef<string>
}

/**
 * Navigation composable
 *
 * @returns Navigation state and helpers
 */
export function useNavigation(): UseNavigationReturn {
  const route = useRoute()
  const router = useRouter()
  const orchestrator = inject<Orchestrator | null>('qdadmOrchestrator', null)
  const hooks = inject<HookRegistry | null>('qdadmHooks', null)
  // null default: an app without security shows every link (#3675).
  const securityChecker = inject<{ isGranted(attribute: string, subject?: unknown): boolean } | null>('qdadmSecurityChecker', null)

  // i18n integration — labels resolve through nav.sections.* / nav.routes.*
  const { i18n: kernelI18n, locale: i18nLocale } = useI18n()

  // Semantic breadcrumb for entity-based active detection
  const { breadcrumb } = useSemanticBreadcrumb()

  // Track whether menu:alter has completed
  const isReady = ref(isMenuAltered())

  // Trigger version to force reactivity after alteration or auth change
  const alterVersion = ref(0)

  /**
   * Check if user can access a nav item: canList() when it opens a list route, canRead() otherwise
   */
  function canAccessNavItem(item: NavItem): boolean {
    // Its own permission, on any entry (#3675, #4318): a link out has nothing
    // else to check, a route entry no longer needs `entity` to follow rights.
    // Without one, a route entry takes its route's (#4332), so the menu shows
    // what the router guard lets through.
    const permissions = item.permission ?? (item.route ? routePermission(item.route) : undefined)
    const required = (Array.isArray(permissions) ? permissions : [permissions]).filter((p): p is string => !!p)
    if (securityChecker && required.some((p) => !securityChecker.isGranted(p))) return false
    if (item.href || !item.entity || !orchestrator) return true
    const manager = orchestrator.get(item.entity)
    if (!manager) return true
    // A menu entry is shown to whoever may do what its page does (#2497): a
    // ctx.crud() entry opens a list, so it follows `list`. A route that
    // declares no action, or is not registered, keeps `read`.
    if (item.route && routeAction(item.route) === 'list' && manager.canList) return manager.canList()
    return manager.canRead()
  }

  function routePermission(name: string): string | string[] | undefined {
    try {
      // The same reading as the router guard and PageNav (#4962)
      return routePermissions(router.resolve({ name }))
    } catch {
      return undefined
    }
  }

  function routeAction(name: string): string | undefined {
    try {
      return router.resolve({ name }).meta?.entityAction as string | undefined
    } catch {
      return undefined
    }
  }

  // Note: Auth signal listeners removed - Kernel.invalidateApp() remounts entire app
  // on auth changes, so composable is re-initialized with fresh state

  // Invoke menu:alter hook on mount
  onMounted(async () => {
    if (!isMenuAltered()) {
      await alterMenuSections(hooks)
      alterVersion.value++
      isReady.value = true
    }
  })

  /**
   * A link out of the app as the renderers draw it (#3675): an absolute URL
   * opens in a new tab, without handing it this window.
   */
  function linkItem(item: NavItem): NavItem {
    const absolute = /^([a-z][a-z\d+.-]*:|\/\/)/i.test(item.href!)
    const target = item.target ?? (absolute ? '_blank' : undefined)
    return {
      ...item,
      ...(target ? { target } : {}),
      external: target === '_blank',
      ...(target === '_blank' ? { rel: 'noopener noreferrer' } : {}),
    }
  }

  /**
   * Resolve a label through i18n with the given convention key, falling back
   * to the inline label when the bundle has no matching translation.
   */
  function resolveNavLabel(key: string, fallback: string): string {
    if (!kernelI18n) return fallback
    const trace = kernelI18n.resolve(key)
    return trace.hit ? trace.result : fallback
  }

  // Get nav sections from registry, filtering items based on permissions
  // Depends on alterVersion + i18nLocale to trigger re-computation after
  // alteration or locale change.
  // The settings menu (#5401): its entries say `menu: 'settings'`; the app
  // may narrow who sees it beyond its entries' permissions
  const features = inject<{ settingsMenu?: { visible?: (user: unknown) => boolean; label?: string; icon?: string; sections?: string[]; back?: boolean; flat?: boolean; tone?: boolean } & SettingsHomeConfig } | null>('qdadmFeatures', null)
  const { user } = useAuth()
  const settingsConfig = features?.settingsMenu ?? {}
  const settingsSectionNames = new Set(settingsConfig.sections ?? [])
  const settingsAllowed = computed(() => {
    if (typeof settingsConfig.visible !== 'function') return true
    try {
      return !!settingsConfig.visible(user.value)
    } catch {
      return false
    }
  })

  const sectionsOf = (menu: 'main' | 'settings') => {
    // Force dependencies for reactivity
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    alterVersion.value
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    i18nLocale.value

    const sections = getNavSections()
    return sections
      .map((section) => ({
        ...section,
        title: resolveNavLabel(`nav.sections.${section.title}`, section.title),
        items: section.items
          // An entry's own `menu`, else its section's (`settingsMenu.sections`)
          .filter((item) => (item.menu ?? (settingsSectionNames.has(section.title) ? 'settings' : 'main')) === menu)
          .filter((item) => canAccessNavItem(item))
          .map((item) => (item.href ? linkItem(item) : {
            ...item,
            label: resolveNavLabel(`nav.routes.${item.route}`, item.label),
          })),
      }))
      .filter((section) => section.items.length > 0) // Hide empty sections
  }
  const navSections = computed(() => sectionsOf('main'))
  const settingsSections = computed(() => (settingsAllowed.value ? sectionsOf('settings') : []))
  const hasSettingsMenu = computed(() => settingsSections.value.length > 0)

  /**
   * Check if a nav item is currently active
   * Uses semantic breadcrumb only - no route segment deduction
   */
  function isNavActive(item: NavItem): boolean {
    // A link out never stands for the page on screen (#3675).
    if (item.href) return false
    // Exact match mode
    if (item.exact) {
      return route.name === item.route
    }

    // Check semantic breadcrumb for match
    const bc = breadcrumb.value

    // Entity-based menu item: match ONLY by entity (don't fall through)
    if (item.entity) {
      const firstEntityItem = bc.find((b) => b.kind.startsWith('entity-'))
      return firstEntityItem ? firstEntityItem.entity === item.entity : false
    }

    // Route-based menu item: check if route is in breadcrumb
    if (item.route) {
      return bc.some((b) => b.kind === 'route' && b.route === item.route)
    }

    return false
  }

  /**
   * Check if section contains active item
   */
  function sectionHasActiveItem(section: NavSection): boolean {
    return section.items.some((item) => isNavActive(item))
  }

  /**
   * Handle nav click - force navigation if on same route with query params
   */
  function handleNavClick(event: Event, item: NavItem): void {
    if (item.href) return
    // A side menu entry leaves the domain kept from page to page (#5412)
    leaveDomain()
    if (route.name === item.route && Object.keys(route.query).length > 0) {
      event.preventDefault()
      router.push({ name: item.route })
    }
  }

  const settingsHome = settingsHomeRoute(settingsConfig)
  const settingsSection = computed(() => settingsSections.value.find((section) => sectionHasActiveItem(section)) ?? null)
  const settingsActive = computed(() =>
    (!!settingsHome && route.name === settingsHome && settingsAllowed.value) || settingsSection.value !== null
  )

  return {
    // Data (from moduleRegistry)
    navSections,
    settingsSections,
    hasSettingsMenu,
    settingsActive,
    settingsSection,
    settingsMenu: {
      label: settingsConfig.label ?? resolveNavLabel('core.settingsMenu.label', 'Settings'),
      icon: settingsConfig.icon ?? 'pi pi-cog',
      back: settingsConfig.back === true,
      flat: settingsConfig.flat === true,
      tone: settingsConfig.tone !== false,
      home: settingsHome,
      breadcrumb: settingsBreadcrumbMode(settingsConfig),
    },

    // Ready state (menu:alter completed)
    isReady,

    // Active state
    isNavActive,
    sectionHasActiveItem,

    // Event handlers
    handleNavClick,

    // Current route info (reactive)
    currentRouteName: computed(() => route.name),
    currentRoutePath: computed(() => route.path),
  }
}
