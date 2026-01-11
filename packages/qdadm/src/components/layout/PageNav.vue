<script setup>
/**
 * PageNav - Navigation provider for navlinks (child/sibling routes)
 *
 * This component provides navlinks to AppLayout via provide/inject.
 * Breadcrumb is now handled automatically by useNavContext + activeStack.
 *
 * Layout (rendered in AppLayout):
 *   Books > "Dune"                    Details | Loans | Reviews
 *     ↑ breadcrumb (from useNavContext)      ↑ navlinks (from PageNav)
 *
 * Auto-detects from current route:
 * - Navlinks: sibling routes (same parent entity + param) or children routes
 *
 * Props:
 * - showDetailsLink: Show "Details" link in navlinks (default: false)
 */
import { computed, watch, inject } from 'vue'
import { useRoute } from 'vue-router'
import { getSiblingRoutes, getChildRoutes } from '../../module/moduleRegistry.js'
import { useOrchestrator } from '../../orchestrator/useOrchestrator.js'

// Inject override ref from AppLayout
const navlinksOverride = inject('qdadmNavlinksOverride', null)

const props = defineProps({
  // Show "Details" link in navlinks (default: false since breadcrumb shows current page)
  showDetailsLink: { type: Boolean, default: false }
})

const route = useRoute()
const { getManager } = useOrchestrator()

// Parent config from route meta
const parentConfig = computed(() => route.meta?.parent)

/**
 * Get default item route for an entity manager
 * - Read-only entities: use -show suffix
 * - Editable entities: use -edit suffix
 */
function getDefaultItemRoute(manager) {
  if (!manager) return null
  const suffix = manager.readOnly ? '-show' : '-edit'
  return `${manager.routePrefix}${suffix}`
}

// Sibling navlinks (routes with same parent)
const siblingNavlinks = computed(() => {
  if (!parentConfig.value) return []

  const { entity: parentEntityName, param } = parentConfig.value
  const siblings = getSiblingRoutes(parentEntityName, param)

  // Filter out action routes (create, edit) - they're not navigation tabs
  const navRoutes = siblings.filter(r => {
    const name = r.name || ''
    const path = r.path || ''
    // Exclude routes ending with -create, -edit, -new or paths with /create, /edit, /new
    return !name.match(/-(create|edit|new)$/) && !path.match(/\/(create|edit|new)$/)
  })

  // Build navlinks with current route params
  return navRoutes.map(siblingRoute => {
    const manager = siblingRoute.meta?.entity ? getManager(siblingRoute.meta.entity) : null
    const label = siblingRoute.meta?.navLabel || manager?.labelPlural || siblingRoute.name

    return {
      label,
      to: { name: siblingRoute.name, params: route.params },
      active: route.name === siblingRoute.name
    }
  })
})

// Child navlinks (when on parent detail page, show links to children)
const childNavlinks = computed(() => {
  // Only when NOT on a child route (no parentConfig)
  if (parentConfig.value) return []

  const entityName = route.meta?.entity
  if (!entityName) return []

  // Get current entity's manager to determine idField
  const currentManager = getManager(entityName)
  const entityId = route.params[currentManager?.idField || 'id']

  // Only show children when we have an entity ID (not on create pages)
  if (!entityId) return []

  const children = getChildRoutes(entityName)
  if (children.length === 0) return []

  // Filter out action routes (create, edit) - they're not navigation tabs
  const navRoutes = children.filter(r => {
    const name = r.name || ''
    const path = r.path || ''
    return !name.match(/-(create|edit|new)$/) && !path.match(/\/(create|edit|new)$/)
  })

  if (navRoutes.length === 0) return []

  // Build navlinks to child routes
  return navRoutes.map(childRoute => {
    const childManager = childRoute.meta?.entity ? getManager(childRoute.meta.entity) : null
    const label = childRoute.meta?.navLabel || childManager?.labelPlural || childRoute.name
    const parentParam = childRoute.meta?.parent?.param || currentManager?.idField || 'id'

    return {
      label,
      to: { name: childRoute.name, params: { [parentParam]: entityId } },
      active: false
    }
  })
})

// Combined navlinks with optional "Details" link
const allNavlinks = computed(() => {
  // Case 1: On a child route - show siblings + optional Details link to parent
  if (parentConfig.value) {
    const { entity: parentEntityName, param, itemRoute } = parentConfig.value
    const parentId = route.params[param]
    const parentManager = getManager(parentEntityName)

    // Guard: need valid manager and parentId to build links
    if (!parentManager || !parentId) return []

    // Details link is optional since breadcrumb already shows parent
    if (props.showDetailsLink) {
      const parentRouteName = itemRoute || getDefaultItemRoute(parentManager)
      const isOnParentRoute = route.name === parentRouteName

      // Details link to parent item page
      const detailsLink = {
        label: 'Details',
        to: { name: parentRouteName, params: { [parentManager.idField]: parentId } },
        active: isOnParentRoute
      }

      return [detailsLink, ...siblingNavlinks.value]
    }

    return siblingNavlinks.value
  }

  // Case 2: On parent detail page - show children + optional Details (active)
  if (childNavlinks.value.length > 0) {
    // Details link is optional since breadcrumb already shows current page
    if (props.showDetailsLink) {
      const detailsLink = {
        label: 'Details',
        to: { name: route.name, params: route.params },
        active: true
      }
      return [detailsLink, ...childNavlinks.value]
    }
    return childNavlinks.value
  }

  return []
})

// Sync navlinks to AppLayout via provide/inject
watch([allNavlinks, () => route.fullPath], ([links]) => {
  if (navlinksOverride) {
    navlinksOverride.value = links
  }
}, { immediate: true })
</script>

<template>
  <!-- PageNav provides navlinks to AppLayout via inject, renders nothing -->
</template>
