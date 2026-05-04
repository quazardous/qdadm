/**
 * Patch KernelContext prototype with routing-related methods:
 *   - routes(basePath, routes, opts)
 *   - navItem(item)
 *   - routeFamily(base, prefixes)
 *   - crud(entity, pages, options)             — convention CRUD generator
 *   - childPage(parent, page, options)         — non-entity child route
 *
 * The string helpers (`singularize`, `toKebab`, `capitalize`) are kept
 * module-local — they're pure, stateless, and were only used by `crud()` and
 * `childPage()`. Keeping them off the prototype keeps the public shape clean.
 */

import type { RouteRecordRaw } from 'vue-router'
import { registry, getRoutes } from '../module/moduleRegistry'
import type {
  ChildPageOptions,
  CrudOptions,
  CrudPages,
  NavItem,
  ParentConfig,
  RouteOptions,
} from './KernelContext.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Self = any

/** Singularize a plural word (simple English rules) */
function singularize(plural: string): string {
  if (plural.endsWith('ies')) return plural.slice(0, -3) + 'y'
  if (plural.endsWith('ses') || plural.endsWith('xes') || plural.endsWith('zes')) {
    return plural.slice(0, -2)
  }
  if (plural.endsWith('s') && !plural.endsWith('ss')) return plural.slice(0, -1)
  return plural
}

/** Convert camelCase to kebab-case (e.g. 'botTasks' → 'bot-tasks') */
function toKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

