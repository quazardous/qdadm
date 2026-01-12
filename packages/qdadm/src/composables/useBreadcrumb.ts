import { computed, inject, type ComputedRef, type Ref } from 'vue'
import { useRouter, type Router } from 'vue-router'
import { useSemanticBreadcrumb, type SemanticBreadcrumbItem } from './useSemanticBreadcrumb'
import { useStackHydrator, type HydratedLevel } from '../chain/useStackHydrator'

/**
 * Breadcrumb display item
 */
export interface BreadcrumbDisplayItem {
  label: string
  to: { name: string; params?: Record<string, unknown> } | null
  icon: string | null
}

/**
 * Options for useBreadcrumb
 */
export interface UseBreadcrumbOptions {
  /** Current entity data for dynamic labels */
  entity?: unknown | Ref<unknown>
  /** Custom label resolver for entities */
  getEntityLabel?: (entity: unknown) => string
  /** Custom label mappings */
  labelMap?: Record<string, string>
  /** Custom icon mappings */
  iconMap?: Record<string, string>
}

/**
 * Return type for useBreadcrumb
 */
export interface UseBreadcrumbReturn {
  breadcrumbItems: ComputedRef<BreadcrumbDisplayItem[]>
  semanticBreadcrumb: ComputedRef<SemanticBreadcrumbItem[]>
  setBreadcrumb: (items: BreadcrumbDisplayItem[]) => BreadcrumbDisplayItem[]
}

/**
 * useBreadcrumb - Generate display-ready breadcrumb from semantic breadcrumb
 *
 * Uses useSemanticBreadcrumb for the semantic model, then applies adapters
 * to resolve labels, paths, and icons for display.
 *
 * @param options - Options
 *
 * @example
 * const { breadcrumbItems, semanticBreadcrumb } = useBreadcrumb()
 *
 * // With entity data for dynamic labels
 * const { breadcrumbItems } = useBreadcrumb({ entity: bookData })
 */
export function useBreadcrumb(options: UseBreadcrumbOptions = {}): UseBreadcrumbReturn {
  const router = useRouter()
  const homeRouteName = inject<string | null>('qdadmHomeRoute', null)

  // Get semantic breadcrumb
  const { breadcrumb: semanticBreadcrumb } = useSemanticBreadcrumb()

  // Get hydrator for parent entity labels
  const hydrator = useStackHydrator()

  // Default label mapping
  const defaultLabelMap: Record<string, string> = {
    home: 'Home',
    dashboard: 'Dashboard',
    create: 'Create',
    edit: 'Edit',
    show: 'View',
    delete: 'Delete',
  }

  // Default icon mapping for entities
  const defaultIconMap: Record<string, string> = {
    users: 'pi pi-users',
    roles: 'pi pi-shield',
    books: 'pi pi-book',
    genres: 'pi pi-tags',
    loans: 'pi pi-exchange',
    settings: 'pi pi-cog',
  }

  // Merge with custom mappings
  const labelMap = { ...defaultLabelMap, ...options.labelMap }
  const iconMap = { ...defaultIconMap, ...options.iconMap }

  /**
   * Capitalize first letter
   */
  function capitalize(str: string): string {
    if (!str) return ''
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  /**
   * Get route name for entity
   */
  function getEntityRouteName(entity: string, kind: string): string {
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
  function routeExists(name: string): boolean {
    return router.getRoutes().some((r) => r.name === name)
  }

  /**
   * Resolve semantic item to display item
   * @param item - Semantic breadcrumb item
   * @param index - Index in the breadcrumb array
   * @param entity - Current entity data (for labels)
   * @param isLast - Whether this is the last item (no link)
   */
  function resolveItem(
    item: SemanticBreadcrumbItem,
    index: number,
    entity: unknown,
    isLast: boolean
  ): BreadcrumbDisplayItem {
    const displayItem: BreadcrumbDisplayItem = {
      label: '',
      to: null,
      icon: null,
    }

    if (item.kind === 'route') {
      // Generic route
      const routeName = item.route!
      displayItem.label = item.label || labelMap[routeName] || capitalize(routeName)
      displayItem.to = isLast ? null : routeExists(routeName) ? { name: routeName } : null
      if (routeName === 'home') {
        displayItem.icon = 'pi pi-home'
      }
    } else if (item.kind.startsWith('entity-')) {
      // Entity-related item
      const entityName = item.entity!

      if (item.kind === 'entity-list') {
        // Entity list - use plural label
        displayItem.label = labelMap[entityName] || capitalize(entityName)
        displayItem.icon = index === 1 ? iconMap[entityName] || null : null
        const routeName = getEntityRouteName(entityName, item.kind)
        displayItem.to = isLast ? null : routeExists(routeName) ? { name: routeName } : null
      } else if (item.id) {
        // Entity instance (show/edit/delete)
        // Try to get label from hydrator first (works for all levels)
        const hydratedLevel = hydrator.getLevelByEntity(entityName)
        if (hydratedLevel?.label) {
          displayItem.label = hydratedLevel.label
        } else if (entity && options.getEntityLabel) {
          displayItem.label = options.getEntityLabel(entity)
        } else if (entity && typeof entity === 'object' && (entity as Record<string, unknown>).name) {
          displayItem.label = String((entity as Record<string, unknown>).name)
        } else if (
          entity &&
          typeof entity === 'object' &&
          (entity as Record<string, unknown>).title
        ) {
          displayItem.label = String((entity as Record<string, unknown>).title)
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
  function getHomeItem(): BreadcrumbDisplayItem | null {
    if (!homeRouteName || !routeExists(homeRouteName)) return null
    return {
      label: labelMap.home || 'Home',
      to: { name: homeRouteName },
      icon: 'pi pi-home',
    }
  }

  /**
   * Computed display-ready breadcrumb items
   */
  const breadcrumbItems = computed(() => {
    const entity =
      (options.entity as Ref<unknown>)?.value !== undefined
        ? (options.entity as Ref<unknown>).value
        : options.entity
    const items: BreadcrumbDisplayItem[] = []

    // Access hydrator levels deeply to create Vue dependencies
    // This ensures breadcrumb recomputes when hydration completes
    // We need to touch each level's label to track changes
    const _hydratorLevels = hydrator.levels.value
    const _labelsDep = _hydratorLevels.map((l: HydratedLevel) => l.label).join()

    // Add home first (display concern, not in semantic breadcrumb)
    const homeItem = getHomeItem()
    if (homeItem) {
      items.push(homeItem)
    }

    // Resolve semantic items to display items
    const semanticItems = semanticBreadcrumb.value
    for (let i = 0; i < semanticItems.length; i++) {
      const semanticItem = semanticItems[i]
      if (!semanticItem) continue
      const isLast = i === semanticItems.length - 1
      const displayItem = resolveItem(semanticItem, i, entity, isLast)
      items.push(displayItem)
    }

    return items
  })

  /**
   * Manual override - set custom breadcrumb items
   */
  function setBreadcrumb(items: BreadcrumbDisplayItem[]): BreadcrumbDisplayItem[] {
    const homeItem: BreadcrumbDisplayItem = {
      label: labelMap.home || 'Home',
      to: { name: homeRouteName! },
      icon: 'pi pi-home',
    }
    return homeRouteName && routeExists(homeRouteName) ? [homeItem, ...items] : items
  }

  return {
    breadcrumbItems,
    semanticBreadcrumb,
    setBreadcrumb,
  }
}
