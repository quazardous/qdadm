/**
 * Small additions that would have spared a newcomer hand-written code
 * (#4687): a retry on QdPending, useAsyncRead that starts over on a new key,
 * finding the run about a record, and a MockApiStorage that behaves like a
 * remote server.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, ref, nextTick } from 'vue'
import PrimeVue from 'primevue/config'
import { useAsyncRead } from '../../src/composables/useAsyncRead'
import QdPending from '../../src/components/display/QdPending.vue'
import { getTaskStore, registerTaskKind } from '../../src/tasks/taskStore'
import { MockApiStorage } from '../../src/entity/storage/MockApiStorage'

describe('QdPending retry (#4687)', () => {
  it('a failed read shows Retry next to "Unavailable", which reads again', async () => {
    let calls = 0
    const read = useAsyncRead(async () => {
      if (++calls === 1) throw new Error('timeout')
      return 'in place'
    })
    const w = mount(QdPending, { props: { read }, slots: { default: ({ value }) => h('b', { class: 'final' }, value) }, global: { plugins: [PrimeVue] } })
    await flushPromises()
    await w.find('.qd-pending-retry').trigger('click')
    await flushPromises()
    expect(calls).toBe(2)
    expect(w.find('.final').text()).toBe('in place')
  })

  it(':retry="false" drops it', async () => {
    const read = useAsyncRead(async () => {
      throw new Error('timeout')
    })
    const w = mount(QdPending, { props: { read, retry: false }, global: { plugins: [PrimeVue] } })
    await flushPromises()
    expect(w.find('.qd-pending--failed').exists()).toBe(true)
    expect(w.find('.qd-pending-retry').exists()).toBe(false)
  })
})

describe('useAsyncRead with a key (#4687)', () => {
  it('a new key reads again from scratch: never the previous record under the next', async () => {
    const id = ref(1)
    const answers = {}
    const read = useAsyncRead(() => new Promise((resolve) => (answers[id.value] = resolve)), { key: () => id.value })
    answers[1]('lead time of 1')
    await flushPromises()
    expect(read.data.value).toBe('lead time of 1')
    id.value = 2
    await nextTick()
    expect(read.ready.value).toBe(false)
    expect(read.data.value).toBeUndefined()
    expect(read.loading.value).toBe(true)
    answers[2]('lead time of 2')
    await flushPromises()
    expect(read.data.value).toBe('lead time of 2')
  })
})

describe('the run about a record (#4687)', () => {
  const store = getTaskStore()
  beforeEach(() => {
    store.reset()
    sessionStorage.clear()
  })

  it('runFor finds the latest run of a kind by its meta or its task id; meta survives a reload', async () => {
    registerTaskKind('stock-check', { task: { get: vi.fn(async () => ({ status: 'running' })), intervalMs: 60_000 } })
    let n = 40
    const start = async () => ({ task_id: ++n })
    await store.run({ kind: 'stock-check', label: 'Check 7', start, meta: { supplierId: 7 }, open: false })
    await store.run({ kind: 'stock-check', label: 'Check 8', start, meta: { supplierId: 8 }, open: false })
    await store.run({ kind: 'stock-check', label: 'Check 7 again', start, meta: { supplierId: 7 }, open: false })
    expect(store.runFor('stock-check', { supplierId: 7 }).label).toBe('Check 7 again')
    expect(store.runFor('stock-check', 42).meta).toEqual({ supplierId: 8 })
    expect(store.runsFor({ meta: { supplierId: 7 } }).map((r) => r.label)).toEqual(['Check 7 again', 'Check 7'])
    expect(store.runFor('stock-check', { supplierId: 9 })).toBeNull()
    expect(JSON.parse(sessionStorage.getItem('qdadm:tasks')).map((r) => r.meta)).toContainEqual({ supplierId: 8 })
  })
})

describe('MockApiStorage like a remote server (#4687)', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('latency: each call waits', async () => {
    vi.useFakeTimers()
    const storage = new MockApiStorage({ entityName: 'suppliers', initialData: [{ id: '1', name: 'Acme' }], latency: [200, 400] })
    let done = false
    const call = storage.get('1').then(() => (done = true))
    await vi.advanceTimersByTimeAsync(150)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(300)
    await call
    expect(done).toBe(true)
  })

  it('failRate: a call may fail with a 503; off by default', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
    const flaky = new MockApiStorage({ entityName: 'suppliers', initialData: [{ id: '1', name: 'Acme' }], failRate: 0.05 })
    await expect(flaky.list()).rejects.toMatchObject({ status: 503 })
    const steady = new MockApiStorage({ entityName: 'deliveries', initialData: [{ id: '1' }] })
    await expect(steady.list()).resolves.toMatchObject({ total: 1 })
  })
})
