/**
 * The home page has an address of its own (#5365): `homeRoute: { name,
 * component, path }` mounts the page on `path` and `/` redirects to it; without
 * `path`, the page lives on `/` only, and development says so. The 404 page
 * and the breadcrumb follow the home the app declares, whatever its name.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { Kernel } from '../../src/kernel/Kernel'
import { homeRouteName, homeRouteRecords } from '../../src/kernel/homeRoute'
import NotFoundPage from '../../src/components/pages/NotFoundPage.vue'

const Page = (text) => defineComponent({ setup: () => () => h('div', text) })
const Layout = defineComponent({ setup: () => () => h('div') })

async function kernelRouter(homeRoute) {
  const kernel = new Kernel({ root: Page('app'), pages: { layout: Layout }, homeRoute, authAdapter: { isAuthenticated: () => true, getCurrentUser: () => ({}) } })
  kernel._createRouter()
  return kernel.router
}

afterEach(() => vi.restoreAllMocks())

describe('homeRoute (#5365)', () => {
  it('names the home route, whatever the form', () => {
    expect(homeRouteName('log-errors')).toBe('log-errors')
    expect(homeRouteName(undefined)).toBe('home')
    expect(homeRouteName({ name: 'welcome', component: Layout })).toBe('welcome')
    expect(homeRouteName({ component: Layout })).toBe('_home')
    expect(homeRouteName({ component: Layout, path: 'welcome' })).toBe('home')
  })

  it('with a path: the page lives on its path, and / redirects to it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const router = await kernelRouter({ name: 'errors', component: Page('errors'), path: '/errors' })
    const errors = router.getRoutes().find((r) => r.name === 'errors')
    expect(errors.path).toBe('/errors')
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('errors')
    expect(router.currentRoute.value.path).toBe('/errors')
    expect(warn.mock.calls.flat().join()).not.toContain('homeRoute')
  })

  it('without a path: the page stays on / only, and development says so', () => {
    const warn = vi.fn()
    const records = homeRouteRecords({ name: 'home', component: Layout }, warn)
    expect(records).toEqual([{ path: '', name: 'home', component: Layout }])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("the page 'home' exists on '/' only"))
  })

  it('a route name: / redirects to it, nothing to warn about', () => {
    const warn = vi.fn()
    expect(homeRouteRecords('books', warn)).toEqual([{ path: '', name: '_home', redirect: { name: 'books' } }])
    expect(warn).not.toHaveBeenCalled()
  })

  it('the 404 page leads to the home the app declares, not only to one named home', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'dashboard', component: Page('d') },
        { path: '/errors', name: 'log-errors', component: Page('e') },
        { path: '/:p(.*)*', component: NotFoundPage },
      ],
    })
    await router.push('/nowhere')
    const w = mount(NotFoundPage, { global: { plugins: [router], provide: { qdadmHomeRoute: 'log-errors' } } })
    await w.find('button, a').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('log-errors')
  })

  it('the 404 page falls back to home or dashboard when the declared home is unknown', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'dashboard', component: Page('d') },
        { path: '/:p(.*)*', component: NotFoundPage },
      ],
    })
    await router.push('/nowhere')
    const w = mount(NotFoundPage, { global: { plugins: [router], provide: { qdadmHomeRoute: 'gone' } } })
    await w.find('button, a').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('dashboard')
  })
})

describe('the breadcrumb and the home (#5365)', () => {
  it('a home route named otherwise than home keeps its house icon', async () => {
    const { useBreadcrumb } = await import('../../src/composables/useBreadcrumb')
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', redirect: { name: 'log-errors' } },
        { path: '/errors', name: 'log-errors', component: Page('e') },
        { path: '/errors/today', name: 'log-errors-today', component: Page('t') },
      ],
    })
    await router.push('/errors/today')
    let items
    mount(defineComponent({ setup() { items = useBreadcrumb().breadcrumbItems; return () => null } }), {
      global: { plugins: [router], provide: { qdadmHomeRoute: 'log-errors' } },
    })
    await flushPromises()
    const homeCrumbs = items.value.filter((i) => i.to?.name === 'log-errors' || i.label === 'log-errors')
    expect(homeCrumbs.length).toBeGreaterThan(0)
    expect(homeCrumbs.every((i) => i.icon === 'pi pi-home')).toBe(true)
  })
})

describe('homeRoute meta and props (#5443)', () => {
  it("the page route carries the app's meta and props", () => {
    const C = Page('home')
    const [, page] = homeRouteRecords({ name: 'home', path: 'home', component: C, meta: { title: 'Welcome', breadcrumb: [] }, props: { mode: 'board' } })
    expect(page).toMatchObject({ name: 'home', path: 'home', meta: { title: 'Welcome', breadcrumb: [] }, props: { mode: 'board' } })
    const [only] = homeRouteRecords({ name: 'home', component: C, meta: { domain: 'global' } }, () => {})
    expect(only.meta).toEqual({ domain: 'global' })
  })
})
