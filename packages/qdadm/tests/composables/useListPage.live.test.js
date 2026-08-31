/**
 * useListPage × live entities — the wiring, not the mechanism (#1888, #1887).
 *
 * useLiveEntity is covered on its own with a hand-provided signal bus. That
 * proves the mechanism and nothing about whether useListPage actually reaches
 * it — the seam where a feature silently fails to exist. These mount the real
 * composable and push a real remote event through the real bus.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { useListPage } from '../../src/composables/useListPage'
import { createSignalBus } from '../../src/kernel/SignalBus'

const mockRouter = { push: vi.fn(), replace: vi.fn() }
vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => ({ name: 'run', params: {}, query: {}, meta: {} }),
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }))

function createManager(live) {
  const items = [
    { id: 1, name: 'first' },
    { id: 2, name: 'second' },
  ]
  return {
    name: 'runs',
    label: 'Run',
    labelPlural: 'Runs',
    routePrefix: 'run',
    idField: 'id',
    localFilterThreshold: 100,
    ...(live === undefined ? {} : { live }),
    getListFields: () => [{ name: 'name', type: 'text', label: 'Name' }],
    getFieldConfig: () => null,
    list: vi.fn().mockResolvedValue({ items, total: items.length }),
    query: vi.fn().mockResolvedValue({ items, total: items.length, fromCache: false }),
    delete: vi.fn(),
    invalidateCache: vi.fn(),
    canCreate: () => true,
    canUpdate: () => true,
    canDelete: () => true,
  }
}

function mountList(manager, signals) {
  let list
  const wrapper = mount(
    {
      template: '<div></div>',
      setup() {
        list = useListPage({ entity: 'runs' })
        return {}
      },
    },
    {
      global: {
        provide: {
          qdadmOrchestrator: { get: () => manager },
          qdadmSignals: signals,
          qdadmEntityFilters: {},
        },
      },
    }
  )
  return { wrapper, list: () => list }
}

const remote = (extra = {}) => ({
  entity: 'runs',
  action: 'updated',
  source: 'remote',
  ...extra,
})

describe('useListPage — live refresh wiring', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('reloads on a remote change without the page wiring anything', async () => {
    const manager = createManager()
    const signals = createSignalBus()
    const { wrapper } = mountList(manager, signals)

    await vi.runOnlyPendingTimersAsync()
    await flushPromises()
    const afterMount = manager.query.mock.calls.length
    expect(afterMount).toBeGreaterThan(0)

    signals.emit('entity:data-invalidate', remote())
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(manager.query.mock.calls.length).toBeGreaterThan(afterMount)
    wrapper.unmount()
  })

  it('stays put on a local echo', async () => {
    const manager = createManager()
    const signals = createSignalBus()
    const { wrapper } = mountList(manager, signals)

    await vi.runOnlyPendingTimersAsync()
    await flushPromises()
    const afterMount = manager.query.mock.calls.length

    signals.emit('entity:data-invalidate', { entity: 'runs', source: 'local' })
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(manager.query.mock.calls.length).toBe(afterMount)
    wrapper.unmount()
  })

  it('honours refresh:false — the entity policy actually reaches the page', async () => {
    const manager = createManager({ refresh: false })
    const signals = createSignalBus()
    const { wrapper } = mountList(manager, signals)

    await vi.runOnlyPendingTimersAsync()
    await flushPromises()
    const afterMount = manager.query.mock.calls.length

    signals.emit('entity:data-invalidate', remote())
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()

    expect(manager.query.mock.calls.length).toBe(afterMount)
    wrapper.unmount()
  })

  it('keeps the selection across a live reload', async () => {
    const manager = createManager()
    const signals = createSignalBus()
    const { wrapper, list } = mountList(manager, signals)

    await vi.runOnlyPendingTimersAsync()
    await flushPromises()

    // Someone is mid-bulk-action when the backend pushes.
    list().selected.value = [{ id: 1, name: 'first' }]

    signals.emit('entity:data-invalidate', remote())
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(list().selected.value.map((i) => i.id)).toEqual([1])
    wrapper.unmount()
  })

  it('drops from the selection what vanished server-side', async () => {
    const manager = createManager()
    const signals = createSignalBus()
    const { wrapper, list } = mountList(manager, signals)

    await vi.runOnlyPendingTimersAsync()
    await flushPromises()

    list().selected.value = [{ id: 99, name: 'deleted elsewhere' }]

    signals.emit('entity:data-invalidate', remote({ action: 'deleted' }))
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(list().selected.value).toEqual([])
    wrapper.unmount()
  })
})
