/**
 * A route nav entry gated by `permission` instead of `entity` (#4318).
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useNavigation } from '../../src/composables/useNavigation'
import { registry, resetRegistry } from '../../src/module/moduleRegistry'

const page = { template: '<div />' }

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: page },
      { path: '/settings', name: 'settings', component: page, meta: { breadcrumb: [{ kind: 'route', route: 'settings' }] } },
      {
        path: '/settings/filters',
        name: 'settings-filters',
        component: page,
        meta: { breadcrumb: [{ kind: 'route', route: 'settings' }, { kind: 'route', route: 'settings-filters' }] },
      },
      { path: '/offers', name: 'offers', component: page, meta: { breadcrumb: [{ kind: 'entity-list', entity: 'offers' }] } },
    ],
  })
}

async function mountNav({ at = '/', security = null, orchestrator = null } = {}) {
  const router = createTestRouter()
  await router.push(at)
  let nav
  mount(
    {
      template: '<div />',
      setup() {
        nav = useNavigation()
        return {}
      },
    },
    {
      global: {
        plugins: [router],
        provide: { qdadmOrchestrator: orchestrator, qdadmHooks: null, ...(security ? { qdadmSecurityChecker: security } : {}) },
      },
    }
  )
  await flushPromises()
  return nav
}

const labels = (nav) => nav.navSections.value.flatMap((s) => s.items.map((i) => i.label))

describe('a route nav entry with permission (#4318)', () => {
  beforeEach(() => {
    resetRegistry()
    registry.addNavItem({ section: 'Admin', route: 'settings', label: 'Settings', permission: 'admin:settings' })
    registry.addNavItem({ section: 'Admin', route: 'home', label: 'Home' })
  })

  it('is hidden from whoever is not granted it', async () => {
    expect(labels(await mountNav({ security: { isGranted: () => false } }))).toEqual(['Home'])
    expect(labels(await mountNav({ security: { isGranted: (a) => a === 'admin:settings' } }))).toEqual(['Settings', 'Home'])
  })

  it('is shown when the app has no security checker', async () => {
    expect(labels(await mountNav())).toEqual(['Settings', 'Home'])
  })

  it('lights on its own page and its children, not on an entity list', async () => {
    const security = { isGranted: () => true }
    const item = (nav) => nav.navSections.value[0].items[0]
    let nav = await mountNav({ at: '/settings', security })
    expect(nav.isNavActive(item(nav))).toBe(true)
    nav = await mountNav({ at: '/settings/filters', security })
    expect(nav.isNavActive(item(nav))).toBe(true)
    nav = await mountNav({ at: '/offers', security })
    expect(nav.isNavActive(item(nav))).toBe(false)
  })

  it('with entity too, needs both the permission and the entity right', async () => {
    resetRegistry()
    registry.addNavItem({ section: 'Admin', route: 'offers', label: 'Offers', entity: 'offers', permission: 'offers:feed' })
    const orchestrator = (canRead) => ({ get: () => ({ canRead: () => canRead }) })
    const granted = { isGranted: () => true }
    const denied = { isGranted: () => false }
    expect(labels(await mountNav({ security: granted, orchestrator: orchestrator(true) }))).toEqual(['Offers'])
    expect(labels(await mountNav({ security: denied, orchestrator: orchestrator(true) }))).toEqual([])
    expect(labels(await mountNav({ security: granted, orchestrator: orchestrator(false) }))).toEqual([])
  })
})
