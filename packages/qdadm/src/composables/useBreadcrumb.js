import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * useBreadcrumb - Auto-generate breadcrumb from route hierarchy
 *
 * Generates breadcrumb items automatically from:
 * 1. route.meta.breadcrumb if defined (manual override)
 * 2. Route path segments with smart label generation
 *
 * Usage:
 * const { breadcrumbItems } = useBreadcrumb()
 *
 * // Or with entity data for dynamic labels
 * const { breadcrumbItems } = useBreadcrumb({ entity: agentData })
 *
 * // Or with custom label callback
 * const { breadcrumbItems } = useBreadcrumb({
 *   entity: newsroomData,
 *   getEntityLabel: (entity) => entity.name || entity.slug
 * })
 *
 * Route meta example:
 * {
 *   path: 'agents/:id/edit',
 *   name: 'agent-edit',
 *   meta: {
 *     breadcrumb: [
 *       { label: 'Agents', to: { name: 'agents' } },
 *       { label: ':name', dynamic: true }  // Resolved from entity.name
 *     ]
 *   }
 * }
 */
export function useBreadcrumb(options = {}) {
  const route = useRoute()
  const router = useRouter()

  // Label mapping for common route names
  const labelMap = {
    dashboard: 'Dashboard',
    users: 'Users',
    roles: 'Roles',
    apikeys: 'API Keys',
    newsrooms: 'Newsrooms',
    agents: 'Agents',
    events: 'Events',
    taxonomy: 'Taxonomy',
    domains: 'Domains',
    nexus: 'Nexus',
    queue: 'Queue',
    create: 'Create',
    edit: 'Edit',
    show: 'View'
  }

  // Icon mapping for root sections
  const iconMap = {
    users: 'pi pi-users',
    roles: 'pi pi-shield',
    apikeys: 'pi pi-key',
    newsrooms: 'pi pi-building',
    agents: 'pi pi-user',
    events: 'pi pi-calendar',
    taxonomy: 'pi pi-tags',
    domains: 'pi pi-globe',
    nexus: 'pi pi-sitemap',
    queue: 'pi pi-server'
  }

  /**
   * Capitalize first letter
   */
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  /**
   * Get human-readable label from path segment
   */
  function getLabel(segment) {
    // Check labelMap first
    if (labelMap[segment]) return labelMap[segment]
    // Capitalize and replace hyphens
    return capitalize(segment.replace(/-/g, ' '))
  }

  /**
   * Resolve dynamic label from entity data
   */
  function resolveDynamicLabel(label, entity) {
    if (!label.startsWith(':')) return label
    const field = label.slice(1) // Remove ':'
    return entity?.[field] || label
  }

  /**
   * Check if a route exists
   */
  function routeExists(name) {
    return router.getRoutes().some(r => r.name === name)
  }

  /**
   * Get home breadcrumb item (dashboard if exists, otherwise null)
   */
  function getHomeItem() {
    if (routeExists('dashboard')) {
      return { label: 'Dashboard', to: { name: 'dashboard' }, icon: 'pi pi-home' }
    }
    return null
  }

  /**
   * Build breadcrumb from route.meta.breadcrumb (manual)
   */
  function buildFromMeta(metaBreadcrumb, entity) {
    const items = []
    const home = getHomeItem()
    if (home) items.push(home)

    for (const item of metaBreadcrumb) {
      const resolved = {
        label: item.dynamic ? resolveDynamicLabel(item.label, entity) : item.label,
        to: item.to || null,
        icon: item.icon || null
      }
      items.push(resolved)
    }

    return items
  }

  /**
   * Build breadcrumb automatically from route path
   */
  function buildFromPath(entity, getEntityLabel) {
    const items = []
    const home = getHomeItem()
    if (home) items.push(home)

    // Get path segments, filter empty and params
    const segments = route.path.split('/').filter(s => s && !s.startsWith(':'))

    let currentPath = ''
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      currentPath += `/${segment}`

      // Handle IDs: numeric, UUID, ULID, or any alphanumeric string > 10 chars - use entity label instead
      const isId = /^\d+$/.test(segment) ||  // numeric
        segment.match(/^[0-9a-f-]{36}$/i) ||  // UUID
        segment.match(/^[0-7][0-9a-hjkmnp-tv-z]{25}$/i) ||  // ULID
        (segment.match(/^[a-z0-9]+$/i) && segment.length > 10)  // Generated ID (like LocalStorage)
      if (isId) {
        // If we have entity data, show its label instead of the ID
        if (entity && getEntityLabel) {
          const entityLabel = getEntityLabel(entity)
          if (entityLabel) {
            items.push({ label: entityLabel, to: null, icon: null })
          }
        }
        continue
      }

      // Get label for this segment
      const label = getLabel(segment)

      // Find matching route for this path
      const matchedRoute = router.getRoutes().find(r => {
        const routePath = r.path.replace(/:\w+/g, '[^/]+')
        const regex = new RegExp(`^${routePath}$`)
        return regex.test(currentPath)
      })

      const item = {
        label,
        to: matchedRoute ? { name: matchedRoute.name } : null,
        icon: i === 0 ? iconMap[segment] : null
      }

      // Last item has no link
      if (i === segments.length - 1) {
        item.to = null
      }

      items.push(item)
    }

    return items
  }

  /**
   * Computed breadcrumb items
   */
  const breadcrumbItems = computed(() => {
    const entity = options.entity?.value || options.entity
    const getEntityLabel = options.getEntityLabel || null

    // Use meta.breadcrumb if defined
    if (route.meta?.breadcrumb) {
      return buildFromMeta(route.meta.breadcrumb, entity)
    }

    // Auto-generate from path
    return buildFromPath(entity, getEntityLabel)
  })

  /**
   * Manual override - set custom breadcrumb items
   */
  function setBreadcrumb(items) {
    const home = getHomeItem()
    return home ? [home, ...items] : items
  }

  return {
    breadcrumbItems,
    setBreadcrumb
  }
}
