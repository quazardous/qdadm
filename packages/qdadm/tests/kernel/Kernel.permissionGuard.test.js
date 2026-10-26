/**
 * The router guard refuses a page by permission (#4332): every matched
 * record's meta.permission, a list needing every entry, waiting for a
 * request-based judge, failing closed; a nav entry takes its route's
 * permission; ctx.routes(..., { permission }) sets it on the group.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { Kernel } from '../../src/kernel/Kernel'
import { useNavigation } from '../../src/composables/useNavigation'
import { registry, resetRegistry, getRoutes } from '../../src/module/moduleRegistry'

function makeKernel({ granted = () => true, checker = true, judge = null, manager = null } = {}) {
  let guard = null
  const kernel = {
    options: { authAdapter: { isAuthenticated: () => true }, debug: false, security: { readyTimeoutMs: 50 } },
    securityChecker: checker ? { isGranted: vi.fn(granted), ...(judge ? { grant: judge } : {}) } : null,
    signals: { on: vi.fn(), emit: vi.fn() },
    orchestrator: {
      isRegistered: vi.fn(() => !!manager),
      get: vi.fn(() => manager),
      toast: { error: vi.fn(), warn: vi.fn() },
    },
    router: { beforeEach: vi.fn((fn) => { guard = fn }), hasRoute: () => false },
  }
  Kernel.prototype._setupAuthGuard.call(kernel)
  return { kernel, guard: (...args) => guard(...args) }
}

// A route location: matched records from parent to child
const to = (path, ...metas) => ({ path, meta: Object.assign({}, ...metas), matched: metas.map((meta) => ({ meta })) })

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('router guard: meta.permission (#4332)', () => {
  it('refuses a page whose permission is not granted: toast, signal, back to /', () => {
    const { kernel, guard } = makeKernel({ granted: () => false })
    expect(guard(to('/settings', { permission: 'admin:settings' }), {})).toEqual({ path: '/' })
    expect(kernel.orchestrator.toast.error).toHaveBeenCalledWith('Access Denied', expect.any(String), 'Kernel')
    expect(kernel.signals.emit).toHaveBeenCalledWith('auth:access-denied', { path: '/settings', permission: 'admin:settings' })
  })

  it('lets a granted user in', () => {
    const { guard } = makeKernel({ granted: (p) => p === 'admin:settings' })
    expect(guard(to('/settings', { permission: 'admin:settings' }), {})).toBeUndefined()
  })

  it("a parent's permission covers its children; a list needs every entry", () => {
    const { kernel, guard } = makeKernel({ granted: (p) => p !== 'ops:export' })
    expect(guard(to('/ops/export', { permission: 'ops:read' }, { permission: ['ops:read', 'ops:export'] }), {})).toEqual({ path: '/' })
    expect(kernel.signals.emit).toHaveBeenCalledWith('auth:access-denied', expect.objectContaining({ permission: 'ops:export' }))
    expect(guard(to('/ops/view', { permission: 'ops:read' }, {}), {})).toBeUndefined()
  })

  it('without a security checker, nothing is checked', () => {
    const { guard } = makeKernel({ checker: false })
    expect(guard(to('/settings', { permission: 'admin:settings' }), {})).toBeUndefined()
  })

  it('fails closed when the checker throws', () => {
    const { guard } = makeKernel({ granted: () => { throw new Error('backend down') } })
    expect(guard(to('/settings', { permission: 'admin:settings' }), {})).toEqual({ path: '/' })
  })

  it('waits for a request-based judge, then decides; a judge that never settles denies', async () => {
    let release
    const ready = new Promise((r) => (release = r))
    const judge = { ready: () => ready, isGranted: () => undefined }
    let answer = false
    const { guard } = makeKernel({ granted: () => answer, judge })
    const pending = guard(to('/settings', { permission: 'admin:settings' }), {})
    expect(pending).toBeInstanceOf(Promise)
    answer = true
    release()
    expect(await pending).toBeUndefined()

    const stuck = makeKernel({ judge: { ready: () => new Promise(() => {}), isGranted: () => undefined } })
    expect(await stuck.guard(to('/settings', { permission: 'admin:settings' }), {})).toEqual({ path: '/' })
  })

  it('the entity check still applies after the permission one', () => {
    const { guard } = makeKernel({ granted: () => true, manager: { canRead: () => false, labelPlural: 'Books' } })
    expect(guard(to('/books/stats', { permission: 'books:stats', entity: 'books' }), {})).toEqual({ path: '/' })
  })
})

describe('declared once (#4332)', () => {
  beforeEach(() => resetRegistry())

  it('ctx.routes options.permission sets it on every route, unless a route has its own', () => {
    registry.addRoutes('ops', [
      { path: 'a', name: 'ops-a', component: {} },
      { path: 'b', name: 'ops-b', component: {}, meta: { permission: 'ops:b' } },
    ], { permission: 'ops:read' })
    const byName = Object.fromEntries(getRoutes().map((r) => [r.name, r.meta.permission]))
    expect(byName).toEqual({ 'ops-a': 'ops:read', 'ops-b': 'ops:b' })
  })

  it("a route nav entry without permission takes its route's", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div />' } },
        { path: '/settings', name: 'settings', component: { template: '<div />' }, meta: { permission: 'admin:settings' } },
      ],
    })
    await router.push('/')
    registry.addNavItem({ section: 'Admin', route: 'settings', label: 'Settings' })
    registry.addNavItem({ section: 'Admin', route: 'home', label: 'Home' })
    let nav
    mount({ template: '<div />', setup() { nav = useNavigation(); return {} } }, {
      global: { plugins: [router], provide: { qdadmOrchestrator: null, qdadmHooks: null, qdadmSecurityChecker: { isGranted: () => false } } },
    })
    await flushPromises()
    expect(nav.navSections.value.flatMap((s) => s.items.map((i) => i.label))).toEqual(['Home'])
  })
})
