/**
 * A tabbed item (#4963): the pages of an item become children of one frame
 * route, whose component (EntityItemLayout) shows the item's header, a tab per
 * page and, in its `router-view`, the page.
 *
 *   books/:bookId            (frame, no name)   EntityItemLayout
 *     ''                     book-show          the item's own page, "Details"
 *     info                   book-info          a childPage
 *     loans                  loan               a child crud list
 *     loans/create           loan-create        …and its forms
 *
 * Route names, full paths and every route's own meta are unchanged; the frame
 * adds only `meta.itemTabs`, which the guard, the breadcrumb and the active
 * stack do not read. The pages of the item are those whose `meta.parent` is the
 * entity, under the same item path, plus the entity's show route when it sits
 * on that path.
 */
import type { RouteRecordRaw } from 'vue-router'
import type { ItemTabsOptions } from '../module/moduleRegistry'

/** What the frame route carries in `meta.itemTabs` */
export interface ItemTabsMeta extends ItemTabsOptions {
  entity: string
  /** The route param carrying the item's id */
  param: string
}

type Route = RouteRecordRaw & { meta?: Record<string, unknown>; name?: string | symbol }

const EntityItemLayout = () => import('../components/layout/EntityItemLayout.vue')

/** Nest the pages of each tabbed entity under a frame route. Routes of other entities pass through, in order. */
export function nestItemTabs(routes: RouteRecordRaw[], frames: Map<string, ItemTabsOptions>): RouteRecordRaw[] {
  let result = routes as Route[]
  for (const [entity, options] of frames) {
    result = nestOne(result, entity, options)
  }
  return result
}

function parentOf(route: Route): { entity?: string; param?: string } | undefined {
  return route.meta?.parent as { entity?: string; param?: string } | undefined
}

function nestOne(routes: Route[], entity: string, options: ItemTabsOptions): Route[] {
  const first = routes.find((r) => parentOf(r)?.entity === entity && parentOf(r)?.param)
  if (!first) {
    console.warn(`[qdadm] itemTabs('${entity}'): no page of an item of '${entity}' (childPage or child crud) — nothing to show as tabs`)
    return routes
  }
  const param = parentOf(first)!.param!
  const marker = `:${param}`
  const at = first.path.indexOf(`/${marker}`)
  if (at < 0) return routes
  const framePath = first.path.slice(0, at + marker.length + 1)

  const inFrame = (r: Route): boolean => {
    if (parentOf(r)?.entity === entity) return r.path.startsWith(`${framePath}/`)
    // The item's own page, when it sits on the frame's path
    return r.meta?.entity === entity && r.path === framePath && typeof r.name === 'string' && /-show$/.test(r.name)
  }
  const pages = routes.filter(inFrame)
  // A page of the item whose parent param differs (a child crud namespaces it,
  // a childPage keeps the id field) cannot share the frame: say so
  const apart = routes.filter((r) => parentOf(r)?.entity === entity && !inFrame(r)).map((r) => String(r.name ?? r.path))
  if (apart.length) {
    console.warn(
      `[qdadm] itemTabs('${entity}'): ${apart.join(', ')} not in the tabs — their parent param is not ':${param}'. ` +
        `Give them parentParam: '${param}'.`
    )
  }
  const show = pages.find((r) => r.path === framePath)

  const children: RouteRecordRaw[] = pages.map((r) => ({ ...r, path: r.path === framePath ? '' : r.path.slice(framePath.length + 1) }) as RouteRecordRaw)
  if (!show) {
    // No page of its own: the item opens on its first tab
    const firstTab = pages.find((r) => typeof r.name === 'string' && !/-(create|edit|new|show)$/.test(r.name) && !r.path.slice(framePath.length + 1).includes(':'))
    if (firstTab) children.unshift({ path: '', redirect: (to) => ({ name: firstTab.name as string, params: to.params }) })
  }

  const frame: Route = {
    path: framePath,
    component: (options.component as RouteRecordRaw['component']) ?? EntityItemLayout,
    meta: { itemTabs: { ...options, entity, param } satisfies ItemTabsMeta },
    children,
  } as Route

  const out: Route[] = []
  let placed = false
  for (const r of routes) {
    if (!inFrame(r)) {
      out.push(r)
    } else if (!placed) {
      out.push(frame)
      placed = true
    }
  }
  return out
}
