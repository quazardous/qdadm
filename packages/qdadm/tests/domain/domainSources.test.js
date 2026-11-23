/**
 * A domain's sources (#5461): a read several indicators share, once per
 * refresh, its error theirs, read again when one of its entities changes;
 * an indicator's own load() as before.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { registerDomain, domainOfRoute, QdDomainBar } from '../../src/domain/index'
import { resetDomains } from '../../src/domain/registry'
import { resetSources, SOURCE_COALESCE_MS } from '../../src/domain/sources'
// The ready-made cards (metric)
import '../../src/cards/index'

const Page = defineComponent({ setup: () => () => h('div') })

/** A signal bus with just what a source listens to */
function makeSignals() {
  const handlers = new Map()
  return {
    on: (signal, fn) => {
      handlers.set(signal, [...(handlers.get(signal) ?? []), fn])
      return () => handlers.set(signal, (handlers.get(signal) ?? []).filter((f) => f !== fn))
    },
    emit: (signal, data) => (handlers.get(signal) ?? []).forEach((fn) => fn({ name: signal, data })),
    count: (signal) => (handlers.get(signal) ?? []).length,
  }
}

async function mountBar(config, signals = makeSignals()) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/board', name: 'board', component: Page, meta: { module: 'tasks' } }] })
  await router.push('/board')
  registerDomain('tasks', config, 'tasks')
  const w = mount(QdDomainBar, { props: { domain: domainOfRoute(router.currentRoute.value) }, attachTo: document.body, global: { plugins: [router], provide: { qdadmSignals: signals } } })
  await flushPromises()
  return { w, signals }
}

const value = (w, id) => w.find(`[data-indicator="${id}"] [data-card-value]`).text()
const state = (w, id) => w.find(`[data-indicator="${id}"]`).attributes('data-state')
const sum = (rows, k) => rows.reduce((n, r) => n + r[k], 0)

function counts(load, more = {}) {
  return {
    label: 'Tasks',
    sources: { counts: { load, ...more } },
    indicators: [
      { id: 'todo', card: 'metric', title: 'To process', source: 'counts', value: (c) => ({ value: sum(c, 'count') }) },
      { id: 'late', card: 'metric', title: 'Overdue', source: 'counts', value: (c) => ({ value: sum(c, 'overdue') }) },
    ],
  }
}

beforeEach(() => {
  resetDomains()
  resetSources()
  localStorage.clear()
})
afterEach(() => vi.useRealTimers())

describe("a domain's sources (#5461)", () => {
  it('one read for every indicator naming it, each its own part', async () => {
    const load = vi.fn(async () => [{ count: 3, overdue: 1 }, { count: 4, overdue: 2 }])
    const { w } = await mountBar(counts(load))
    expect(load).toHaveBeenCalledTimes(1)
    expect(value(w, 'todo')).toBe('7')
    expect(value(w, 'late')).toBe('3')
    w.unmount()
  })

  it('its error is on each indicator that reads it', async () => {
    const { w } = await mountBar(counts(async () => { throw new Error('timeout') }))
    expect(state(w, 'todo')).toBe('unreachable')
    expect(state(w, 'late')).toBe('unreachable')
    expect(w.find('[data-indicator="late"] .qd-card-sr').text()).toContain('timeout')
    w.unmount()
  })

  it('every refresh: one read again; still fresh when the bar comes back', async () => {
    vi.useFakeTimers()
    let n = 0
    const load = vi.fn(async () => [{ count: ++n, overdue: 0 }])
    let { w } = await mountBar(counts(load, { refresh: 60 }))
    expect(value(w, 'todo')).toBe('1')
    await vi.advanceTimersByTimeAsync(60000)
    await flushPromises()
    expect(load).toHaveBeenCalledTimes(2)
    expect(value(w, 'todo')).toBe('2')
    // Gone: no more reads; back within the refresh, the answer kept
    const config = w.props('domain')
    w.unmount()
    await vi.advanceTimersByTimeAsync(120000)
    expect(load).toHaveBeenCalledTimes(2)
    // Reading the same declaration again (a domain change and back)
    ;({ w } = await (async () => {
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/board', name: 'board', component: Page }] })
      await router.push('/board')
      const m = mount(QdDomainBar, { props: { domain: config }, global: { plugins: [router], provide: { qdadmSignals: makeSignals() } } })
      await flushPromises()
      return { w: m }
    })())
    // Stale by now (120 s > 60 s): read once more
    expect(load).toHaveBeenCalledTimes(3)
    w.unmount()
  })

  it('a change to one of its entities reads it again, once for a burst; other entities, nothing', async () => {
    vi.useFakeTimers()
    let n = 0
    const load = vi.fn(async () => [{ count: ++n, overdue: 0 }])
    const { w, signals } = await mountBar(counts(load, { entities: ['tasks'] }))
    expect(load).toHaveBeenCalledTimes(1)
    signals.emit('entity:data-invalidate', { entity: 'tasks', action: 'updated', source: 'local' })
    signals.emit('entity:data-invalidate', { entity: 'tasks', action: 'created', source: 'remote' })
    signals.emit('entity:data-invalidate', { entity: 'books', action: 'updated', source: 'local' })
    await vi.advanceTimersByTimeAsync(SOURCE_COALESCE_MS + 10)
    await flushPromises()
    expect(load).toHaveBeenCalledTimes(2)
    expect(value(w, 'todo')).toBe('2')
    signals.emit('entity:data-invalidate', { entity: 'books', action: 'updated', source: 'local' })
    await vi.advanceTimersByTimeAsync(SOURCE_COALESCE_MS + 10)
    expect(load).toHaveBeenCalledTimes(2)
    // Unmounted: it stops listening
    w.unmount()
    expect(signals.count('entity:data-invalidate')).toBe(0)
  })

  it("an indicator's own load() as before; an unknown source said and drawn invalid", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { w } = await mountBar({
      label: 'Tasks',
      indicators: [
        { id: 'own', card: 'metric', title: 'Own', load: async () => ({ value: 5 }) },
        { id: 'lost', card: 'metric', title: 'Lost', source: 'nope' },
      ],
    })
    expect(value(w, 'own')).toBe('5')
    expect(state(w, 'lost')).toBe('invalid')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("reads the source 'nope', which the domain does not declare"))
    warn.mockRestore()
    w.unmount()
  })

  it('a bar back within the refresh reads nothing: the answer is still fresh', async () => {
    const load = vi.fn(async () => [{ count: 2, overdue: 1 }])
    const config = counts(load, { refresh: 60 })
    let { w } = await mountBar(config)
    w.unmount()
    ;({ w } = await mountBar(config))
    expect(load).toHaveBeenCalledTimes(1)
    expect(value(w, 'late')).toBe('1')
    w.unmount()
  })

  it('without value(), the whole answer', async () => {
    const { w } = await mountBar({
      label: 'Tasks',
      sources: { total: { load: async () => ({ value: 9 }) } },
      indicators: [{ id: 't', card: 'metric', title: 'T', source: 'total' }],
    })
    expect(value(w, 't')).toBe('9')
    w.unmount()
  })
})
