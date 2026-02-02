<script setup lang="ts">
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
import { computed, watch, inject, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getSiblingRoutes, getChildRoutes, type ModuleRoute, type ParentConfig } from '../../module/moduleRegistry'
import { useOrchestrator } from '../../orchestrator/useOrchestrator.js'
import type { EntityManager } from '../../entity/EntityManager'
import type { EntityRecord } from '../../types'

interface NavLink {
  label: string
  to: { name: string | undefined; params: Record<string, unknown> }
  active: boolean
}

// Inject override ref from AppLayout
const navlinksOverride = inject<Ref<NavLink[] | null> | null>('qdadmNavlinksOverride', null)

const props = defineProps<{
  // Show "Details" link in navlinks (default: false since breadcrumb shows current page)
  showDetailsLink?: boolean
}>()

const route = useRoute()
const router = useRouter()
const { getManager } = useOrchestrator()

// Parent config from route meta
const parentConfig = computed<ParentConfig | undefined>(() => route.meta?.parent as ParentConfig | undefined)

/**
 * Get default item route for an entity manager
 * Checks which routes actually exist and returns the appropriate one:
 * - Prefers -edit if it exists (editable entity)
 * - Falls back to -show if -edit doesn't exist
 * - Returns null if neither exists
 */
function getDefaultItemRoute(manager: EntityManager<EntityRecord> | null): string | null {
  if (!manager) return null

  const editRoute = `${manager.routePrefix}-edit`
  const showRoute = `${manager.routePrefix}-show`

  // Check which routes actually exist and return the first available
  if (router.hasRoute(editRoute)) return editRoute
  if (router.hasRoute(showRoute)) return showRoute

  return null
}

// Sibling navlinks (routes with same parent)
const siblingNavlinks = computed<NavLink[]>(() => {
  if (!parentConfig.value) return []

  const { entity: parentEntityName, param } = parentConfig.value
  const siblings = getSiblingRoutes(parentEntityName, param)

  // Filter out action routes (create, edit) - they're not navigation tabs
  const navRoutes = siblings.filter((r: ModuleRoute) => {
    const name = r.name || ''
    const path = r.path || ''
    // Exclude routes ending with -create, -edit, -new or paths with /create, /edit, /new
    return !name.match(/-(create|edit|new)$/) && !path.match(/\/(create|edit|new)$/)
  })

  // Build navlinks with current route params
  return navRoutes.map((siblingRoute: ModuleRoute): NavLink => {
    const manager = siblingRoute.meta?.entity ? getManager(siblingRoute.meta.entity) : null
    const label = (siblingRoute.meta?.navLabel as string) || manager?.labelPlural || siblingRoute.name || ''

    return {
      label,
      to: { name: siblingRoute.name, params: route.params as Record<string, unknown> },
      active: route.name === siblingRoute.name
    }
  })
})

// Child navlinks (when on parent detail page, show links to children)
const childNavlinks = computed<NavLink[]>(() => {
  // Only when NOT on a child route (no parentConfig)
  if (parentConfig.value) return []

  const entityName = route.meta?.entity as string | undefined
  if (!entityName) return []

  // Get current entity's manager to determine idField
  const currentManager = getManager(entityName)
  const entityId = route.params[currentManager?.idField || 'id'] as string | undefined

  // Only show children when we have an entity ID (not on create pages)
  if (!entityId) return []

  const children = getChildRoutes(entityName)
  if (children.length === 0) return []

  // Filter out action routes (create, edit) - they're not navigation tabs
  const navRoutes = children.filter((r: ModuleRoute) => {
    const name = r.name || ''
    const path = r.path || ''
    return !name.match(/-(create|edit|new)$/) && !path.match(/\/(create|edit|new)$/)
  })

  if (navRoutes.length === 0) return []

  // Build navlinks to child routes
  return navRoutes.map((childRoute: ModuleRoute): NavLink => {
    const childManager = childRoute.meta?.entity ? getManager(childRoute.meta.entity) : null
    const label = (childRoute.meta?.navLabel as string) || childManager?.labelPlural || childRoute.name || ''
    const parentParam = (childRoute.meta?.parent as ParentConfig)?.param || currentManager?.idField || 'id'

    return {
      label,
      to: { name: childRoute.name, params: { [parentParam]: entityId } },
      active: false
    }
  })
})

// Combined navlinks with optional "Details" link
const allNavlinks = computed<NavLink[]>(() => {
  // Case 1: On a child route - show siblings + optional Details link to parent
  if (parentConfig.value) {
    const { entity: parentEntityName, param, itemRoute } = parentConfig.value
    const parentId = route.params[param] as string | undefined
    const parentManager = getManager(parentEntityName)

    // Guard: need valid manager and parentId to build links
    if (!parentManager || !parentId) return []

    // Details link is optional since breadcrumb already shows parent
    if (props.showDetailsLink) {
      const parentRouteName = itemRoute || getDefaultItemRoute(parentManager)
      const isOnParentRoute = route.name === parentRouteName

      // Details link to parent item page
      const detailsLink: NavLink = {
        label: 'Details',
        to: { name: parentRouteName ?? undefined, params: { [parentManager.idField]: parentId } },
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
      const detailsLink: NavLink = {
        label: 'Details',
        to: { name: route.name as string | undefined, params: route.params as Record<string, unknown> },
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
    navlinksOverride.value = links as NavLink[]
  }
}, { immediate: true })
</script>

<template>
  <!-- PageNav provides navlinks to AppLayout via inject, renders nothing -->
  <span v-if="false"></span>
</template>
