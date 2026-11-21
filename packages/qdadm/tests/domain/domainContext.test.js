/**
 * The domain in the context stack (#5412): resolved at each route change
 * (meta.domain, ?domain=, the entity, the module, then the app's resolver),
 * held by the active stack beside its entity levels, kept from page to page
 * along a record chain by ?domain=, left from the side menu.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { registerDomain, resolveDomain, domainOfRoute, withDomain, leaveDomain } from '../../src/domain/index'
import { resetDomains } from '../../src/domain/registry'
import { keptDomain, takeLeaveDomain } from '../../src/domain/keep'
import { ActiveStack } from '../../src/chain/ActiveStack'
import { Kernel } from '../../src/kernel/Kernel'

const Page = defineComponent({ setup: () => () => h('div') })

const routes = [
  { path: '/tasks', name: 'task', component: Page, meta: { module: 'tasks', entity: 'tasks' } },
  { path: '/tasks/:id', name: 'task-show', component: Page, meta: { module: 'tasks', entity: 'tasks' } },
  { path: '/tasks/:id/edit', name: 'task-edit', component: Page, meta: { module: 'tasks', entity: 'tasks' } },
  { path: '/tasks/:id/notes', name: 'task-notes', component: Page, meta: { module: 'tasks', entity: 'notes', parent: { entity: 'tasks', param: 'id' } } },
  { path: '/books', name: 'book', component: Page, meta: { module: 'library', entity: 'books' } },
  { path: '/board', name: 'board', component: Page, meta: { module: 'library' } },
  { path: '/private', name: 'private', component: Page, meta: { module: 'tasks', entity: 'tasks', domain: false } },
]

function makeRouter() {
  return createRouter({ history: createMemoryHistory(), routes })
}

beforeEach(() => {
  resetDomains()
  takeLeaveDomain()
  registerDomain('library', { label: 'Library' }, 'library')
  registerDomain('it', { label: 'IT' })
  registerDomain('hr', { label: 'HR' })
})

describe('resolveDomain (#5412)', () => {
  it('the default rule reads ?domain= after meta.domain, before the entity and the module', async () => {
    const router = makeRouter()
    const at = async (p) => {
      await router.push(p)
      const r = resolveDomain(router.currentRoute.value)
      return [r.domain?.name ?? null, r.source]
    }
    expect(await at('/board')).toEqual(['library', 'route'])
    expect(await at('/tasks')).toEqual([null, 'route'])
    expect(await at('/tasks?domain=it')).toEqual(['it', 'query'])
    expect(await at('/books?domain=it')).toEqual(['it', 'query'])
    // A domain nobody declared is ignored; meta.domain false still keeps a page out
    expect(await at('/books?domain=nope')).toEqual(['library', 'route'])
    expect(await at('/private?domain=it')).toEqual([null, 'route'])
    expect(domainOfRoute(router.currentRoute.value)).toBe(null)
  })

  it("the app's resolver has the last word: a name, null for none, undefined to keep the fallback", async () => {
    const router = makeRouter()
    await router.push('/tasks?universe=hr')
    const route = router.currentRoute.value
    const seen = []
    const resolver = (r, ctx) => {
      seen.push(ctx)
      return typeof r.query.universe === 'string' ? r.query.universe : undefined
    }
    expect(resolveDomain(route, { resolver, previous: null, stack: [{ entity: 'tasks', id: null }] })).toMatchObject({ domain: { name: 'hr' }, source: 'resolver' })
    expect(seen[0].fallback).toBe(null)
    expect(seen[0].stack).toEqual([{ entity: 'tasks', id: null }])
    expect(typeof seen[0].getDomain).toBe('function')
    await router.push('/board')
    expect(resolveDomain(router.currentRoute.value, { resolver }).domain.name).toBe('library')
    expect(resolveDomain(router.currentRoute.value, { resolver: () => null })).toEqual({ domain: null, source: 'resolver' })
  })

  it('a resolver that throws, or names an unknown domain, leaves the default answer', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const router = makeRouter()
    await router.push('/board')
    const route = router.currentRoute.value
    expect(resolveDomain(route, { resolver: () => { throw new Error('boom') } }).domain.name).toBe('library')
    expect(resolveDomain(route, { resolver: () => 'nope' }).domain.name).toBe('library')
    warn.mockRestore()
  })
})

describe('the active stack holds the domain (#5412)', () => {
  it('beside its entity levels: context gives the domain first; a change is signalled', () => {
    const emitted = []
    const bus = { emit: (name, payload) => emitted.push([name, payload]) }
    const stack = new ActiveStack(bus)
    stack.setDomain({ name: 'it', source: 'query' })
    stack.set([{ entity: 'tasks', param: 'id', foreignKey: null, id: '12' }])
    expect(stack.getDomain()).toEqual({ type: 'domain', name: 'it', id: null, source: 'query' })
    expect(stack.getRoot().entity).toBe('tasks')
    expect(stack.getContext().map((l) => `${l.type}:${l.name}`)).toEqual(['domain:it', 'entity:tasks'])
    expect(emitted[0]).toEqual(['stack:change', { levels: [], domain: stack.getDomain() }])
    // The same domain again: nothing said
    const before = emitted.length
    stack.setDomain({ name: 'it', source: 'query' })
    expect(emitted.length).toBe(before)
    stack.setDomain(null)
    expect(stack.getContext().map((l) => l.type)).toEqual(['entity'])
  })
})

describe('keeping the domain along a record chain (#5412)', () => {
  const route = (name, query = {}) => {
    const r = routes.find((x) => x.name === name)
    return { name, path: r.path, query, hash: '', meta: r.meta, params: {} }
  }
  const it_q = { name: 'it', source: 'query' }

  it('a record chain keeps it; another entity, a page placed by its route, a side-menu click do not', () => {
    expect(keptDomain(route('task-show'), route('task', { domain: 'it' }), it_q, false)).toBe('it')
    expect(keptDomain(route('task-notes'), route('task-show'), { name: 'it', source: 'resolver' }, false)).toBe('it')
    expect(keptDomain(route('book'), route('task'), it_q, false)).toBe(null)
    expect(keptDomain(route('task-show'), route('task'), { name: 'library', source: 'route' }, false)).toBe(null)
    expect(keptDomain(route('task-show'), route('task'), it_q, true)).toBe(null)
    expect(keptDomain(route('private'), route('task'), it_q, false)).toBe(null)
    expect(keptDomain(route('task-show', { domain: 'hr' }), route('task'), it_q, false)).toBe(null)
  })

  it('withDomain adds ?domain= to a location or a path', () => {
    expect(withDomain({ name: 'task-show', params: { id: 1 } }, 'it')).toEqual({ name: 'task-show', params: { id: 1 }, query: { domain: 'it' } })
    expect(withDomain({ name: 'task', query: { page: '2' } }, 'it')).toEqual({ name: 'task', query: { page: '2', domain: 'it' } })
    expect(withDomain('/tasks?page=2', 'it')).toEqual({ path: '/tasks', query: { page: '2', domain: 'it' } })
    expect(withDomain('/tasks', null)).toBe('/tasks')
  })
})

describe('the kernel resolves and keeps it (#5412)', () => {
  async function boot(features = {}) {
    const router = makeRouter()
    const activeStack = new ActiveStack(null)
    const kernel = Object.create(Kernel.prototype)
    Object.assign(kernel, { router, activeStack, orchestrator: null, options: { features } })
    kernel._setupStackSync()
    return { router, activeStack }
  }

  it('each route change sets the domain, the previous one given to the resolver', async () => {
    const calls = []
    const { router, activeStack } = await boot({
      domainResolver: (r, ctx) => {
        calls.push(ctx.previous?.name ?? null)
        return typeof r.query.universe === 'string' ? r.query.universe : undefined
      },
    })
    await router.push('/board')
    expect(activeStack.getDomain()).toMatchObject({ name: 'library', source: 'route' })
    await router.push('/tasks?universe=it')
    expect(activeStack.getDomain()).toMatchObject({ name: 'it', source: 'resolver' })
    expect(calls.at(-1)).toBe('library')
  })

  it('a record opened from a domain keeps it in its address; a side-menu click leaves it', async () => {
    const { router, activeStack } = await boot()
    await router.push('/tasks?domain=it')
    await router.push('/tasks/12')
    expect(router.currentRoute.value.fullPath).toBe('/tasks/12?domain=it')
    await router.push('/tasks/12/edit')
    expect(router.currentRoute.value.query.domain).toBe('it')
    await router.push('/tasks/12/notes')
    expect(router.currentRoute.value.query.domain).toBe('it')
    expect(activeStack.getDomain()).toMatchObject({ name: 'it', source: 'query' })
    leaveDomain()
    await router.push('/tasks')
    expect(router.currentRoute.value.query.domain).toBeUndefined()
    expect(activeStack.getDomain()).toBe(null)
  })

  it('a page placed by its own route hands nothing on', async () => {
    const { router } = await boot()
    await router.push('/board')
    await router.push('/books')
    expect(router.currentRoute.value.query.domain).toBeUndefined()
  })
})
