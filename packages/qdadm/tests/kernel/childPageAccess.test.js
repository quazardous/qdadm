/**
 * A child page is governed by its parent item (#4962): the router guard checks
 * the parent's read right through meta.parent, `childPage({ permission })`
 * adds one on top, and PageNav leaves out the links the user cannot open —
 * the same rule as the guard and the menu (security/routeAccess).
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { Kernel } from '../../src/kernel/Kernel'
import { KernelContext } from '../../src/kernel/KernelContext'
import { Module } from '../../src/kernel/Module'
import { getRoutes, resetRegistry } from '../../src/module/moduleRegistry'
import PageNav from '../../src/components/layout/PageNav.vue'
import { canOpenRoute, routeDenial } from '../../src/security/routeAccess'

const noopPage = () => Promise.resolve({ default: { template: '<div />' } })

function makeGuard({ granted = () => true, manager }) {
  let guard = null
  const kernel = {
    options: { authAdapter: { isAuthenticated: () => true }, debug: false },
    securityChecker: { isGranted: vi.fn(granted) },
    signals: { on: vi.fn(), emit: vi.fn() },
    orchestrator: {
      isRegistered: vi.fn((name) => name === 'instances'),
      get: vi.fn(() => manager),
      toast: { error: vi.fn(), warn: vi.fn() },
    },
    router: { beforeEach: vi.fn((fn) => { guard = fn }), hasRoute: () => false },
  }
  Kernel.prototype._setupAuthGuard.call(kernel)
  return { kernel, guard: (...args) => guard(...args) }
}

const to = (path, ...metas) => ({ path, meta: Object.assign({}, ...metas), matched: metas.map((meta) => ({ meta })) })
const childMeta = (extra = {}) => ({ layout: 'page', parent: { entity: 'instances', param: 'name' }, ...extra })

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('router guard on a child page (#4962)', () => {
  it("refuses it to whoever cannot read the parent item", () => {
    const { kernel, guard } = makeGuard({ manager: { canRead: () => false, labelPlural: 'Instances' } })
    expect(guard(to('/instances/prod/guide', childMeta()), {})).toEqual({ path: '/' })
    expect(kernel.signals.emit).toHaveBeenCalledWith('auth:access-denied', expect.objectContaining({ entity: 'instances' }))
  })

  it('lets a reader in', () => {
    const { guard } = makeGuard({ manager: { canRead: () => true, canList: () => false } })
    // read, not list: a child page runs on an item
    expect(guard(to('/instances/prod/guide', childMeta()), {})).toBeUndefined()
  })

  it('an extra permission is checked on top', () => {
    const { guard } = makeGuard({ granted: (p) => p !== 'entity:instances:update', manager: { canRead: () => true } })
    expect(guard(to('/instances/prod/deploy', childMeta({ permission: 'entity:instances:update' })), {})).toEqual({ path: '/' })
  })

  it('a child route with its own entity keeps its own check', () => {
    const { kernel, guard } = makeGuard({ manager: { canRead: () => true, canList: () => true } })
    guard(to('/instances/prod/backups', { entity: 'instances', entityAction: 'list', parent: { entity: 'instances', param: 'name' } }), {})
    expect(kernel.orchestrator.get).toHaveBeenCalledWith('instances')
  })
})

describe('ctx.childPage({ permission })', () => {
  beforeEach(() => resetRegistry())

  it('sets meta.permission on the route', () => {
    const kernel = {
      orchestrator: { isRegistered: () => true, get: () => ({ idField: 'name' }) },
      options: {},
      _pendingProvides: new Map(),
      _pendingComponents: new Map(),
    }
    const ctx = new KernelContext(kernel, new Module())
    ctx.crud('c62instances', { list: noopPage })
    ctx.childPage('c62instance', 'deploy', { component: noopPage, permission: 'entity:instances:update' })
    ctx.childPage('c62instance', 'guide', { component: noopPage })
    const byName = Object.fromEntries(getRoutes().map((r) => [r.name, r.meta?.permission]))
    expect(byName['c62instance-deploy']).toBe('entity:instances:update')
    expect(byName['c62instance-guide']).toBeUndefined()
  })
})

describe('routeAccess', () => {
  const deps = (granted, canRead = true) => ({
    checker: { isGranted: (p) => granted.includes(p) },
    orchestrator: { isRegistered: () => true, get: () => ({ canRead: () => canRead, canList: () => false }) },
  })

  it('names what is missing: a permission first, then the entity', () => {
    expect(routeDenial(to('/x', childMeta({ permission: 'a' })), deps([]))).toEqual({ kind: 'permission', permission: 'a' })
    expect(routeDenial(to('/x', childMeta()), deps([], false))).toMatchObject({ kind: 'entity', entity: 'instances', action: 'read' })
    expect(canOpenRoute(to('/x', childMeta({ permission: 'a' })), deps(['a']))).toBe(true)
  })

  it('without a checker, permissions are not checked', () => {
    expect(canOpenRoute(to('/x', childMeta({ permission: 'a' })), { orchestrator: null, checker: null })).toBe(true)
  })
})

describe('PageNav leaves out what the user cannot open (#4962)', () => {
  beforeEach(() => resetRegistry())

  async function mountNav({ granted }) {
    const kernel = {
      orchestrator: { isRegistered: () => true, get: () => ({ idField: 'name' }) },
      options: {},
      _pendingProvides: new Map(),
      _pendingComponents: new Map(),
    }
    const ctx = new KernelContext(kernel, new Module())
    ctx.crud('navinstances', { list: noopPage, show: noopPage })
    ctx.childPage('navinstance-show', 'guide', { component: noopPage })
    ctx.childPage('navinstance-show', 'deploy', { component: noopPage, permission: 'entity:instances:update' })

    const routes = getRoutes().map((r) => ({ ...r, path: `/${r.path}`, component: { template: '<div />' } }))
    const router = createRouter({ history: createMemoryHistory(), routes })
    const guide = routes.find((r) => r.name === 'navinstance-show-guide')
    await router.push(guide.path.replace(/:[^/]+/, 'prod'))

    const navlinks = ref(null)
    const manager = { idField: 'name', labelPlural: 'Instances', routePrefix: 'navinstance', canRead: () => true }
    mount(PageNav, {
      global: {
        plugins: [router],
        provide: {
          qdadmNavlinksOverride: navlinks,
          qdadmOrchestrator: { isRegistered: () => true, get: () => manager },
          qdadmSecurityChecker: { isGranted: (p) => granted.includes(p) },
        },
      },
    })
    await flushPromises()
    return navlinks.value.map((l) => l.to.name)
  }

  it('hides the page that needs a permission the user lacks', async () => {
    expect(await mountNav({ granted: [] })).toEqual(['navinstance-show-guide'])
  })

  it('shows it to whoever has it', async () => {
    expect(await mountNav({ granted: ['entity:instances:update'] })).toEqual(['navinstance-show-guide', 'navinstance-show-deploy'])
  })
})
