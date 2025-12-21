/**
 * useNavigation - Navigation composable for AppLayout
 *
 * Provides reactive navigation state from moduleRegistry.
 * All data comes from module init declarations.
 * Nav items are filtered based on EntityManager.canRead() permissions.
 */

import { computed, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getNavSections, isRouteInFamily } from '../module/moduleRegistry'

/**
 * Navigation composable
 */
export function useNavigation() {
  const route = useRoute()
  const router = useRouter()
  const orchestrator = inject('qdadmOrchestrator', null)

  /**
   * Check if user can access a nav item based on its entity's canRead()
   */
  function canAccessNavItem(item) {
    if (!item.entity || !orchestrator) return true
    const manager = orchestrator.get(item.entity)
    if (!manager) return true
    return manager.canRead()
  }

  // Get nav sections from registry, filtering items based on permissions
  const navSections = computed(() => {
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
   */
  function isNavActive(item) {
    const currentRouteName = route.name

    // Exact match mode
    if (item.exact) {
      return currentRouteName === item.route
    }

    // Use registry's family detection
    return isRouteInFamily(currentRouteName, item.route)
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
