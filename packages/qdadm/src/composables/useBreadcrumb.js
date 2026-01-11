import { computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useSemanticBreadcrumb } from './useSemanticBreadcrumb'
import { useStackHydrator } from '../chain/useStackHydrator.js'

/**
 * useBreadcrumb - Generate display-ready breadcrumb from semantic breadcrumb
 *
 * Uses useSemanticBreadcrumb for the semantic model, then applies adapters
 * to resolve labels, paths, and icons for display.
 *
 * @param {object} options - Options
 * @param {object} [options.entity] - Current entity data for dynamic labels
 * @param {Function} [options.getEntityLabel] - Custom label resolver for entities
 * @param {object} [options.labelMap] - Custom label mappings
 * @param {object} [options.iconMap] - Custom icon mappings
 *
 * @example
 * const { breadcrumbItems, semanticBreadcrumb } = useBreadcrumb()
 *
 * // With entity data for dynamic labels
 * const { breadcrumbItems } = useBreadcrumb({ entity: bookData })
 */
export function useBreadcrumb(options = {}) {
  const router = useRouter()
  const homeRouteName = inject('qdadmHomeRoute', null)

  // Get semantic breadcrumb
  const { breadcrumb: semanticBreadcrumb } = useSemanticBreadcrumb()

  // Get hydrator for parent entity labels
  const hydrator = useStackHydrator()

  // Default label mapping
  const defaultLabelMap = {
    home: 'Home',
    dashboard: 'Dashboard',
    create: 'Create',
    edit: 'Edit',
    show: 'View',
    delete: 'Delete'
  }

  // Default icon mapping for entities
  const defaultIconMap = {
    users: 'pi pi-users',
    roles: 'pi pi-shield',
    books: 'pi pi-book',
    genres: 'pi pi-tags',
    loans: 'pi pi-exchange',
    settings: 'pi pi-cog'
  }

  // Merge with custom mappings
  const labelMap = { ...defaultLabelMap, ...options.labelMap }
  const iconMap = { ...defaultIconMap, ...options.iconMap }

  /**
   * Capitalize first letter
   */
  function capitalize(str) {
    if (!str) return ''
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  /**
   * Get route name for entity
   */
  function getEntityRouteName(entity, kind) {
    // Convention: entity-list -> 'book', entity-edit -> 'book-edit'
    const singular = entity.endsWith('s') ? entity.slice(0, -1) : entity
    if (kind === 'entity-list') return singular
    if (kind === 'entity-show') return `${singular}-show`
    if (kind === 'entity-edit') return `${singular}-edit`
    if (kind === 'entity-create') return `${singular}-create`
    return singular
  }

  /**
   * Check if a route exists
   */
  function routeExists(name) {
    return router.getRoutes().some(r => r.name === name)
  }

  /**
   * Resolve semantic item to display item
   * @param {object} item - Semantic breadcrumb item
   * @param {number} index - Index in the breadcrumb array
   * @param {object} entity - Current entity data (for labels)
   * @param {boolean} isLast - Whether this is the last item (no link)
   */
  function resolveItem(item, index, entity, isLast) {
    const displayItem = {
      label: '',
      to: null,
      icon: null
    }

    if (item.kind === 'route') {
      // Generic route
      const routeName = item.route
      displayItem.label = item.label || labelMap[routeName] || capitalize(routeName)
      displayItem.to = isLast ? null : (routeExists(routeName) ? { name: routeName } : null)
      if (routeName === 'home') {
        displayItem.icon = 'pi pi-home'
      }
    } else if (item.kind.startsWith('entity-')) {
      // Entity-related item
      const entityName = item.entity

      if (item.kind === 'entity-list') {
        // Entity list - use plural label
        displayItem.label = labelMap[entityName] || capitalize(entityName)
        displayItem.icon = index === 1 ? iconMap[entityName] : null
        const routeName = getEntityRouteName(entityName, item.kind)
        displayItem.to = isLast ? null : (routeExists(routeName) ? { name: routeName } : null)
      } else if (item.id) {
        // Entity instance (show/edit/delete)
        // Try to get label from hydrator first (works for all levels)
        const hydratedLevel = hydrator.getLevelByEntity(entityName)
        if (hydratedLevel?.label) {
          displayItem.label = hydratedLevel.label
        } else if (entity && options.getEntityLabel) {
          displayItem.label = options.getEntityLabel(entity)
        } else if (entity?.name) {
          displayItem.label = entity.name
        } else if (entity?.title) {
          displayItem.label = entity.title
        } else {
          displayItem.label = `#${item.id}`
        }

        // Last item = no link. Otherwise link to show page if exists
        if (!isLast && (item.kind === 'entity-edit' || item.kind === 'entity-delete')) {
          const showRouteName = getEntityRouteName(entityName, 'entity-show')
          if (routeExists(showRouteName)) {
            displayItem.to = { name: showRouteName, params: { id: item.id } }
          }
        }
      } else if (item.kind === 'entity-create') {
        // Create page - label as action
        displayItem.label = labelMap.create || 'Create'
      }
    }

    return displayItem
  }

  /**
   * Get home breadcrumb item
   */
  function getHomeItem() {
    if (!homeRouteName || !routeExists(homeRouteName)) return null
    return {
      label: labelMap.home || 'Home',
      to: { name: homeRouteName },
      icon: 'pi pi-home'
    }
  }

  /**
   * Computed display-ready breadcrumb items
   */
  const breadcrumbItems = computed(() => {
    const entity = options.entity?.value || options.entity
    const items = []

    // Access hydrator levels deeply to create Vue dependencies
    // This ensures breadcrumb recomputes when hydration completes
    // We need to touch each level's label to track changes
    const _hydratorLevels = hydrator.levels.value
    const _labelsDep = _hydratorLevels.map(l => l.label).join()

    // Add home first (display concern, not in semantic breadcrumb)
    const homeItem = getHomeItem()
    if (homeItem) {
      items.push(homeItem)
    }

    // Resolve semantic items to display items
    const semanticItems = semanticBreadcrumb.value
    for (let i = 0; i < semanticItems.length; i++) {
      const semanticItem = semanticItems[i]
      const isLast = i === semanticItems.length - 1
      const displayItem = resolveItem(semanticItem, i, entity, isLast)
      items.push(displayItem)
    }

    return items
  })

  /**
   * Manual override - set custom breadcrumb items
   */
  function setBreadcrumb(items) {
    const homeItem = { label: labelMap.home || 'Home', to: { name: homeRouteName }, icon: 'pi pi-home' }
    return homeRouteName && routeExists(homeRouteName) ? [homeItem, ...items] : items
  }

  return {
    breadcrumbItems,
    semanticBreadcrumb,
    setBreadcrumb
  }
}
