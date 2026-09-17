/**
 * A change made elsewhere to the record on screen leaves a line (#2677).
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createNotificationStore, NOTIFICATION_KEY } from '../../src/notifications/NotificationStore'
import { createSignalBus } from '../../src/kernel/SignalBus'

vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'offer-show', params: { id: '7' }, query: {} }),
  useRouter: () => ({ push: vi.fn(), resolve: vi.fn(() => ({ href: '' })) }),
}))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }))

import { useEntityItemShowPage } from '../../src/composables/useEntityItemShowPage'

function mountShow({ store, signals, get, live = { coalesceMs: 0 } }) {
  const manager = {
    name: 'offers',
    label: 'Offer',
    labelPlural: 'Offers',
    idField: 'id',
    routePrefix: 'offer',
    get,
    getEntityLabel: (d) => d?.title ?? null,
    getFieldConfig: () => null,
    getShowFields: () => [],
    getFormFields: () => [],
    canRead: () => true,
    canUpdate: () => true,
    canDelete: () => true,
    live,
  }
  mount({ template: '<div />', setup() { useEntityItemShowPage({ entity: 'offers' }); return {} } }, {
    global: {
      provide: {
        qdadmOrchestrator: { get: () => manager, isRegistered: () => true, toast: { success: vi.fn(), error: vi.fn() } },
        qdadmSignals: signals,
        [NOTIFICATION_KEY]: store,
      },
    },
  })
}

describe('a detail page reloaded by a change made elsewhere (#2677)', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('adds one short, linked entry and no toast', async () => {
    const store = createNotificationStore()
    const signals = createSignalBus()
    const toasts = vi.fn()
    signals.on('toast:*', toasts)
    const get = vi.fn().mockResolvedValue({ id: 7, title: 'Dune' })
    mountShow({ store, signals, get })
    await flushPromises()
    expect(store.notifications.value).toHaveLength(0)

    signals.emit('entity:data-invalidate', { entity: 'offers', id: 7, source: 'remote' })
    await flushPromises()

    expect(store.notifications.value).toHaveLength(1)
    expect(store.notifications.value[0]).toMatchObject({
      severity: 'info',
      summary: 'Offer "Dune" updated elsewhere',
      keep: 'short',
      to: { name: 'offer-show', params: { id: '7' } },
    })
    expect(toasts).not.toHaveBeenCalled()
  })

  it('flashes the badge as soon as the update arrives, before the reload ends (#2679)', async () => {
    const store = createNotificationStore()
    const signals = createSignalBus()
    const get = vi.fn()
      .mockResolvedValueOnce({ id: 7, title: 'Dune' })
      .mockReturnValueOnce(new Promise(() => {})) // a reload that never ends
    mountShow({ store, signals, get, live: {} }) // the default 300 ms coalescing window
    await flushPromises()
    expect(store.isFlashing.value).toBe(false)

    signals.emit('entity:data-invalidate', { entity: 'offers', id: 7, source: 'remote' })
    // At once — before any coalescing window or reload.
    expect(store.isFlashing.value).toBe(true)
    await flushPromises()
    expect(store.notifications.value).toHaveLength(0) // the entry waits for the reload; the flash does not
  })

  it('adds nothing for the page’s own first load', async () => {
    const store = createNotificationStore()
    mountShow({ store, signals: createSignalBus(), get: vi.fn().mockResolvedValue({ id: 7, title: 'Dune' }) })
    await flushPromises()
    expect(store.notifications.value).toHaveLength(0)
    expect(store.isFlashing.value).toBe(false)
  })
})

describe('an entity that describes its own live updates (#2685)', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  async function reloadWith(describeUpdate, { events = 1, coalesceMs = 0 } = {}) {
    const store = createNotificationStore()
    const signals = createSignalBus()
    let version = 0
    const get = vi.fn().mockImplementation(async () => ({ id: 7, title: 'Dune', version: version++ }))
    mountShow({ store, signals, get, live: { coalesceMs, describeUpdate } })
    await flushPromises()
    for (let i = 0; i < events; i++) signals.emit('entity:data-invalidate', { entity: 'offers', id: 7, source: 'remote' })
    if (coalesceMs) await new Promise((r) => setTimeout(r, coalesceMs + 20))
    await flushPromises()
    return { store, get }
  }

  it('adds no entry when the hook says the update carries nothing — the badge still flashes', async () => {
    const { store } = await reloadWith(() => null)
    expect(store.notifications.value).toHaveLength(0)
    expect(store.isFlashing.value).toBe(true)
  })

  it('adds the entry the hook returns, with the defaults it leaves out', async () => {
    const describeUpdate = vi.fn((before, after) => ({ summary: `Offer "${after.title}" judged`, detail: `v${before.version} → v${after.version}` }))
    const { store } = await reloadWith(describeUpdate)
    expect(describeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ version: 0 }),
      expect.objectContaining({ version: 1 }),
    )
    expect(store.notifications.value).toHaveLength(1)
    expect(store.notifications.value[0]).toMatchObject({
      severity: 'info',
      summary: 'Offer "Dune" judged',
      detail: 'v0 → v1',
      keep: 'short',
      to: { name: 'offer-show', params: { id: '7' } },
    })
  })

  it('lets the hook override severity, keep and link', async () => {
    const { store } = await reloadWith(() => ({ summary: 'Judged', severity: 'success', keep: 'long', to: '/offers' }))
    expect(store.notifications.value[0]).toMatchObject({ severity: 'success', keep: 'long', to: '/offers' })
  })

  it('adds no entry and warns when the hook throws', async () => {
    const { store, get } = await reloadWith(() => { throw new Error('boom') })
    expect(get).toHaveBeenCalledTimes(2)
    expect(store.notifications.value).toHaveLength(0)
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('live.describeUpdate failed for offers #7'), expect.any(Error))
  })

  it('is called once for a burst, with the record from before it and the one after', async () => {
    const describeUpdate = vi.fn(() => null)
    const { get } = await reloadWith(describeUpdate, { events: 3, coalesceMs: 50 })
    expect(get).toHaveBeenCalledTimes(2)
    expect(describeUpdate).toHaveBeenCalledTimes(1)
    expect(describeUpdate).toHaveBeenCalledWith(expect.objectContaining({ version: 0 }), expect.objectContaining({ version: 1 }))
  })
})
