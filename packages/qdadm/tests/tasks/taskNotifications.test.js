/**
 * Running tasks in the notification zone (#4171): a status item per running
 * task (a click reopens its dialog), the badge ring while it runs, and the
 * TaskTray only without notifications unless `tasks.tray` says otherwise.
 * The panel and badge strings come from the catalogue.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import PrimeVue from 'primevue/config'
import { getTaskStore } from '../../src/tasks/taskStore'
import TaskHost from '../../src/components/tasks/TaskHost.vue'
import TaskTray from '../../src/components/tasks/TaskTray.vue'
import NotificationPanel from '../../src/notifications/NotificationPanel.vue'
import NotificationBadge from '../../src/notifications/NotificationBadge.vue'
import { createNotificationStore, NOTIFICATION_KEY } from '../../src/notifications/NotificationStore'
import { I18N_INJECTION_KEY } from '../../src/i18n/useI18n'
import { I18n } from '../../src/i18n/I18n'

const store = getTaskStore()

function backend() {
  const records = new Map()
  let next = 1
  return {
    start: vi.fn(async () => {
      const id = next++
      records.set(id, { id, status: 'queued', progress: null })
      return { task_id: id }
    }),
    get: vi.fn(async (id) => ({ ...records.get(id) })),
    set: (id, patch) => records.set(id, { ...records.get(id), ...patch }),
  }
}

function mountApp({ notifications = null, tasks = undefined, i18n = null, children = [TaskHost, TaskTray] } = {}) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
  const provide = {}
  if (notifications) provide[NOTIFICATION_KEY] = notifications
  if (tasks) provide.qdadmTasksConfig = tasks
  if (i18n) provide[I18N_INJECTION_KEY] = i18n
  return mount(defineComponent({ render: () => children.map((c) => h(c)) }), {
    global: { plugins: [PrimeVue, router], provide, directives: { tooltip: {} }, stubs: { teleport: true } },
    attachTo: document.body,
  })
}

beforeEach(() => {
  store.reset()
  sessionStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('running tasks in the notification zone (#4171)', () => {
  it('lists each running task as a status item, which reopens its dialog, and drops it at the end', async () => {
    vi.useFakeTimers()
    const notifications = createNotificationStore({ activityDelayMs: 0 })
    const wrapper = mountApp({ notifications })
    const api = backend()
    await store.run({ label: 'Create box', start: api.start, task: { get: api.get, intervalMs: 1000 }, open: false })
    api.set(1, { status: 'running', progress: 40 })
    await vi.advanceTimersByTimeAsync(1000)
    await nextTick()

    const [item] = notifications.statusItems.value
    expect(item).toMatchObject({ label: 'Create box — 40 %', severity: 'nominal', icon: 'pi pi-spin pi-spinner' })
    expect(notifications.isBusy.value).toBe(true)
    // Only one indicator: no tray while the notification zone is on
    expect(wrapper.find('.qd-task-tray').exists()).toBe(false)

    item.onClick()
    expect(store.state.openId).toBe(store.state.runs[0].id)

    api.set(1, { status: 'done' })
    await vi.advanceTimersByTimeAsync(1000)
    await nextTick()
    expect(notifications.statusItems.value).toEqual([])
    expect(notifications.isBusy.value).toBe(false)
    wrapper.unmount()
  })

  it('tasks.tray: true keeps the tray next to the notification zone; without notifications it shows as before', async () => {
    const api = backend()
    const notifications = createNotificationStore()
    const forced = mountApp({ notifications, tasks: { tray: true } })
    await store.run({ label: 'Refresh db', start: api.start, task: { get: api.get, intervalMs: 60_000 }, open: false })
    await flushPromises()
    expect(forced.find('.qd-task-tray').exists()).toBe(true)
    forced.unmount()

    const plain = mountApp()
    await flushPromises()
    expect(plain.find('.qd-task-tray').exists()).toBe(true)
    plain.unmount()
  })

  it('a status item with onClick runs it and closes the panel', async () => {
    const notifications = createNotificationStore()
    const onClick = vi.fn()
    notifications.registerStatus({ id: 'x', label: 'Reindex — En cours', severity: 'nominal', onClick })
    notifications.open()
    const wrapper = mountApp({ notifications, children: [NotificationPanel] })
    await nextTick()
    await wrapper.find('.notification-status-item').trigger('click')
    expect(onClick).toHaveBeenCalledOnce()
    expect(notifications.isOpen.value).toBe(false)
    wrapper.unmount()
  })

  it('panel and badge strings follow the locale', async () => {
    const i18n = new I18n({ defaultLocale: 'fr' })
    await i18n.bootstrap()
    const notifications = createNotificationStore()
    notifications.addNotification({ severity: 'warn', summary: 'Disk' })
    notifications.addNotification({ severity: 'warn', summary: 'Quota' })
    notifications.open()
    const wrapper = mountApp({ notifications, i18n, children: [NotificationPanel, NotificationBadge] })
    await nextTick()
    const titles = wrapper.findAll('.notification-toolbar-btn').map((b) => b.attributes('title'))
    expect(titles).toEqual(['Tout marquer comme lu', 'Tout effacer', 'Fermer'])
    expect(wrapper.find('.notification-item-time').text()).toBe("à l'instant")
    expect(wrapper.find('.notification-badge-zone').attributes('aria-label')).toBe('Notifications, 2 non lues')

    notifications.clearNotifications()
    await nextTick()
    expect(wrapper.find('.notification-panel-empty').text()).toBe('Aucune notification')
    wrapper.unmount()
  })
})
