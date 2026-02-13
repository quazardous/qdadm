import {
  createRouter,
  createWebHistory,
  createWebHashHistory,
  type RouteRecordRaw,
  type RouteLocationNormalized,
  type NavigationGuardNext,
  type RouteRecordNormalized,
} from 'vue-router'
import { getRoutes } from '../module/moduleRegistry'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Self = any

/**
 * Patch Kernel prototype with routing-related methods.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyRoutingMethods(KernelClass: { prototype: any }): void {
  const proto = KernelClass.prototype as Self

  /**
   * Create Vue Router
   */
  proto._createRouter = function (this: Self): void {
    const { pages, homeRoute, coreRoutes, basePath } = this.options

    if (!pages?.layout) {
      throw new Error('[Kernel] pages.layout is required')
    }

    let homeRouteConfig: RouteRecordRaw
    if (typeof homeRoute === 'object' && homeRoute?.component) {
      homeRouteConfig = {
        path: '',
        name: homeRoute.name || '_home',
        component: homeRoute.component,
      }
    } else {
      homeRouteConfig = {
        path: '',
        name: '_home',
        redirect: { name: (homeRoute as string) || 'home' },
      }
    }

    const moduleRoutes = getRoutes() as RouteRecordRaw[]

    const publicRoutes = moduleRoutes.filter(
      (r) => r.meta?.public || r.meta?.requiresAuth === false
    )
    const protectedRoutes = moduleRoutes.filter(
      (r) => !r.meta?.public && r.meta?.requiresAuth !== false
    )

    if (pages.login) {
      publicRoutes.unshift({
        path: '/login',
        name: 'login',
        component: pages.login,
        meta: { public: true },
      })
    }

    const layoutChildren: RouteRecordRaw[] = [
      homeRouteConfig,
      ...(coreRoutes || []),
      ...protectedRoutes,
    ]

    let routes: RouteRecordRaw[]

    if (pages.shell) {
      routes = [
        {
          path: '/',
          name: '_shell',
          component: pages.shell,
          children: [
            ...publicRoutes,
            {
              path: '',
              name: '_layout',
              component: pages.layout,
              meta: { requiresAuth: true },
              children: layoutChildren,
            },
          ],
        },
      ]
    } else {
      routes = [
        ...publicRoutes,
        {
          path: '/',
          name: '_layout',
          component: pages.layout,
          meta: { requiresAuth: true },
          children: layoutChildren,
        },
      ]
    }

    const notFoundComponent =
      pages.notFound || (() => import('../components/pages/NotFoundPage.vue'))
    const notFoundRoute: RouteRecordRaw = {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: notFoundComponent,
      meta: { public: true },
    }

    routes.push(notFoundRoute)

    const { hashMode } = this.options
    const history = hashMode
      ? createWebHashHistory(basePath)
      : createWebHistory(basePath)

    this.router = createRouter({
      history,
      routes,
    })
  }

  /**
   * Setup auth guard on router
   */
  proto._setupAuthGuard = function (this: Self): void {
    const { authAdapter } = this.options
    if (!authAdapter) return

    let wasEverAuthenticated = authAdapter.isAuthenticated()

    const debug = this.options.debug ?? false
    this.signals!.on('auth:session-lost', () => {
      if (debug) {
        console.warn('[Kernel] auth:session-lost received, emitting toast:warn')
      }
      this.orchestrator!.toast.warn(
        'Session lost',
        'Your session has expired. Please log in again.',
        'Kernel'
      )
    })

    this.router!.beforeEach((to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => {
      if (authAdapter.isAuthenticated()) {
        wasEverAuthenticated = true
      }

      const isPublic = to.matched.some(
        (record: RouteRecordNormalized) =>
          record.meta.public === true || record.meta.requiresAuth === false
      )

      if (isPublic) {
        next()
        return
      }

      const requiresAuth = to.matched.some(
        (record: RouteRecordNormalized) => record.meta.requiresAuth === true
      )

      if (requiresAuth && !authAdapter.isAuthenticated()) {
        if (wasEverAuthenticated) {
          const debug = this.options.debug ?? false
          if (debug) {
            console.warn(
              '[Kernel] Session lost detected, emitting auth:session-lost'
            )
          }
          this.signals!.emit('auth:session-lost', {
            reason: 'token_missing',
            redirectTo: 'login',
          })
          wasEverAuthenticated = false
        }

        const loginRoute = this.router!.hasRoute('login')
          ? { name: 'login', query: { session_lost: '1' } }
          : '/'
        next(loginRoute)
        return
      }

      const entity = to.meta?.entity as string | undefined
      if (entity && this.orchestrator) {
        try {
          const manager = this.orchestrator.get(entity)
          if (manager && !manager.canRead()) {
            console.warn(
              `[qdadm] Access denied to ${to.path} (entity: ${entity})`
            )
            this.orchestrator.toast.error(
              'Access Denied',
              `You don't have permission to access ${manager.labelPlural || entity}`,
              'Kernel'
            )
            this.signals!.emit('auth:access-denied', {
              path: to.path,
              entity,
              manager,
            })
            next({ path: '/' })
            return
          }
        } catch {
          // Entity not registered - allow navigation
        }
      }

      next()
    })
  }

  /**
   * Setup activeStack synchronization with router
   */
  proto._setupStackSync = function (this: Self): void {
    this.router!.afterEach((to: RouteLocationNormalized) => {
      this._rebuildActiveStack(to)
    })
  }

  /**
   * Rebuild activeStack from route
   */
  proto._rebuildActiveStack = function (this: Self, route: RouteLocationNormalized): void {
    const entityConfig = route.meta?.entity as string | undefined

    interface ParentMeta {
      entity: string
      param: string
      foreignKey?: string
      parent?: ParentMeta
    }

    const parentMeta = route.meta?.parent as ParentMeta | undefined

    // No entity and no parent → nothing to stack
    if (!entityConfig && !parentMeta) {
      this.activeStack!.clear()
      return
    }

    interface StackLevel {
      entity: string
      param: string
      foreignKey: string | null
      id: string | null
    }

    const levels: StackLevel[] = []

    // Build parent levels
    let parentConfig = parentMeta
    while (parentConfig) {
      const id = (route.params[parentConfig.param] as string) ?? null
      levels.unshift({
        entity: parentConfig.entity,
        param: parentConfig.param,
        foreignKey: null,
        id,
      })
      parentConfig = parentConfig.parent ?? undefined
    }

    // Add current entity level (only if route has its own entity)
    if (entityConfig) {
      const manager = this.orchestrator?.get(entityConfig)
      const idField = manager?.idField ?? 'id'
      const currentId = (route.params[idField] as string) ?? null
      const currentForeignKey = parentMeta?.foreignKey ?? null

      // Skip if the ID param is already consumed by a parent level
      // (e.g., /jobs/:id/bot-tasks — :id belongs to the parent, not the child)
      const idConsumedByParent = levels.some(l => l.param === idField)

      if (currentId && !idConsumedByParent) {
        levels.push({
          entity: entityConfig,
          param: idField,
          foreignKey: currentForeignKey,
          id: currentId,
        })
      }
    }

    this.activeStack!.set(levels)
  }
}
