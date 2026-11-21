/**
 * Tests for useNavContext.modeToggle (#1332)
 *
 * The View↔Edit breadcrumb toggle: non-null only on an entity-show/entity-edit
 * terminal whose twin-mode route exists, permission-gated on the Edit side.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useNavContext } from '../../src/composables/useNavContext'
import { I18N_INJECTION_KEY } from '../../src/i18n/useI18n'
import { I18n } from '../../src/i18n/I18n'

const Stub = { template: '<div />' }

function createTestRouter({ withShow = true, withEdit = true, idParam = 'id' } = {}) {
  const routes = [
    { path: '/', name: 'home', component: Stub },
    { path: '/bots', name: 'bots', meta: { entity: 'bots' }, component: Stub },
    { path: '/bots/create', name: 'bots-create', meta: { entity: 'bots' }, component: Stub },
  ]
  if (withShow) {
    routes.push({
      path: `/bots/:${idParam}`,
      name: 'bots-show',
      meta: { entity: 'bots' },
      component: Stub,
    })
  }
  if (withEdit) {
    routes.push({
      path: `/bots/:${idParam}/edit`,
      name: 'bots-edit',
      meta: { entity: 'bots' },
      component: Stub,
    })
  }
  return createRouter({ history: createMemoryHistory(), routes })
}

function createManager(overrides = {}) {
  return {
    idField: 'id',
    routePrefix: 'bots',
    labelPlural: 'Bots',
    getEntityLabel: () => 'Bot',
    canUpdate: () => true,
    ...overrides,
  }
}

async function mountNav(router, { manager = createManager(), path = '/bots/1', i18n = null, home = null, domain = null } = {}) {
  await router.push(path)
  await router.isReady()

  let nav
  const Harness = defineComponent({
    setup() {
      nav = useNavContext()
      return () => h('div')
    },
  })

  const provide = {
    qdadmOrchestrator: { get: (name) => (name === 'bots' ? manager : null) },
    qdadmStackHydrator: { getLevels: () => [] },
  }
  if (i18n) provide[I18N_INJECTION_KEY] = i18n
  if (home) provide.qdadmHomeRoute = home
  if (domain) provide.qdadmActiveStack = { getLevels: () => [], getDomain: () => ({ name: domain }) }

  const wrapper = mount(Harness, { global: { plugins: [router], provide } })
  await flushPromises()
  return { nav, wrapper }
}

describe('useNavContext modeToggle (#1332)', () => {
  it('offers the Edit toggle on a show page when the edit twin exists', async () => {
    const { nav } = await mountNav(createTestRouter(), { path: '/bots/1' })

    expect(nav.modeToggle.value).toEqual({
      current: 'show',
      target: 'edit',
      to: { name: 'bots-edit', params: { id: '1' } },
      label: 'Edit',
    })
  })

  it('offers the View toggle on an edit page when the show twin exists', async () => {
    const { nav } = await mountNav(createTestRouter(), { path: '/bots/1/edit' })

    expect(nav.modeToggle.value).toEqual({
      current: 'edit',
      target: 'show',
      to: { name: 'bots-show', params: { id: '1' } },
      label: 'View',
    })
  })

  it('returns null when the twin-mode route does not exist', async () => {
    // Edit-only entity: on the edit page, the show twin is missing
    const { nav } = await mountNav(createTestRouter({ withShow: false }), {
      path: '/bots/1/edit',
    })

    expect(nav.modeToggle.value).toBeNull()
  })

  it('gates the Edit toggle on manager.canUpdate', async () => {
    const manager = createManager({ canUpdate: () => false })
    const { nav } = await mountNav(createTestRouter(), { path: '/bots/1', manager })

    expect(nav.modeToggle.value).toBeNull()
  })

  it('does not gate the View toggle on canUpdate (edit → show always allowed)', async () => {
    const manager = createManager({ canUpdate: () => false })
    const { nav } = await mountNav(createTestRouter(), { path: '/bots/1/edit', manager })

    expect(nav.modeToggle.value).toMatchObject({ target: 'show' })
  })

  it('returns null on non-item terminals (list, create)', async () => {
    const router = createTestRouter()
    const { nav: listNav } = await mountNav(router, { path: '/bots' })
    expect(listNav.modeToggle.value).toBeNull()

    const { nav: createNav } = await mountNav(createTestRouter(), { path: '/bots/create' })
    expect(createNav.modeToggle.value).toBeNull()
  })

  it("maps the route param through the manager's idField", async () => {
    const manager = createManager({ idField: 'uuid' })
    const { nav } = await mountNav(createTestRouter({ idParam: 'uuid' }), {
      path: '/bots/abc-42',
      manager,
    })

    expect(nav.modeToggle.value.to).toEqual({ name: 'bots-edit', params: { uuid: 'abc-42' } })
  })

  it('modeLinks mirrors modeToggle on item pages (single opposite entry)', async () => {
    const { nav } = await mountNav(createTestRouter(), { path: '/bots/1' })

    expect(nav.modeLinks.value).toHaveLength(1)
    expect(nav.modeLinks.value[0]).toMatchObject({ current: 'show', target: 'edit' })
  })

  it('keeps the linked list crumb on the create page (#1356)', async () => {
    const { nav } = await mountNav(createTestRouter(), { path: '/bots/create' })

    expect(nav.breadcrumb.value).toEqual([
      { label: 'Bots', to: { name: 'bots' } },
      { label: 'Create' },
    ])
  })

  it('resolves the label from the i18n catalog when the key exists', async () => {
    const i18n = {
      locale: ref('fr'),
      t: (key) => key,
      resolve: (key) =>
        key === 'breadcrumb.edit' ? { hit: true, result: 'Éditer' } : { hit: false, result: key },
    }
    const { nav } = await mountNav(createTestRouter(), { path: '/bots/1', i18n })

    expect(nav.modeToggle.value.label).toBe('Éditer')
  })
})

describe('useNavContext modeLinks on child pages (#1353)', () => {
  function createChildRouter({ withShow = true, withEdit = true } = {}) {
    const routes = [
      { path: '/', name: 'home', component: Stub },
      { path: '/bots', name: 'bots', meta: { entity: 'bots' }, component: Stub },
      {
        path: '/bots/:id/tasks',
        name: 'bot-tasks',
        meta: { entity: 'tasks', layout: 'list', parent: { entity: 'bots', param: 'id' } },
        component: Stub,
      },
    ]
    if (withShow) {
      routes.push({ path: '/bots/:id', name: 'bots-show', meta: { entity: 'bots' }, component: Stub })
    }
    if (withEdit) {
      routes.push({
        path: '/bots/:id/edit',
        name: 'bots-edit',
        meta: { entity: 'bots' },
        component: Stub,
      })
    }
    return createRouter({ history: createMemoryHistory(), routes })
  }

  it("offers the PARENT's View|Edit pair on a child-list page", async () => {
    const { nav } = await mountNav(createChildRouter(), { path: '/bots/1/tasks' })

    expect(nav.modeToggle.value).toBeNull()
    expect(nav.modeLinks.value).toEqual([
      { target: 'show', to: { name: 'bots-show', params: { id: '1' } }, label: 'View' },
      { target: 'edit', to: { name: 'bots-edit', params: { id: '1' } }, label: 'Edit' },
    ])
  })

  it('drops the Edit entry when canUpdate denies', async () => {
    const manager = createManager({ canUpdate: () => false })
    const { nav } = await mountNav(createChildRouter(), { path: '/bots/1/tasks', manager })

    expect(nav.modeLinks.value).toEqual([
      { target: 'show', to: { name: 'bots-show', params: { id: '1' } }, label: 'View' },
    ])
  })

  it('drops an entry whose route does not exist', async () => {
    const { nav } = await mountNav(createChildRouter({ withShow: false }), {
      path: '/bots/1/tasks',
    })

    expect(nav.modeLinks.value).toEqual([
      { target: 'edit', to: { name: 'bots-edit', params: { id: '1' } }, label: 'Edit' },
    ])
  })

  it('returns no links on non-child list pages', async () => {
    const { nav } = await mountNav(createChildRouter(), { path: '/bots' })

    expect(nav.modeLinks.value).toEqual([])
  })
})

describe('useNavContext inside a tabbed item (#4978)', () => {
  // The frame of ctx.itemTabs('bots'): the tabs are the navigation
  function createFramedRouter({ framed = true } = {}) {
    const pages = [
      { path: '', name: 'bots-show', meta: { entity: 'bots' }, component: Stub },
      { path: 'tasks', name: 'bot-tasks', meta: { entity: 'tasks', layout: 'list', parent: { entity: 'bots', param: 'id' } }, component: Stub },
      { path: 'guide', name: 'bot-guide', meta: { layout: 'page', parent: { entity: 'bots', param: 'id' } }, component: Stub },
    ]
    const routes = [
      { path: '/', name: 'home', component: Stub },
      { path: '/bots', name: 'bots', meta: { entity: 'bots' }, component: Stub },
      { path: '/bots/:id/edit', name: 'bots-edit', meta: { entity: 'bots' }, component: Stub },
    ]
    if (framed) {
      routes.push({ path: '/bots/:id', component: Stub, meta: { itemTabs: { entity: 'bots', param: 'id' } }, children: pages })
    } else {
      for (const p of pages) routes.push({ ...p, path: p.path ? `/bots/:id/${p.path}` : '/bots/:id' })
    }
    return createRouter({ history: createMemoryHistory(), routes })
  }

  it('the sibling links and View go quiet; Edit stays', async () => {
    const { nav } = await mountNav(createFramedRouter(), { path: '/bots/1/guide' })
    expect(nav.navlinks.value).toEqual([])
    expect(nav.modeLinks.value).toEqual([
      { target: 'edit', to: { name: 'bots-edit', params: { id: '1' } }, label: 'Edit' },
    ])
  })

  it('outside a frame, nothing changes', async () => {
    const { nav } = await mountNav(createFramedRouter({ framed: false }), { path: '/bots/1/guide' })
    // The registry holds no siblings here: the Details link alone
    expect(nav.navlinks.value.map((l) => l.label)).toEqual(['Details'])
    expect(nav.modeLinks.value.map((l) => l.target)).toEqual(['show', 'edit'])
  })
})

describe('useNavContext labels follow the i18n locale (#4147)', () => {
  it('reads Home and Create from the catalog, English without a kernel', async () => {
    const i18n = new I18n({ defaultLocale: 'fr' })
    await i18n.bootstrap()
    const fr = await mountNav(createTestRouter(), { path: '/bots/create', i18n, home: 'home' })
    expect(fr.nav.breadcrumb.value.map((c) => c.label)).toEqual(['Accueil', 'Bots', 'Créer'])

    const en = await mountNav(createTestRouter(), { path: '/bots/create', home: 'home' })
    expect(en.nav.breadcrumb.value.map((c) => c.label)).toEqual(['Home', 'Bots', 'Create'])
  })
})

describe("a record's crumb opens the record (#4685)", () => {
  it('the item segment goes to the show page when there is one, else the form', async () => {
    const both = await mountNav(createTestRouter(), { path: '/bots/1/edit' })
    expect(both.nav.navChain.value.find((s) => s.type === 'item').routeName).toBe('bots-show')
    const editOnly = await mountNav(createTestRouter({ withShow: false }), { path: '/bots/1/edit' })
    expect(editOnly.nav.navChain.value.find((s) => s.type === 'item').routeName).toBe('bots-edit')
  })
})

describe('the home trail and unnamed routes (#5443)', () => {
  const routes = () =>
    createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/home', name: 'home', component: Stub },
        { path: '/stats', name: 'book-stats', component: Stub },
        { path: '/report', name: 'report', meta: { navLabel: 'Report' }, component: Stub },
      ],
    })

  it('the home page: Home alone', async () => {
    const { nav } = await mountNav(routes(), { path: '/home', home: 'home' })
    expect(nav.breadcrumb.value).toEqual([{ label: 'Home', to: null, icon: 'pi pi-home' }])
  })

  it('a route nothing names is left out, with a warning; a named one keeps its label', async () => {
    const { resetRouteCrumbWarnings } = await import('../../src/composables/routeCrumbLabel')
    resetRouteCrumbWarnings()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = import.meta.env.DEV
    import.meta.env.DEV = true
    try {
      const { nav } = await mountNav(routes(), { path: '/stats', home: 'home' })
      expect(nav.breadcrumb.value.map((c) => c.label)).toEqual(['Home'])
      expect(warn.mock.calls.flat().join(' ')).toMatch(/the route 'book-stats' has no label/)
      const named = await mountNav(routes(), { path: '/report', home: 'home' })
      expect(named.nav.breadcrumb.value.map((c) => c.label)).toEqual(['Home', 'Report'])
    } finally {
      import.meta.env.DEV = env
      warn.mockRestore()
    }
  })
})

describe("the domain's crumb on its own board (#5443)", () => {
  it('the board says the domain once, as on its other pages', async () => {
    const { registerDomain, resetDomains } = await import('../../src/domain/registry')
    resetDomains()
    registerDomain('library', { label: 'Library', to: { name: 'board' } })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/home', name: 'home', component: Stub },
        { path: '/board', name: 'board', meta: { navLabel: 'Library' }, component: Stub },
        { path: '/report', name: 'report', meta: { navLabel: 'Report' }, component: Stub },
      ],
    })
    const board = await mountNav(router, { path: '/board', home: 'home', domain: 'library' })
    expect(board.nav.breadcrumb.value.map((c) => c.label)).toEqual(['Home', 'Library'])
    const other = await mountNav(router, { path: '/report', home: 'home', domain: 'library' })
    expect(other.nav.breadcrumb.value.map((c) => [c.label, c.to?.name ?? null])).toEqual([['Home', 'home'], ['Library', 'board'], ['Report', null]])
    resetDomains()
  })
})
