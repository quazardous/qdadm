/**
 * Tests for useNavContext.modeToggle (#1332)
 *
 * The View↔Edit breadcrumb toggle: non-null only on an entity-show/entity-edit
 * terminal whose twin-mode route exists, permission-gated on the Edit side.
 */
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useNavContext } from '../../src/composables/useNavContext'
import { I18N_INJECTION_KEY } from '../../src/i18n/useI18n'

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

async function mountNav(router, { manager = createManager(), path = '/bots/1', i18n = null } = {}) {
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
