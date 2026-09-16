/**
 * A detail page subscribes to its record (#2664).
 *
 * The backend only sends a record's changes to the tabs that asked for it:
 * POST {session, entity, id} while the page shows the record, renewed at half
 * of expires_in, DELETE when it leaves. Nothing of this may break the page.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useLiveEntity } from '../../src/composables/useLiveEntity'
import { createSignalBus } from '../../src/kernel/SignalBus'

const URL = '/events/subscriptions'
const body = (id) => ({ session: 'tab-1', entity: 'offers', id })

function fakeApi({ expiresIn = 120, fail = false } = {}) {
  return {
    post: vi.fn(async () => {
      if (fail) throw Object.assign(new Error('nope'), { response: { status: 403 } })
      return { data: { entity: 'offers', expires_in: expiresIn } }
    }),
    request: vi.fn(async () => ({ data: { removed: true } })),
  }
}

function mountPage({ api, id = ref('7'), subscriptions = { url: URL, session: 'tab-1' }, manager = null, debug = false, withId = true } = {}) {
  const Page = defineComponent({
    setup() {
      useLiveEntity('offers', manager, () => {}, withId ? { id: () => id.value } : {})
      return () => h('div')
    },
  })
  const wrapper = mount(Page, {
    global: {
      provide: {
        qdadmSignals: createSignalBus(),
        qdadmSSESubscriptions: subscriptions,
        qdadmApiClient: api,
        qdadmDebug: debug,
      },
    },
  })
  return { wrapper, id }
}

describe('useLiveEntity subscribes a detail page to its record (#2664)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('subscribes when the page shows the record, as this tab', async () => {
    const api = fakeApi()
    mountPage({ api })
    await flushPromises()

    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith(URL, body('7'))
  })

  it('renews at half of expires_in', async () => {
    const api = fakeApi({ expiresIn: 120 })
    mountPage({ api })
    await flushPromises()

    await vi.advanceTimersByTimeAsync(59_000)
    expect(api.post).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(api.post).toHaveBeenCalledTimes(2)
  })

  it('unsubscribes when the page leaves, and stops renewing', async () => {
    const api = fakeApi()
    const { wrapper } = mountPage({ api })
    await flushPromises()

    wrapper.unmount()
    expect(api.request).toHaveBeenCalledWith({ method: 'DELETE', url: URL, data: body('7') })

    await vi.advanceTimersByTimeAsync(120_000)
    expect(api.post).toHaveBeenCalledTimes(1)
  })

  it('moves the subscription when the page shows another record', async () => {
    const api = fakeApi()
    const { id } = mountPage({ api })
    await flushPromises()

    id.value = '8'
    await nextTick()
    await flushPromises()

    expect(api.request).toHaveBeenCalledWith({ method: 'DELETE', url: URL, data: body('7') })
    expect(api.post).toHaveBeenLastCalledWith(URL, body('8'))
  })

  describe('subscribes only when it makes sense', () => {
    it('not without sse.subscriptions', async () => {
      const api = fakeApi()
      mountPage({ api, subscriptions: null })
      await flushPromises()
      expect(api.post).not.toHaveBeenCalled()
    })

    it('not without a record id — a list does not subscribe', async () => {
      const api = fakeApi()
      mountPage({ api, withId: false })
      await flushPromises()
      expect(api.post).not.toHaveBeenCalled()
    })

    it('not for an entity that does not refresh its screens', async () => {
      const api = fakeApi()
      mountPage({ api, manager: { live: { refresh: false } } })
      await flushPromises()
      expect(api.post).not.toHaveBeenCalled()
    })
  })

  describe('never breaks the page', () => {
    it('a refused subscription is silent outside debug mode', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { wrapper } = mountPage({ api: fakeApi({ fail: true }) })
      await flushPromises()

      expect(wrapper.exists()).toBe(true)
      expect(warn).not.toHaveBeenCalled()
    })

    it('and says so in debug mode, with the entity, the id and the status', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mountPage({ api: fakeApi({ fail: true }), debug: true })
      await flushPromises()

      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0][0])).toMatch(/live subscription subscribe failed for offers #7 \(403\)/)
    })
  })
})