/** Capitalize first letter */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyRoutingMethods(KernelContextClass: { prototype: any }): void {
  const proto = KernelContextClass.prototype as Self

  proto.routes = function (
    this: Self,
    basePath: string,
    routes: RouteRecordRaw[],
    opts: RouteOptions = {}
  ): Self {
    registry.addRoutes(basePath, routes, opts)
    return this
  }

  proto.navItem = function (this: Self, item: NavItem): Self {
    registry.addNavItem(item)
    return this
  }

  proto.routeFamily = function (this: Self, base: string, prefixes: string[]): Self {
    registry.addRouteFamily(base, prefixes)
    return this
  }

  /**
   * Register standard CRUD routes with naming conventions
   * (entity 'books' → route prefix 'book', /books → 'book', etc.)
   */
  proto.crud = function (
    this: Self,
    entity: string,
    pages: CrudPages,
    options: CrudOptions = {}
  ): Self {
    // Entity name is always used for permission binding.
    // Manager may not be registered yet (child entity before parent module loads).
    const entityBinding = entity
    const manager = this._kernel.orchestrator?.isRegistered(entity)
      ? this._kernel.orchestrator.get(entity)
      : null
    const idParam = manager?.idField || 'id'

    // Handle parent route configuration
    const urlSegment = options.pathSegment || toKebab(entity)
    let basePath = urlSegment
    let parentConfig: ParentConfig | null = null
    let parentRoutePrefix: string | null = null

    if (options.parentRoute) {
      const parentRouteName = options.parentRoute
      const allRoutes = getRoutes()
      const parentRoute = allRoutes.find((r) => r.name === parentRouteName)

      if (parentRoute) {
        const parentEntityName = parentRoute.meta?.entity
        const parentManager = parentEntityName
          ? this._kernel.orchestrator?.get(parentEntityName)
          : null
        const parentIdParam = parentManager?.idField || 'id'

        // Build base path: parentPath/:parentId/entity (e.g., books/:bookId/loans)
        const parentBasePath =
          parentRoute.path.replace(/\/(create|:.*)?$/, '') || parentEntityName
        basePath = `${parentBasePath}/:${parentIdParam}/${urlSegment}`

        if (parentEntityName) {
          parentConfig = {
            entity: parentEntityName,
            param: parentIdParam,
            foreignKey: options.foreignKey || `${singularize(parentEntityName)}_id`,
          }
        }

        parentRoutePrefix = parentRouteName
      }
    }

    // Derive route prefix:
    //   With parent:    'book' + '-loan' → 'book-loan'
    //   Without parent: 'books' → 'book'
    const routePrefix =
      options.routePrefix ||
      (parentRoutePrefix
        ? `${parentRoutePrefix}-${singularize(entity)}`
        : singularize(entity))

    const routes: RouteRecordRaw[] = []

    if (pages.list) {
      routes.push({
        path: '',
        name: routePrefix,
        component: pages.list,
        meta: { layout: 'list' },
      })
    }

    if (pages.show) {
      routes.push({
        path: `:${idParam}`,
        name: `${routePrefix}-show`,
        component: pages.show,
        meta: { layout: 'show' },
      })
    }

    if (pages.form) {
      // Single form pattern (recommended)
      routes.push({
        path: 'create',
        name: `${routePrefix}-create`,
        component: pages.form,
      })
      routes.push({
        path: `:${idParam}/edit`,
        name: `${routePrefix}-edit`,
        component: pages.form,
      })
    } else {
      if (pages.create) {
        routes.push({
          path: 'create',
          name: `${routePrefix}-create`,
          component: pages.create,
        })
      }
      if (pages.edit) {
        routes.push({
          path: `:${idParam}/edit`,
          name: `${routePrefix}-edit`,
          component: pages.edit,
        })
      }
    }

    const routeOpts: RouteOptions = {}
    // Set entity if registered, OR if this is a child route — child routes
    // need entity binding for permission checks even before the manager
    // exists.
    if (manager || parentConfig) {
      routeOpts.entity = entityBinding
    }
    if (parentConfig) {
      routeOpts.parent = parentConfig
    }
    if (options.label) {
      routeOpts.label = options.label
    }

    this.routes(basePath, routes, routeOpts)
    this.routeFamily(routePrefix, [`${routePrefix}-`])

    if (options.nav) {
      const label = options.nav.label || capitalize(entity)
      const navItem: NavItem = {
        section: options.nav.section,
        route: routePrefix,
        icon: options.nav.icon,
        label,
      }
      // Only set entity on nav item if registered (avoids permission check
      // failure). Routes always get entity binding, but nav items need it
      // resolvable.
      if (manager) {
        navItem.entity = entityBinding
      }
      this.navItem(navItem)
    }

    return this
  }

  /**
   * Register a custom child page on an entity item (e.g. /books/:id/statistics).
   */
  proto.childPage = function (
    this: Self,
    parentRouteName: string,
    pageName: string,
    options: ChildPageOptions
  ): Self {
    const allRoutes = getRoutes()
    const parentRoute = allRoutes.find((r) => r.name === parentRouteName)

    if (!parentRoute) {
      console.warn(`[qdadm] childPage: parent route '${parentRouteName}' not found`)
      return this
    }

    const parentEntityName = parentRoute.meta?.entity as string | undefined
    const parentManager = parentEntityName
      ? this._kernel.orchestrator?.get(parentEntityName)
      : null
    const parentIdParam = parentManager?.idField || 'id'

    const parentBasePath =
      parentRoute.path.replace(/\/(create|:.*)?$/, '') || parentEntityName
    const basePath = `${parentBasePath}/:${parentIdParam}/${pageName}`

    const routeName = `${parentRouteName}-${pageName}`

    const parentConfig: ParentConfig | undefined = parentEntityName
      ? { entity: parentEntityName, param: parentIdParam }
      : undefined

    const routeOpts: RouteOptions = {}
    if (parentConfig) {
      routeOpts.parent = parentConfig
    }
    if (options.label) {
      routeOpts.label = options.label
    }

    this.routes(
      basePath,
      [
        {
          path: '',
          name: routeName,
          component: options.component,
          meta: {
            layout: 'page',
            ...(options.icon && { icon: options.icon }),
            ...options.meta,
          },
        },
      ],
      routeOpts
    )

    return this
  }
}
