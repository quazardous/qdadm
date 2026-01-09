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
import { computed, ref, watch, onMounted, onUnmounted, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getSiblingRoutes } from '../../module/moduleRegistry.js'
import { useOrchestrator } from '../../orchestrator/useOrchestrator.js'

// Inject override refs from AppLayout
const breadcrumbOverride = inject('qdadmBreadcrumbOverride', null)
const navlinksOverride = inject('qdadmNavlinksOverride', null)
const homeRouteName = inject('qdadmHomeRoute', null)

const props = defineProps({
  entity: { type: Object, default: null },
  parentEntity: { type: Object, default: null }
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
        items.push({
          label: manager.labelPlural || manager.name,
          to: { name: manager.routePrefix }
        })
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
    const parentLabel = parentData.value
      ? parentManager.getEntityLabel(parentData.value)
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
const navlinks = computed(() => {
  if (!parentConfig.value) return []

  const { entity: parentEntityName, param } = parentConfig.value
  const siblings = getSiblingRoutes(parentEntityName, param)

  // Build navlinks with current route params
  return siblings.map(siblingRoute => {
    const manager = siblingRoute.meta?.entity ? getManager(siblingRoute.meta.entity) : null
    const label = siblingRoute.meta?.navLabel || manager?.labelPlural || siblingRoute.name

    return {
      label,
      to: { name: siblingRoute.name, params: route.params },
      active: route.name === siblingRoute.name
    }
  })
})

// Also include parent "Details" link
const allNavlinks = computed(() => {
  if (!parentConfig.value) return []

  const { entity: parentEntityName, param, itemRoute } = parentConfig.value
  const parentId = route.params[param]
  const parentManager = getManager(parentEntityName)

  if (!parentManager) return navlinks.value

  const defaultSuffix = parentManager.readOnly ? '-show' : '-edit'
  const parentRouteName = itemRoute || `${parentManager.routePrefix}${defaultSuffix}`
  const isOnParentRoute = route.name === parentRouteName

  // Details link to parent item page
  const detailsLink = {
    label: 'Details',
    to: { name: parentRouteName, params: { id: parentId } },
    active: isOnParentRoute
  }

  return [detailsLink, ...navlinks.value]
})

// Sync breadcrumb and navlinks to AppLayout via provide/inject
watch(breadcrumbItems, (items) => {
  if (breadcrumbOverride) {
    breadcrumbOverride.value = items
  }
}, { immediate: true })

watch(allNavlinks, (links) => {
  if (navlinksOverride) {
    navlinksOverride.value = links
  }
}, { immediate: true })

// Clear overrides when component unmounts (so other pages get default breadcrumb)
onUnmounted(() => {
  if (breadcrumbOverride) {
    breadcrumbOverride.value = null
  }
  if (navlinksOverride) {
    navlinksOverride.value = null
  }
})
</script>

<template>
  <!-- PageNav provides data to AppLayout via inject, renders nothing -->
</template>
