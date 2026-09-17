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
