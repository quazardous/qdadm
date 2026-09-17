/**
 * One notification zone that keeps a trace of what happened (#2677).
 *
 * Toasts display as before and are also recorded, for as long as their keep
 * level says; the badge shows the unread count and a ring while tracked work
 * lasts; an entry with `to` leads back to what it is about.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createNotificationStore, NOTIFICATION_KEY } from '../../src/notifications/NotificationStore'
import { createSignalBus } from '../../src/kernel/SignalBus'

const toastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }))
const routerPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
  RouterLink: { name: 'RouterLink', props: ['to'], template: '<a><slot /></a>' },
}))

import ToastListener from '../../src/toast/ToastListener.vue'
import NotificationBadge from '../../src/notifications/NotificationBadge.vue'
import NotificationPanel from '../../src/notifications/NotificationPanel.vue'

beforeEach(() => {
  vi.useFakeTimers()
  toastAdd.mockClear()
  routerPush.mockClear()
})
afterEach(() => vi.useRealTimers())

describe('keep levels', () => {
  it('keeps success and info briefly, warnings and errors until cleared', () => {
    const store = createNotificationStore()
    store.addNotification({ severity: 'success', summary: 'Saved' })
    store.addNotification({ severity: 'error', summary: 'Failed' })

    const [error, success] = store.notifications.value
    expect(success.keep).toBe('short')
    expect(success.expiresAt).toBe(success.timestamp + 5 * 60 * 1000)
    expect(error.keep).toBe('long')
    expect(error.expiresAt).toBeNull()
  })

  it('drops a short entry when it expires, read or not; a long one stays', () => {
    const store = createNotificationStore()
    store.addNotification({ severity: 'info', summary: 'Autosaved' })
    store.addNotification({ severity: 'warn', summary: 'Quota at 90%' })

    vi.advanceTimersByTime(5 * 60 * 1000 - 1)
    expect(store.notifications.value).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(store.notifications.value.map((n) => n.summary)).toEqual(['Quota at 90%'])
  })

  it('records nothing for keep: none', () => {
    const store = createNotificationStore()
    expect(store.addNotification({ severity: 'info', summary: 'Chatty', keep: 'none' })).toBe('')
    expect(store.notifications.value).toHaveLength(0)
  })

  it('takes the app defaults and duration, and a per-entry override', () => {
    const store = createNotificationStore({ keep: { success: 'none', warn: 'short' }, shortKeepMs: 1000 })
    store.addNotification({ severity: 'success', summary: 'dropped by default' })
    store.addNotification({ severity: 'success', summary: 'kept on purpose', keep: 'long' })
    store.addNotification({ severity: 'warn', summary: 'short by app choice' })

    expect(store.notifications.value.map((n) => n.summary)).toEqual(['short by app choice', 'kept on purpose'])
    vi.advanceTimersByTime(1000)
    expect(store.notifications.value.map((n) => n.summary)).toEqual(['kept on purpose'])
  })
})

describe('activity', () => {
  const settleAfter = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  it('shows nothing for work shorter than 400 ms', async () => {
    const store = createNotificationStore()
    store.track(settleAfter(300))

    await vi.advanceTimersByTimeAsync(300)
    expect(store.isBusy.value).toBe(false)
    await vi.advanceTimersByTimeAsync(500)
    expect(store.isBusy.value).toBe(false)
  })

  it('shows longer work from 400 ms until the last tracked work settles', async () => {
    const store = createNotificationStore()
    store.track(settleAfter(1000))
    store.track(settleAfter(1500))

    await vi.advanceTimersByTimeAsync(399)
    expect(store.isBusy.value).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(store.isBusy.value).toBe(true)
    await vi.advanceTimersByTimeAsync(600)
    expect(store.isBusy.value).toBe(true)
    await vi.advanceTimersByTimeAsync(500)
    expect(store.isBusy.value).toBe(false)
  })

  it('returns the promise unchanged, and a rejected one still settles the count', async () => {
    const store = createNotificationStore()
    await expect(store.track(Promise.resolve(42))).resolves.toBe(42)
    await expect(store.track(Promise.reject(new Error('nope')))).rejects.toThrow('nope')
    await vi.advanceTimersByTimeAsync(400)
    expect(store.isBusy.value).toBe(false)
  })
})

describe('toasts leave a trace', () => {
  const mountListener = (provide) => mount(ToastListener, { global: { provide } })

  it('pops as before and is recorded, with its keep level and link', () => {
    const signals = createSignalBus()
    const store = createNotificationStore()
    mountListener({ qdadmSignals: signals, [NOTIFICATION_KEY]: store })

    signals.emit('toast:warn', { summary: 'Import', detail: '3 rows skipped', life: 5000, keep: 'long', to: { name: 'imports' } })

    expect(toastAdd).toHaveBeenCalledWith({ severity: 'warn', summary: 'Import', detail: '3 rows skipped', life: 5000 })
    expect(store.notifications.value[0]).toMatchObject({
      severity: 'warn', summary: 'Import', detail: '3 rows skipped', keep: 'long', to: { name: 'imports' },
    })
  })

  it('still pops a keep: none toast, without recording it', () => {
    const signals = createSignalBus()
    const store = createNotificationStore()
    mountListener({ qdadmSignals: signals, [NOTIFICATION_KEY]: store })

    signals.emit('toast:info', { summary: 'Autosaved', keep: 'none' })
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(store.notifications.value).toHaveLength(0)
  })

  it('pops without notifications enabled, as before', () => {
    const signals = createSignalBus()
    mountListener({ qdadmSignals: signals })

    signals.emit('toast:success', { summary: 'Saved' })
    expect(toastAdd).toHaveBeenCalledTimes(1)
  })
})

describe('flash (#2679)', () => {
  it('flashes at once, for a short while', () => {
    const store = createNotificationStore()
    store.flash()
    expect(store.isFlashing.value).toBe(true)
    vi.advanceTimersByTime(899)
    expect(store.isFlashing.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(store.isFlashing.value).toBe(false)
  })

  it('a burst flashes once: calls during a flash do not extend it', () => {
    const store = createNotificationStore()
    store.flash()
    vi.advanceTimersByTime(500)
    store.flash()
    vi.advanceTimersByTime(400)
    expect(store.isFlashing.value).toBe(false)
  })

  it('does not wait like the activity ring does', async () => {
    const store = createNotificationStore()
    store.track(new Promise((resolve) => setTimeout(resolve, 100)))
    store.flash()
    expect(store.isFlashing.value).toBe(true)
    expect(store.isBusy.value).toBe(false)
  })
})

describe('useSignalToast carries keep and to (#2677)', () => {
  it('forwards them to the toast signal, so a component can set them', async () => {
    const { useSignalToast } = await import('../../src/toast/useSignalToast')
    const signals = createSignalBus()
    const seen = vi.fn()
    signals.on('toast:warn', (event) => seen(event.data))
    let toast
    mount({ template: '<div />', setup() { toast = useSignalToast('Test'); return {} } }, { global: { provide: { qdadmSignals: signals } } })

    toast.warn('Import', '3 skipped', undefined, { keep: 'long', to: { name: 'book' } })
    toast.add({ severity: 'info', summary: 'Quiet', keep: 'none' })

    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ summary: 'Import', keep: 'long', to: { name: 'book' }, emitter: 'Test' }))
  })
})

describe('the badge', () => {
  const mountBadge = (store) => mount(NotificationBadge, { global: { provide: { [NOTIFICATION_KEY]: store } } })

  it('shows how many entries are unread', async () => {
    const store = createNotificationStore()
    const badge = mountBadge(store)
    expect(badge.find('.notification-badge-count').exists()).toBe(false)

    store.addNotification({ severity: 'info', summary: 'a' })
    store.addNotification({ severity: 'info', summary: 'b' })
    await badge.vm.$nextTick()
    expect(badge.find('.notification-badge-count').text()).toBe('2')

    store.markAllRead()
    await badge.vm.$nextTick()
    expect(badge.find('.notification-badge-count').exists()).toBe(false)
  })

  it('flashes when something arrives', async () => {
    const store = createNotificationStore()
    const badge = mountBadge(store)
    store.flash()
    await badge.vm.$nextTick()
    expect(badge.find('.notification-badge-flash').exists()).toBe(true)
    vi.advanceTimersByTime(900)
    await badge.vm.$nextTick()
    expect(badge.find('.notification-badge-flash').exists()).toBe(false)
  })

  it('turns a ring while tracked work lasts', async () => {
    const store = createNotificationStore()
    const badge = mountBadge(store)
    store.track(new Promise((resolve) => setTimeout(resolve, 1000)))

    await vi.advanceTimersByTimeAsync(400)
    expect(badge.find('.notification-badge-ring').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(600)
    expect(badge.find('.notification-badge-ring').exists()).toBe(false)
  })
})

describe('an entry that leads somewhere', () => {
  it('marks it read, closes the panel and goes there', async () => {
    const store = createNotificationStore()
    store.addNotification({ severity: 'info', summary: 'Offer updated elsewhere', to: { name: 'offer-show', params: { id: 7 } } })
    store.open()
    const panel = mount(NotificationPanel, { global: { provide: { [NOTIFICATION_KEY]: store } } })

    await panel.find('.notification-item').trigger('click')

    expect(routerPush).toHaveBeenCalledWith({ name: 'offer-show', params: { id: 7 } })
    expect(store.notifications.value[0].read).toBe(true)
    expect(store.isOpen.value).toBe(false)
  })

  it('an entry without `to` is only marked read', async () => {
    const store = createNotificationStore()
    store.addNotification({ severity: 'info', summary: 'Saved' })
    store.open()
    const panel = mount(NotificationPanel, { global: { provide: { [NOTIFICATION_KEY]: store } } })

    await panel.find('.notification-item').trigger('click')
    expect(routerPush).not.toHaveBeenCalled()
    expect(store.isOpen.value).toBe(true)
  })
})
