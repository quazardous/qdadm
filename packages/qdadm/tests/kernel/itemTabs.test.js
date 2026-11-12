/**
 * A tabbed item (#4963): `ctx.itemTabs(entity)` nests the item's pages under
 * one frame route, whose EntityItemLayout shows the header, a tab per page the
 * user may open, and the page in its router-view. Names and paths unchanged.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, h, defineComponent } from 'vue'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { KernelContext } from '../../src/kernel/KernelContext'
import { Module } from '../../src/kernel/Module'
import { getRoutes, getItemTabs, resetRegistry } from '../../src/module/moduleRegistry'
import { nestItemTabs } from '../../src/kernel/itemTabs'
import PageNav from '../../src/components/layout/PageNav.vue'

const page = (name) => () => Promise.resolve({ default: defineComponent({ name, render: () => h('div', { class: `page-${name}` }, [h(PageNav)]) }) })

function declare({ show = true, details } = {}) {
  const kernel = {
    orchestrator: { isRegistered: () => true, get: (n) => ({ idField: n === 'tabinstances' ? 'name' : 'id' }) },
    options: {},
    _pendingProvides: new Map(),
    _pendingComponents: new Map(),
  }
  const ctx = new KernelContext(kernel, new Module())
  ctx.crud('tabinstances', show ? { list: page('list'), show: page('show'), form: page('form') } : { list: page('list') })
  const parent = show ? 'tabinstance-show' : 'tabinstance'
  ctx.childPage(parent, 'guide', { component: page('guide'), label: 'Guide' })
  ctx.childPage(parent, 'deploy', { component: page('deploy'), label: 'Deploy', permission: 'entity:instances:update' })
  // One param for the whole item: a child crud would namespace it otherwise
  ctx.crud('tabbackups', { list: page('backups'), form: page('backup-form') }, { parentRoute: parent, parentParam: 'name' })
  ctx.itemTabs('tabinstances', details === undefined ? {} : { details })
}

beforeEach(() => {
  resetRegistry()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('nestItemTabs', () => {
  it("nests the item's pages under one frame, names and full paths unchanged", () => {
    declare()
    const flat = getRoutes()
    const nested = nestItemTabs(flat, getItemTabs())
    const frame = nested.find((r) => r.meta?.itemTabs)
    expect(frame.path).toBe(flat.find((r) => r.name === 'tabinstance-show').path)
    expect(frame.name).toBeUndefined()
    expect(frame.meta.itemTabs).toMatchObject({ entity: 'tabinstances' })
    const names = frame.children.map((c) => c.name)
    expect(names).toEqual(expect.arrayContaining(['tabinstance-show', 'tabinstance-show-guide', 'tabinstance-show-deploy', 'tabinstance-show-tabbackup', 'tabinstance-show-tabbackup-create', 'tabinstance-show-tabbackup-edit']))
    for (const child of frame.children) {
      const original = flat.find((r) => r.name === child.name)
      expect(child.path === '' ? frame.path : `${frame.path}/${child.path}`).toBe(original.path)
      expect(child.meta).toEqual(original.meta)
    }
    // The list and the item's own form stay outside
    expect(nested.some((r) => r.name === 'tabinstance')).toBe(true)
    expect(nested.some((r) => r.name === 'tabinstance-edit')).toBe(true)
    expect(nested.length).toBe(flat.length - frame.children.length + 1)
  })

  it('without a show page, the item opens on its first tab', () => {
    declare({ show: false })
    const nested = nestItemTabs(getRoutes(), getItemTabs())
    const frame = nested.find((r) => r.meta?.itemTabs)
    expect(frame.children[0].path).toBe('')
    expect(frame.children[0].redirect({ params: { name: 'prod' } })).toEqual({ name: 'tabinstance-guide', params: { name: 'prod' } })
  })

  it('leaves out, with a warning, a page whose parent param differs', () => {
    const kernel = {
      orchestrator: { isRegistered: () => true, get: (n) => ({ idField: n === 'tabinstances' ? 'name' : 'id' }) },
      options: {}, _pendingProvides: new Map(), _pendingComponents: new Map(),
    }
    const ctx = new KernelContext(kernel, new Module())
    ctx.crud('tabinstances', { list: page('list'), show: page('show') })
    ctx.childPage('tabinstance-show', 'guide', { component: page('guide') })
    // A form gives the child its own :id, so its parent param is namespaced
    ctx.crud('tabbackups', { list: page('backups'), form: page('backup-form') }, { parentRoute: 'tabinstance-show' })
    const nested = nestItemTabs(getRoutes(), new Map([['tabinstances', {}]]))
    const frame = nested.find((r) => r.meta?.itemTabs)
    expect(frame.children.map((c) => c.name)).toEqual(['tabinstance-show', 'tabinstance-show-guide'])
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("parentParam: 'name'"))
  })

  it('warns and changes nothing for an entity without item pages', () => {
    const routes = [{ path: 'x', name: 'x' }]
    expect(nestItemTabs(routes, new Map([['nothing', {}]]))).toEqual(routes)
    expect(console.warn).toHaveBeenCalled()
  })
})

describe('EntityItemLayout', () => {
  async function mountFrame({ granted = [], details, at = 'guide' } = {}) {
    declare({ details })
    const routes = nestItemTabs(getRoutes(), getItemTabs()).map(function abs(r) {
      return { ...r, path: r.path.startsWith('/') || r.path === '' ? r.path : `/${r.path}`, children: r.children?.map((c) => ({ ...c })) }
    })
    const router = createRouter({ history: createMemoryHistory(), routes })
    const frame = routes.find((r) => r.meta?.itemTabs)
    const path = frame.path.replace(/:[^/]+/, 'prod')
    await router.push(at === 'show' ? path : `${path}/${at}`)
    await router.isReady()

    const levels = ref([{ entity: 'tabinstances', id: 'prod', hydrated: true, data: { name: 'prod', site: 'shop.example' } }])
    const navlinks = ref(null)
    const managers = {
      tabinstances: { label: 'Instance', labelPlural: 'Instances', idField: 'name', canRead: () => true, getEntityLabel: (i) => `${i.name} — ${i.site}` },
      tabbackups: { label: 'Backup', labelPlural: 'Backups', canRead: () => true, canList: () => true },
    }
    // The frame route renders EntityItemLayout itself
    const App = defineComponent({ render: () => h(RouterView) })
    const wrapper = mount(App, {
      global: {
        plugins: [router],
        provide: {
          qdadmStackHydrator: { getLevels: () => levels.value, getLevel: () => null, getLevelByEntity: () => null, getCurrent: () => null, getParent: () => null },
          qdadmSignals: null,
          qdadmOrchestrator: { isRegistered: () => true, get: (n) => managers[n] ?? null },
          qdadmSecurityChecker: { isGranted: (p) => granted.includes(p) },
          qdadmNavlinksOverride: navlinks,
        },
      },
    })
    await flushPromises()
    return { wrapper, router, navlinks, path }
  }

  const tabs = (wrapper) => wrapper.findAll('.qd-item-tabs-tab').map((t) => (t.classes('qd-item-tabs-tab--active') ? '*' : '') + t.text())

  it("shows the item's header, the tabs it may open, and the page", async () => {
    const { wrapper } = await mountFrame()
    expect(wrapper.find('.qd-item-tabs-entity').text()).toBe('Instance')
    expect(wrapper.find('.qd-item-tabs-title').text()).toBe('prod — shop.example')
    // Deploy needs entity:instances:update; forms are not tabs
    expect(tabs(wrapper)).toEqual(['Details', '*Guide', 'Backups'])
    expect(wrapper.find('.page-guide').exists()).toBe(true)
  })

  it('a granted user sees the tab; a details label or none', async () => {
    let { wrapper } = await mountFrame({ granted: ['entity:instances:update'], details: 'Overview' })
    expect(tabs(wrapper)).toEqual(['Overview', '*Guide', 'Deploy', 'Backups'])
    resetRegistry()
    ;({ wrapper } = await mountFrame({ details: false }))
    expect(tabs(wrapper)).toEqual(['*Guide', 'Backups'])
  })

  it('a tab switch changes only the page; PageNav inside stays silent', async () => {
    const { wrapper, router, navlinks, path } = await mountFrame()
    const header = wrapper.find('.qd-item-tabs-header').element
    await router.push(`${path}/tabbackups`)
    await flushPromises()
    expect(wrapper.find('.qd-item-tabs-header').element).toBe(header)
    expect(wrapper.find('.page-backups').exists()).toBe(true)
    expect(tabs(wrapper)).toEqual(['Details', 'Guide', '*Backups'])
    expect(navlinks.value).toEqual([])
  })
})
