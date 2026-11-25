import {
  createRouter,
  createWebHistory,
  createWebHashHistory,
  type RouteRecordRaw,
  type RouteLocationNormalized,
  type RouteRecordNormalized,
} from 'vue-router'
import { getRoutes, getItemTabs } from '../module/moduleRegistry'
import { nestItemTabs } from './itemTabs'
import { installChunkReload } from './chunkReload'
import { homeRouteRecords } from './homeRoute'
import { settingsHomeRecords } from './settingsHome'
import { routeEntity, routePermissions, missingPermission, entityDenial } from '../security/routeAccess'
import { resolveDomain, getDomain, DOMAIN_QUERY } from '../domain/registry'
import { keptDomain, takeLeaveDomain } from '../domain/keep'
import type { Kernel } from './Kernel'
// #1196 Phase B — this-typing against the real Kernel shape (was Self = any)
type Self = Kernel

/**
 * Patch Kernel prototype with routing-related methods.
 */
/**
 * `judge.ready()`, bounded (#2412): a judge that never settles must not hold a
 * navigation forever. A synchronous throw from `ready()` counts as a rejection.
 */
function waitForJudge(judge: { ready(): Promise<void> }, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no answer within ${timeoutMs} ms`)), timeoutMs)
    Promise.resolve()
      .then(() => judge.ready())
      .then(
        () => {
          clearTimeout(timer)
          resolve()
        },
        (e: unknown) => {
          clearTimeout(timer)
          reject(e instanceof Error ? e : new Error(String(e)))
        }
      )
  })
}

export function applyRoutingMethods(KernelClass: { prototype: Kernel }): void {
  const proto = KernelClass.prototype

  /**
   * Create Vue Router.
   *
   * When `options.existingRouter` is provided, the Kernel reuses it
   * and registers its computed routes via `addRoute()` instead of
   * calling `createRouter()`. Combined with `options.routePrefix`,
   * this lets a host mount the whole admin tree under a sub-path
   * (e.g. `routePrefix: '/admin'` shifts the layout to `/admin` and
   * the catch-all to `/admin/:pathMatch(.*)*`).
   */
  proto._createRouter = function (this: Self): void {
    const { pages, homeRoute, coreRoutes, basePath } = this.options

    if (!pages?.layout) {
      throw new Error('[Kernel] pages.layout is required')
    }

    // The home page: on its own path, '/' redirecting to it (#5365)
    const homeRecords = homeRouteRecords(homeRoute)

    // An entity shown as tabs gets its item's pages nested under one frame route (#4963)
    const moduleRoutes = nestItemTabs(getRoutes() as RouteRecordRaw[], getItemTabs())

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
      ...homeRecords,
      ...(coreRoutes || []),
      ...protectedRoutes,
      // qdadm's own settings home (#5500), after the app's: its /settings wins
      ...settingsHomeRecords(this.options.features?.settingsMenu, (path) =>
        moduleRoutes.some((r) => r.path.replace(/^\/+/, '') === path) || (coreRoutes || []).some((r) => r.path.replace(/^\/+/, '') === path)
      ),
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

    // ──────────────────────────────────────────────────────────────
    // routePrefix: prepend to every Kernel-built route so the whole
    // tree mounts under a sub-path (host scenarios like a CMS that
    // lives at `/` and hosts qdadm at `/admin`). Empty by default.
    const prefix = (this.options.routePrefix ?? '').replace(/\/+$/, '')
    if (prefix) {
      routes = routes.map((r) => prefixRoute(r, prefix))
    }

    if (this.options.existingRouter) {
      // Host shell owns the router. Skip createRouter, register on
      // the supplied instance. We do NOT touch history mode here —
      // the host is responsible for that.
      this.router = this.options.existingRouter
      for (const r of routes) {
        this.router.addRoute(r)
      }
      return
    }

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
   * A lazy page whose chunk is gone, typically after a deploy (#2295): reload once, then say so.
   */
  proto._setupChunkReload = function (this: Self): void {
    installChunkReload(this.router!, {
      notify: () =>
        this.orchestrator!.toast.error(
          'A new version is available',
          'This page could not be loaded. Reload the page to get the new version.',
          { life: 0, emitter: 'Kernel' }
        ),
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

    // Return-style guard (no next() callback): supported since vue-router 4,
    // required to avoid the R0025 deprecation warning on vue-router 5 (#1384)
    this.router!.beforeEach((to: RouteLocationNormalized) => {
      if (authAdapter.isAuthenticated()) {
        wasEverAuthenticated = true
      }

      const isPublic = to.matched.some(
        (record: RouteRecordNormalized) =>
          record.meta.public === true || record.meta.requiresAuth === false
      )

      if (isPublic) {
        return
      }

      const requiresAuth = to.matched.some(
        (record: RouteRecordNormalized) => record.meta.requiresAuth === true
      )

      if (requiresAuth && !authAdapter.isAuthenticated()) {
        // Only a session this tab had can be lost: a first visit goes to login without the flag (#2292).
        const sessionLost = wasEverAuthenticated
        if (sessionLost) {
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

        if (!this.router!.hasRoute('login')) return '/'
        return sessionLost ? { name: 'login', query: { session_lost: '1' } } : { name: 'login' }
      }

      // Who may open it (#4962): the same rule as the menu and PageNav —
      // every matched record's meta.permission (#4332), and the route's entity
      // (or, for a child page, its parent item's) for the action it declares
      // (#2497). An entity not registered yet is the ONLY pass-through; a
      // failing check fails CLOSED, never silently allows (#1190).
      const orchestrator = this.orchestrator
      const checker = this.securityChecker
      const deps = { orchestrator, checker }
      const entity = routeEntity(to)
      const entityToCheck = !!entity && !!orchestrator && orchestrator.isRegistered(entity)
      const permissionsToCheck = routePermissions(to).length > 0 && !!checker

      if (!entityToCheck && !permissionsToCheck) return

      const checkPermissions = (): { path: string } | undefined => {
        if (!permissionsToCheck) return undefined
        try {
          const missing = missingPermission(to, deps)
          if (missing === null) return undefined
          console.warn(`[qdadm] Access denied to ${to.path} (permission: ${missing})`)
          orchestrator?.toast.error('Access Denied', "You don't have permission to access this page", 'Kernel')
          this.signals!.emit('auth:access-denied', { path: to.path, permission: missing })
          return { path: '/' }
        } catch (err) {
          console.error(`[qdadm] Permission check failed for ${to.path} — denying navigation:`, err)
          return { path: '/' }
        }
      }

      const checkEntity = (): { path: string } | undefined => {
        if (!entityToCheck) return undefined
        try {
          const denial = entityDenial(to, deps)
          if (denial) {
            console.warn(
              `[qdadm] Access denied to ${to.path} (entity: ${denial.entity}, action: ${denial.action})`
            )
            orchestrator!.toast.error(
              'Access Denied',
              `You don't have permission to access ${denial.manager.labelPlural || denial.entity}`,
              'Kernel'
            )
            this.signals!.emit('auth:access-denied', {
              path: to.path,
              entity: denial.entity,
              manager: denial.manager,
            })
            return { path: '/' }
          }
        } catch (err) {
          console.error(
            `[qdadm] Access check failed for ${to.path} (entity: ${entity}) — denying navigation:`,
            err
          )
          return { path: '/' }
        }
        return undefined
      }

      // A judge whose answers come from a request cannot have them yet on the
      // first navigation, which starts inside createApp() (#2412). Its cache
      // miss would fall through to an empty role matrix and read as a refusal:
      // wait for its answers instead of deciding early. Still fail closed — a
      // judge that rejects or never settles denies.
      const decide = (): { path: string } | undefined => checkPermissions() ?? checkEntity()
      const judge = this.securityChecker?.grant
      if (typeof judge?.ready !== 'function') return decide()
      const timeoutMs = this.options.security?.readyTimeoutMs ?? 10_000
      return waitForJudge(judge as { ready(): Promise<void> }, timeoutMs).then(decide, (reason: Error) => {
        console.error(
          `[qdadm] security.grant never became ready for ${to.path}: ${reason.message} — denying navigation`
        )
        return { path: '/' }
      })
    })
  }

  /**
   * Setup activeStack synchronization with router
   */
  proto._setupStackSync = function (this: Self): void {
    // A page placed by ?domain= or the resolver hands its domain on to the
    // pages of the same record chain, unless left from the side menu (#5412)
    this.router!.beforeEach((to: RouteLocationNormalized, from: RouteLocationNormalized) => {
      const leaving = takeLeaveDomain()
      const name = keptDomain(to, from, this.activeStack?.getDomain() ?? null, leaving)
      if (!name) return undefined
      return { path: to.path, query: { ...to.query, [DOMAIN_QUERY]: name }, hash: to.hash }
    })
    this.router!.afterEach((to: RouteLocationNormalized) => {
      takeLeaveDomain()
      this._rebuildActiveStack(to)
    })
    // The page's record arrived: the app's resolver may read it (#5412)
    this.signals?.on('stack:hydrated', (event) => {
      if (!this.options.features?.domainResolver) return
      const levels = (event.data as { levels?: Array<{ entity: string; id: string | null; hydrated?: boolean; error?: unknown; data?: unknown }> } | undefined)?.levels ?? []
      const last = levels.at(-1)
      const current = this.activeStack?.getCurrent()
      // A late answer for a page we already left
      if (!last || !current || last.entity !== current.entity || String(last.id) !== String(current.id)) return
      if (!last.hydrated && !last.error) return
      const record = last.hydrated && last.data && typeof last.data === 'object' ? (last.data as Record<string, unknown>) : null
      this._resolveActiveDomain(this.router!.currentRoute.value, this.activeStack!.getLevels(), record)
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
      this._resolveActiveDomain(route, [])
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

    this._resolveActiveDomain(route, levels)
    this.activeStack!.set(levels)
  }

  /**
   * The page's domain (#5412): the default rule, then the app's
   * `features.domainResolver`, given the domain we come from and, once
   * loaded, the page's record (called again on stack:hydrated). Set before
   * the levels, so their change reads it.
   */
  proto._resolveActiveDomain = function (
    this: Self,
    route: RouteLocationNormalized,
    levels: Array<{ entity: string; id: string | null }>,
    record?: Record<string, unknown> | null
  ): void {
    const stack = this.activeStack!
    const shown = stack.getDomain()
    const shownDomain = shown ? getDomain(shown.name) : null
    const resolver = this.options.features?.domainResolver ?? null
    // On a route change the page's record (its deepest level) is on its way
    // when that level has an id; a second call brings it (stack:hydrated).
    // The same record as the page we leave (a tab, a query): already there.
    const last = levels.at(-1)
    if (record === undefined && last?.id) {
      const held = this.stackHydrator?.getCurrent()
      if (held?.hydrated && held.entity === last.entity && String(held.id) === String(last.id) && held.data) record = held.data as Record<string, unknown>
    }
    const loading = record === undefined && !!last?.id && !!this.signals
    const { domain, source } = resolveDomain(route, {
      resolver,
      previous: shownDomain,
      stack: levels.map((l) => ({ entity: l.entity, id: l.id })),
      record: record ?? null,
      loading,
      current: shown ? { domain: shownDomain, source: shown.source } : null,
    })
    stack.setDomain(domain ? { name: domain.name, source } : null)
  }
}

/**
 * Prepend a path prefix to a top-level route record. Children inherit
 * relative paths so we only touch the outer record. Used by the
 * `routePrefix` option to mount the whole admin tree under a sub-path
 * of the host router.
 */
function prefixRoute(route: RouteRecordRaw, prefix: string): RouteRecordRaw {
  if (!route.path) return route
  // Normalise: ensure single leading slash.
  const tail = route.path.startsWith('/') ? route.path : `/${route.path}`
  // `/` becomes the prefix itself, otherwise prefix + tail.
  const newPath = tail === '/' ? prefix : `${prefix}${tail}`
  return { ...route, path: newPath }
}
