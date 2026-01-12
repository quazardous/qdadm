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

import { computed, inject, ref, onMounted, type ComputedRef, type Ref } from 'vue'
import { useRoute, useRouter, type RouteLocationNormalized, type RouteLocationRaw } from 'vue-router'
import { getNavSections, alterMenuSections, isMenuAltered } from '../module/moduleRegistry'
import { useSemanticBreadcrumb, type SemanticBreadcrumbItem } from './useSemanticBreadcrumb'
import type { HookRegistry } from '../hooks/HookRegistry'

/**
 * Navigation item interface
 */
export interface NavItem {
  label: string
  route: string
  icon?: string
  entity?: string
  exact?: boolean
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
interface EntityManager {
  canRead: () => boolean
}

/**
 * Orchestrator interface
 */
interface Orchestrator {
  signals?: unknown
  get: (entityName: string) => EntityManager | null
}

/**
 * Return type for useNavigation
 */
export interface UseNavigationReturn {
  /** Navigation sections (filtered by permissions) */
  navSections: ComputedRef<NavSection[]>
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

  // Semantic breadcrumb for entity-based active detection
  const { breadcrumb } = useSemanticBreadcrumb()

  // Track whether menu:alter has completed
  const isReady = ref(isMenuAltered())

  // Trigger version to force reactivity after alteration or auth change
  const alterVersion = ref(0)

  /**
   * Check if user can access a nav item based on its entity's canRead()
   */
  function canAccessNavItem(item: NavItem): boolean {
    if (!item.entity || !orchestrator) return true
    const manager = orchestrator.get(item.entity)
    if (!manager) return true
    return manager.canRead()
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

  // Get nav sections from registry, filtering items based on permissions
  // Depends on alterVersion to trigger re-computation after alteration
  const navSections = computed(() => {
    // Force dependency on alterVersion for reactivity
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    alterVersion.value

    const sections = getNavSections()
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => canAccessNavItem(item)),
      }))
      .filter((section) => section.items.length > 0) // Hide empty sections
  })

  /**
   * Check if a nav item is currently active
   * Uses semantic breadcrumb only - no route segment deduction
   */
  function isNavActive(item: NavItem): boolean {
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
    if (route.name === item.route && Object.keys(route.query).length > 0) {
      event.preventDefault()
      router.push({ name: item.route })
    }
  }

  return {
    // Data (from moduleRegistry)
    navSections,

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
