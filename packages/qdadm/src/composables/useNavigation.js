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

import { computed, inject, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getNavSections, alterMenuSections, isMenuAltered } from '../module/moduleRegistry'
import { useSemanticBreadcrumb } from './useSemanticBreadcrumb'

/**
 * Navigation composable
 *
 * @returns {object} Navigation state and helpers
 * @property {import('vue').ComputedRef<Array>} navSections - Navigation sections (filtered by permissions)
 * @property {Function} isNavActive - Check if nav item is active
 * @property {Function} sectionHasActiveItem - Check if section has active item
 * @property {Function} handleNavClick - Handle nav item click
 * @property {import('vue').ComputedRef<string>} currentRouteName - Current route name
 * @property {import('vue').ComputedRef<string>} currentRoutePath - Current route path
 * @property {import('vue').Ref<boolean>} isReady - Whether menu:alter has completed
 */
export function useNavigation() {
  const route = useRoute()
  const router = useRouter()
  const orchestrator = inject('qdadmOrchestrator', null)
  const hooks = inject('qdadmHooks', null)

  // Semantic breadcrumb for entity-based active detection
  const { breadcrumb } = useSemanticBreadcrumb()

  // Track whether menu:alter has completed
  const isReady = ref(isMenuAltered())

  // Trigger version to force reactivity after alteration
  const alterVersion = ref(0)

  /**
   * Check if user can access a nav item based on its entity's canRead()
   */
  function canAccessNavItem(item) {
    if (!item.entity || !orchestrator) return true
    const manager = orchestrator.get(item.entity)
    if (!manager) return true
    return manager.canRead()
  }

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
    // eslint-disable-next-line no-unused-expressions
    alterVersion.value

    const sections = getNavSections()
    return sections
      .map(section => ({
        ...section,
        items: section.items.filter(item => canAccessNavItem(item))
      }))
      .filter(section => section.items.length > 0)  // Hide empty sections
  })

  /**
   * Check if a nav item is currently active
   * Uses semantic breadcrumb only - no route segment deduction
   */
  function isNavActive(item) {
    // Exact match mode
    if (item.exact) {
      return route.name === item.route
    }

    // Check semantic breadcrumb for match
    const bc = breadcrumb.value

    // Entity-based menu item: match ONLY by entity (don't fall through)
    if (item.entity) {
      const firstEntityItem = bc.find(b => b.kind.startsWith('entity-'))
      return firstEntityItem ? firstEntityItem.entity === item.entity : false
    }

    // Route-based menu item: check if route is in breadcrumb
    if (item.route) {
      return bc.some(b => b.kind === 'route' && b.route === item.route)
    }

    return false
  }

  /**
   * Check if section contains active item
   */
  function sectionHasActiveItem(section) {
    return section.items.some(item => isNavActive(item))
  }

  /**
   * Handle nav click - force navigation if on same route with query params
   */
  function handleNavClick(event, item) {
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
    currentRoutePath: computed(() => route.path)
  }
}
