/**
 * The TaskRunner's look (#4334): layered window options, slot components,
 * a replacement dialog per kind or app, the tray row, Escape out of full
 * screen, and the remembered size.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import PrimeVue from 'primevue/config'
import { getTaskStore, registerTaskKind } from '../../src/tasks/taskStore'
import { configureTasks, resetTaskUi, resolveTaskUi, TASK_DIALOG_DEFAULTS, TASK_LOG_DEFAULTS } from '../../src/tasks/taskUi'
import TaskHost from '../../src/components/tasks/TaskHost.vue'
import TaskTray from '../../src/components/tasks/TaskTray.vue'
import LogStream from '../../src/components/display/LogStream.vue'

const store = getTaskStore()
const api = () => ({ start: vi.fn(async () => ({ task_id: 7 })), get: vi.fn(async () => ({ id: 7, status: 'running', progress: 40 })) })
const global = { plugins: [PrimeVue], directives: { tooltip: {} }, stubs: { teleport: true } }

function mountHost(slots = {}) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
  return mount(defineComponent({ render: () => [h(TaskHost, null, slots), h(TaskTray)] }), {
    global: { ...global, plugins: [...global.plugins, router], provide: { qdadmApp: { name: 'Cockpit X' } } },
    attachTo: document.body,
  })
}

const Summary = defineComponent({ props: ['run', 'kind', 'final'], render() { return h('p', { class: 'summary' }, `${this.kind}: ${this.run.label}`) } })

let wrapper
beforeEach(() => {
  store.reset()
  resetTaskUi()
  sessionStorage.clear()
  localStorage.clear()
})
afterEach(() => wrapper?.unmount())

describe('layered options (#4334)', () => {
  it('defaults, then the app, then the kind, then the page', () => {
    expect(resolveTaskUi().dialog).toEqual(TASK_DIALOG_DEFAULTS)
    configureTasks({ dialog: { width: '56rem', modal: false } })
    const kind = { dialog: { modal: true, maximizable: false } }
    expect(resolveTaskUi(kind).dialog).toMatchObject({ width: '56rem', modal: true, maximizable: false, draggable: true })
    expect(resolveTaskUi(kind, { width: '30rem' }).dialog.width).toBe('30rem')
  })
})

describe('the log patterns (#4386)', () => {
  const DELIVERY = ['change  M  modules/admicron/cron/shipping_error.php', 'ERROR: rsync refused', '[error] disk full', '→ failed']
  async function deliver(kind = {}, run = {}) {
    const backend = api()
    registerTaskKind('deliver', { task: { get: backend.get, intervalMs: 60_000 }, log: () => ({ lines: DELIVERY }), ...kind })
    wrapper = mountHost()
    await store.run({ label: 'Deliver', kind: 'deliver', start: backend.start, ...run })
    await flushPromises()
    return [...document.querySelectorAll('.qd-log-line--error')].map((l) => l.textContent.trim())
  }

  it('defaults, then the app, then the kind; null turns a pattern off', () => {
    expect(resolveTaskUi().logPatterns).toEqual(TASK_LOG_DEFAULTS)
    configureTasks({ logPatterns: { errorPattern: 'boom', timestampPattern: '\\d+:\\d+' } })
    expect(resolveTaskUi().logPatterns).toEqual({ errorPattern: 'boom', timestampPattern: '\\d+:\\d+' })
    expect(resolveTaskUi({ logPatterns: { errorPattern: null } }).logPatterns).toEqual({ errorPattern: null, timestampPattern: '\\d+:\\d+' })
    expect(resolveTaskUi({ logPatterns: { errorPattern: undefined } }).logPatterns.errorPattern).toBe('boom')
  })

  it('the default flags whole words only: a file name is not an error', async () => {
    const flagged = await deliver()
    expect(flagged.some((l) => l.includes('shipping_error.php'))).toBe(false)
    expect(flagged.length).toBe(3)
  })

  it("the kind's pattern, or a run's, reaches the dialog's log", async () => {
    expect(await deliver({ logPatterns: { errorPattern: /\[error\]|^→ failed/ } })).toHaveLength(2)
    wrapper.unmount()
    store.reset()
    expect(await deliver({}, { logPatterns: { errorPattern: null } })).toHaveLength(0)
    expect(wrapper.findComponent(LogStream).props('errorPattern')).toBeNull()
    expect(document.querySelector('.qd-log-errors')).toBeNull()
  })
})

describe('TaskDialog customised (#4334)', () => {
  it('renders the app and kind slot components with { run, kind, final }', async () => {
    configureTasks({ slots: { 'before-log': defineComponent({ render: () => h('p', { class: 'app-slot' }, 'from the app') }) } })
    const backend = api()
    registerTaskKind('deliver', { task: { get: backend.get, intervalMs: 60_000 }, slots: { 'after-log': Summary } })
    wrapper = mountHost()
    await store.run({ label: 'Deliver v2', kind: 'deliver', start: backend.start })
    await flushPromises()
    expect(document.querySelector('.qd-task-before-log .app-slot').textContent).toBe('from the app')
    expect(document.querySelector('.qd-task-after-log .summary').textContent).toBe('deliver: Deliver v2')
  })

  it('the log downloads under the kind and the task (#4344)', async () => {
    const backend = api()
    registerTaskKind('deliver', { task: { get: backend.get, intervalMs: 60_000 }, log: () => ({ lines: ['one'] }) })
    wrapper = mountHost()
    await store.run({ label: 'Deliver v2', kind: 'deliver', start: backend.start })
    await flushPromises()
    expect(wrapper.findComponent(LogStream).props('filename')).toBe('deliver-7.log')
  })

  it("the host's own slots win over the configured components", async () => {
    configureTasks({ slots: { actions: defineComponent({ render: () => h('button', { class: 'configured' }) }) } })
    const backend = api()
    wrapper = mountHost({ actions: ({ run }) => h('button', { class: 'from-host' }, run.label) })
    await store.run({ label: 'Refresh', start: backend.start, task: { get: backend.get, intervalMs: 60_000 } })
    await flushPromises()
    expect(document.querySelector('.p-dialog-footer .from-host').textContent).toBe('Refresh')
    expect(document.querySelector('.p-dialog-footer .configured')).toBeNull()
  })

  it("a kind's component replaces the dialog, with runId and close", async () => {
    const Mine = defineComponent({ props: ['runId', 'options'], emits: ['close'], render() { return h('div', { class: 'my-dialog', onClick: () => this.$emit('close') }, String(this.runId)) } })
    const backend = api()
    registerTaskKind('deploy', { task: { get: backend.get, intervalMs: 60_000 }, component: Mine })
    wrapper = mountHost()
    await store.run({ label: 'Deploy', kind: 'deploy', start: backend.start })
    await flushPromises()
    expect(document.querySelector('.qd-task-dialog')).toBeNull()
    const mine = document.querySelector('.my-dialog')
    expect(mine.textContent).toBe(store.state.openId)
    mine.click()
    await flushPromises()
    expect(store.state.openId).toBeNull()
  })

  it('the tray row takes the configured item component', async () => {
    configureTasks({ tray: { item: defineComponent({ props: ['run'], render() { return h('span', { class: 'row' }, `* ${this.run.label}`) } }) } })
    const backend = api()
    wrapper = mountHost()
    await store.run({ label: 'Backup', start: backend.start, task: { get: backend.get, intervalMs: 60_000 }, open: false })
    await flushPromises()
    document.querySelector('.qd-task-tray-button').click()
    await flushPromises()
    expect(document.querySelector('.qd-task-item .row').textContent).toBe('* Backup')
  })
})

describe('the window (#4334)', () => {
  it('Escape leaves full screen first, then closes; full screen is remembered per app', async () => {
    const backend = api()
    wrapper = mountHost()
    await store.run({ label: 'Long', start: backend.start, task: { get: backend.get, intervalMs: 60_000 } })
    await flushPromises()
    document.querySelector('.p-dialog-maximize-button, .p-dialog-header-actions button').click()
    await flushPromises()
    expect(document.querySelector('.p-dialog-maximized')).not.toBeNull()
    expect(JSON.parse(localStorage.getItem('qdadm.tasks.dialog.cockpit-x')).maximized).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(document.querySelector('.p-dialog-maximized')).toBeNull()
    expect(store.state.openId).not.toBeNull()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(store.state.openId).toBeNull()
  })

  it('saves the size a corner resize leaves in px, not the default width', async () => {
    const backend = api()
    wrapper = mountHost()
    await store.run({ label: 'Long', start: backend.start, task: { get: backend.get, intervalMs: 60_000 } })
    await flushPromises()
    const el = document.querySelector('.qd-task-dialog')
    expect(el.classList.contains('qd-task-dialog--resizable')).toBe(true)
    window.dispatchEvent(new Event('pointerup'))
    expect(localStorage.getItem('qdadm.tasks.dialog.cockpit-x')).toBeNull()
    el.style.width = '900px'
    el.style.height = '600px'
    el.getBoundingClientRect = () => ({ width: 900, height: 600, left: 10, top: 20, right: 910, bottom: 620 })
    window.dispatchEvent(new Event('pointerup'))
    expect(JSON.parse(localStorage.getItem('qdadm.tasks.dialog.cockpit-x'))).toMatchObject({ width: 900, height: 600 })
  })

  it('rememberLayout: false saves nothing', async () => {
    configureTasks({ dialog: { rememberLayout: false } })
    const backend = api()
    wrapper = mountHost()
    await store.run({ label: 'Long', start: backend.start, task: { get: backend.get, intervalMs: 60_000 } })
    await flushPromises()
    document.querySelector('.p-dialog-maximize-button, .p-dialog-header-actions button').click()
    await flushPromises()
    expect(localStorage.getItem('qdadm.tasks.dialog.cockpit-x')).toBeNull()
  })
})
