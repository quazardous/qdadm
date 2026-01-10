<script setup>
/**
 * PageNav - Route-aware navigation provider for breadcrumb + navlinks
 *
 * This component doesn't render anything visible. Instead, it provides
 * breadcrumb items and navlinks to AppLayout via provide/inject.
 *
 * Layout (rendered in AppLayout):
 *   Books > "Dune"                    Details | Loans | Reviews
 *     ↑ breadcrumb (left)                   ↑ navlinks (right)
 *
 * Auto-detects from current route:
 * - Breadcrumb: parent chain from route.meta.parent
 * - Navlinks: sibling routes (same parent entity + param)
 *
 * Props:
 * - entity: Current entity data (for dynamic labels in breadcrumb)
 * - parentEntity: Parent entity data (for parent label in breadcrumb)
 */
import { computed, ref, watch, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getSiblingRoutes, getChildRoutes } from '../../module/moduleRegistry.js'
import { useOrchestrator } from '../../orchestrator/useOrchestrator.js'

// Inject override refs from AppLayout
const breadcrumbOverride = inject('qdadmBreadcrumbOverride', null)
const navlinksOverride = inject('qdadmNavlinksOverride', null)
const homeRouteName = inject('qdadmHomeRoute', null)
// Entity data set by useEntityItemPage via setBreadcrumbEntity
const breadcrumbEntities = inject('qdadmBreadcrumbEntities', null)

const props = defineProps({
  entity: { type: Object, default: null },
  parentEntity: { type: Object, default: null },
  // Show "Details" link in navlinks (default: false since breadcrumb shows current page)
  showDetailsLink: { type: Boolean, default: false }
})

const route = useRoute()
const router = useRouter()
const { getManager } = useOrchestrator()

// Parent config from route meta
const parentConfig = computed(() => route.meta?.parent)

// Parent entity data (loaded if not provided via prop)
const parentData = ref(props.parentEntity)

// Load parent entity if needed
watch(() => [parentConfig.value, route.params], async () => {
  if (!parentConfig.value || props.parentEntity) return

  const { entity: parentEntityName, param } = parentConfig.value
  const parentId = route.params[param]

  if (parentEntityName && parentId) {
    try {
      const manager = getManager(parentEntityName)
      if (manager) {
        parentData.value = await manager.get(parentId)
      }
    } catch (e) {
      console.warn('[PageNav] Failed to load parent entity:', e)
    }
  }
}, { immediate: true })

// Home breadcrumb item
const homeItem = computed(() => {
  if (!homeRouteName) return null
  const routes = router.getRoutes()
  if (!routes.some(r => r.name === homeRouteName)) return null
  const label = homeRouteName === 'dashboard' ? 'Dashboard' : 'Home'
  return { label, to: { name: homeRouteName }, icon: 'pi pi-home' }
})

// Build breadcrumb items
const breadcrumbItems = computed(() => {
  const items = []

  // Always start with Home if configured
  if (homeItem.value) {
    items.push(homeItem.value)
  }

  if (!parentConfig.value) {
    // No parent - use simple breadcrumb from entity
    const entityName = route.meta?.entity
    if (entityName) {
      const manager = getManager(entityName)
      if (manager) {
        // Entity list link
        items.push({
          label: manager.labelPlural || manager.name,
          to: { name: manager.routePrefix }
        })

        // If on detail page (has :id param), add current entity item
        const entityId = route.params.id
        if (entityId) {
          // Get entity data from props or from breadcrumbEntities (set by useEntityItemPage)
          const entityData = props.entity || breadcrumbEntities?.value?.get(1)
          const entityLabel = entityData
            ? manager.getEntityLabel(entityData)
            : '...'
          items.push({ label: entityLabel })
        }
      }
    }
    return items
  }

  // Has parent - build parent chain
  const { entity: parentEntityName, param, itemRoute } = parentConfig.value
  const parentId = route.params[param]
  const parentManager = getManager(parentEntityName)

  if (parentManager) {
    // Parent list
    items.push({
      label: parentManager.labelPlural || parentManager.name,
      to: { name: parentManager.routePrefix }
    })

    // Parent item (with label from data)
    // Prefer breadcrumbEntities (set by useEntityItemPage) over local parentData
    const parentEntityData = breadcrumbEntities?.value?.get(1) || parentData.value
    const parentLabel = parentEntityData
      ? parentManager.getEntityLabel(parentEntityData)
      : '...'
    const defaultSuffix = parentManager.readOnly ? '-show' : '-edit'
    const parentRouteName = itemRoute || `${parentManager.routePrefix}${defaultSuffix}`

    items.push({
      label: parentLabel,
      to: { name: parentRouteName, params: { id: parentId } }
    })
  }

  // Current entity (last item, no link)
  const currentLabel = route.meta?.navLabel
  if (currentLabel) {
    items.push({ label: currentLabel })
  }

  return items
})

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

  const children = getChildRoutes(entityName)
  if (children.length === 0) return []

  // Filter out action routes (create, edit) - they're not navigation tabs
  const navRoutes = children.filter(r => {
    const name = r.name || ''
    const path = r.path || ''
    return !name.match(/-(create|edit|new)$/) && !path.match(/\/(create|edit|new)$/)
  })

  if (navRoutes.length === 0) return []

  const entityId = route.params.id

  // Build navlinks to child routes
  return navRoutes.map(childRoute => {
    const childManager = childRoute.meta?.entity ? getManager(childRoute.meta.entity) : null
    const label = childRoute.meta?.navLabel || childManager?.labelPlural || childRoute.name
    const parentParam = childRoute.meta?.parent?.param || 'id'

    return {
      label,
      to: { name: childRoute.name, params: { [parentParam]: entityId } },
      active: false
    }
  })
})

// Combined navlinks with "Details" link
const allNavlinks = computed(() => {
  // Case 1: On a child route - show siblings + optional Details link to parent
  if (parentConfig.value) {
    const { entity: parentEntityName, param, itemRoute } = parentConfig.value
    const parentId = route.params[param]
    const parentManager = getManager(parentEntityName)

    if (!parentManager) return siblingNavlinks.value

    // Details link is optional since breadcrumb already shows parent
    if (props.showDetailsLink) {
      const defaultSuffix = parentManager.readOnly ? '-show' : '-edit'
      const parentRouteName = itemRoute || `${parentManager.routePrefix}${defaultSuffix}`
      const isOnParentRoute = route.name === parentRouteName

      // Details link to parent item page
      // CONVENTION: Entity item routes MUST use :id as param name (e.g., /books/:id)
      const detailsLink = {
        label: 'Details',
        to: { name: parentRouteName, params: { id: parentId } },
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

// Sync breadcrumb and navlinks to AppLayout via provide/inject
// Watch computed values + route changes + entity data to ensure updates
watch([breadcrumbItems, () => route.fullPath, breadcrumbEntities], ([items]) => {
  if (breadcrumbOverride) {
    breadcrumbOverride.value = items
  }
}, { immediate: true, deep: true })

watch([allNavlinks, () => route.fullPath], ([links]) => {
  if (navlinksOverride) {
    navlinksOverride.value = links
  }
}, { immediate: true })

// Note: We intentionally do NOT clear overrides in onUnmounted.
// When navigating between routes, the new PageNav's watch will overwrite the values.
// Clearing in onUnmounted causes a race condition where the old PageNav clears
// AFTER the new PageNav has already set its values.
</script>

<template>
  <!-- PageNav provides data to AppLayout via inject, renders nothing -->
</template>
