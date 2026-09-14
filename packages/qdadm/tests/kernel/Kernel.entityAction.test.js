/**
 * A list page and its menu entry follow `list`, not `read` (#2497).
 *
 * Roles can grant `entity:<x>:read` and `entity:<x>:list` separately. The
 * route guard and the menu both checked `read`, so a role granted List
 * without Read lost the menu entry and the list page, and a role granted Read
 * without List was shown a list it may not list.
 *
 * NOTE: the module registry is global — entity names are unique per test.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { Kernel } from '../../src/kernel/Kernel'
import { KernelContext } from '../../src/kernel/KernelContext'
import { Module } from '../../src/kernel/Module'
import { getRoutes, registry, resetRegistry } from '../../src/module/moduleRegistry'
import { createHookRegistry } from '../../src/hooks/HookRegistry'
import { useNavigation } from '../../src/composables/useNavigation'

const noopPage = () => Promise.resolve({ default: {} })

/** A manager whose grants are given as a list of actions. */
const grants = (...actions) => ({
  labelPlural: 'Things',
  canRead: () => actions.includes('read'),
  canList: () => actions.includes('list'),
})

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('ctx.crud() routes declare the action they perform', () => {
  it('list → list, show → read; forms declare nothing (unchanged)', () => {
    const kernel = {
      orchestrator: { isRegistered: () => true, get: () => ({ idField: 'id' }) },
      options: {},
      _pendingProvides: new Map(),
      _pendingComponents: new Map(),
    }
    new KernelContext(kernel, new Module()).crud('ea1things', { list: noopPage, show: noopPage, form: noopPage })
    const route = (name) => getRoutes().find((r) => r.name === name)

    expect(route('ea1thing').meta.entityAction).toBe('list')
    expect(route('ea1thing-show').meta.entityAction).toBe('read')
    expect(route('ea1thing-edit').meta?.entityAction).toBeUndefined()
  })
})

describe('the entity route guard checks the declared action', () => {
  function guardFor(manager) {
    let guard = null
    const kernel = {
      options: { authAdapter: { isAuthenticated: () => true }, debug: false },
      securityChecker: null,
      signals: { on: vi.fn(), emit: vi.fn() },
      orchestrator: {
        isRegistered: () => true,
        get: () => manager,
        toast: { error: vi.fn(), warn: vi.fn() },
      },
      router: { beforeEach: (fn) => { guard = fn }, hasRoute: () => false },
    }
    Kernel.prototype._setupAuthGuard.call(kernel)
    return (entityAction) => guard({ path: '/things', matched: [], meta: { entity: 'things', entityAction } }, {})
  }

  it('lets List-without-Read open the list', () => {
    expect(guardFor(grants('list'))('list')).toBeUndefined()
  })

  it('refuses Read-without-List on the list', () => {
    expect(guardFor(grants('read'))('list')).toEqual({ path: '/' })
  })

  it('still checks read on a show route', () => {
    expect(guardFor(grants('list'))('read')).toEqual({ path: '/' })
    expect(guardFor(grants('read'))('read')).toBeUndefined()
  })

  it('checks read on a route that declares no action — a custom page', () => {
    expect(guardFor(grants('list'))(undefined)).toEqual({ path: '/' })
    expect(guardFor(grants('read'))(undefined)).toBeUndefined()
  })
})

describe('a menu entry follows the route it opens', () => {
  let hooks
  beforeEach(() => {
    resetRegistry()
    hooks = createHookRegistry()
  })
  afterEach(() => hooks.dispose())

  async function visibleItems(manager) {
    registry.addNavItem({ section: 'Admin', route: 'ea-things', label: 'Things', entity: 'things' })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: { render: () => null } },
        { path: '/things', name: 'ea-things', component: { render: () => null }, meta: { entityAction: 'list' } },
      ],
    })
    await router.push('/')
    let sections = null
    mount(
      defineComponent({
        setup() {
          sections = useNavigation().navSections
          return () => h('div')
        },
      }),
      { global: { plugins: [router], provide: { qdadmHooks: hooks, qdadmOrchestrator: { get: () => manager } } } }
    )
    await flushPromises()
    await nextTick()
    return (sections.value[0]?.items ?? []).map((i) => i.route)
  }

  it('shows the entry to List-without-Read', async () => {
    expect(await visibleItems(grants('list'))).toEqual(['ea-things'])
  })

  it('hides it from Read-without-List', async () => {
    expect(await visibleItems(grants('read'))).toEqual([])
  })
})
