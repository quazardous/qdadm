/**
 * TaskRunner (#4114): a task queued by an action, followed to the end.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import PrimeVue from 'primevue/config'
import { getTaskStore, registerTaskKind } from '../../src/tasks/taskStore'
import { taskAction } from '../../src/tasks/useTaskRunner'
import TaskHost from '../../src/components/tasks/TaskHost.vue'
import TaskTray from '../../src/components/tasks/TaskTray.vue'

/** A backend task whose record the test moves by hand. */
function backend() {
  const records = new Map()
  let next = 1
  return {
    records,
    start: vi.fn(async () => {
      const id = next++
      records.set(id, { id, status: 'queued', progress: null })
      return { task_id: id }
    }),
    get: vi.fn(async (id) => ({ ...records.get(id) })),
    set: (id, patch) => records.set(id, { ...records.get(id), ...patch }),
  }
}

const store = getTaskStore()

beforeEach(() => {
  store.reset()
  sessionStorage.clear()
})
afterEach(() => vi.useRealTimers())

describe('task store (#4114)', () => {
  it('follows a task by polling from queued to done', async () => {
    vi.useFakeTimers()
    const api = backend()
    const run = await store.run({ label: 'Create box', start: api.start, task: { get: api.get, intervalMs: 1000 } })
    expect(run.taskId).toBe(1)
    await vi.advanceTimersByTimeAsync(0)
    expect(store.state.runs[0].status).toBe('queued')

    api.set(1, { status: 'in_progress', progress: 40, step: 'Cloning the ref' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.state.runs[0]).toMatchObject({ status: 'running', progress: 40, step: 'Cloning the ref' })

    api.set(1, { status: 'done', result: { url: 'https://box.test' } })
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.state.runs[0]).toMatchObject({ status: 'succeeded', result: { url: 'https://box.test' } })
    const calls = api.get.mock.calls.length
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.get.mock.calls.length).toBe(calls)
  })

  it('reads a failure and its reason, and maps statuses of its own', async () => {
    vi.useFakeTimers()
    const api = backend()
    await store.run({ label: 'Refresh db', start: api.start, task: { get: api.get, intervalMs: 500, statusMap: { KO: 'failed' }, error: 'message' } })
    api.set(1, { status: 'KO', message: 'dump not found' })
    await vi.advanceTimersByTimeAsync(500)
    expect(store.state.runs[0]).toMatchObject({ status: 'failed', error: 'dump not found' })
  })

  it('fails the run when the start handler throws or returns no id', async () => {
    await store.run({ label: 'A', start: async () => { throw new Error('409 box exists') }, task: { get: vi.fn() } })
    expect(store.state.runs[0]).toMatchObject({ status: 'failed', error: '409 box exists' })
    await store.run({ label: 'B', start: async () => ({ ok: true }), task: { get: vi.fn() } })
    expect(store.state.runs[0].error).toBe('the start handler returned no task id')
  })

  it('reads at once on a live event for its record, and polls slowly otherwise', async () => {
    vi.useFakeTimers()
    const api = backend()
    const handlers = []
    const manager = { get: vi.fn((id, _ctx, opts) => (expect(opts).toEqual({ listCache: false }), api.get(id))) }
    store.attach({ orchestrator: { get: () => manager }, signals: { on: (_n, fn) => (handlers.push(fn), () => {}) } })
    await store.run({ label: 'Load ref', start: api.start, task: { entity: 'tasks' } })
    await vi.advanceTimersByTimeAsync(0)
    expect(manager.get).toHaveBeenCalledTimes(1)

    api.set(1, { status: 'running', progress: 70 })
    handlers[0]({ data: { entity: 'tasks', id: 2 } }) // another task: ignored
    handlers[0]({ data: { entity: 'boxes', id: 1 } }) // another entity: ignored
    await vi.advanceTimersByTimeAsync(0)
    expect(manager.get).toHaveBeenCalledTimes(1)
    handlers[0]({ data: { entity: 'tasks', id: 1 } })
    await vi.advanceTimersByTimeAsync(0)
    expect(store.state.runs[0].progress).toBe(70)

    await vi.advanceTimersByTimeAsync(9000)
    expect(manager.get).toHaveBeenCalledTimes(2) // live: the poll is a 10 s fallback
    await vi.advanceTimersByTimeAsync(1000)
    expect(manager.get).toHaveBeenCalledTimes(3)
  })

  it('cancels through the backend and reads the outcome', async () => {
    vi.useFakeTimers()
    const api = backend()
    const cancel = vi.fn(async (id) => api.set(id, { status: 'cancelled' }))
    await store.run({ label: 'Run scenario', start: api.start, task: { get: api.get, intervalMs: 60_000 }, cancel })
    await vi.advanceTimersByTimeAsync(0)
    const id = store.state.runs[0].id
    await store.cancel(id)
    await vi.advanceTimersByTimeAsync(0)
    expect(cancel).toHaveBeenCalledWith(1)
    expect(store.state.runs[0].status).toBe('cancelled')
  })

  it('toasts the end, with a link to the task', async () => {
    vi.useFakeTimers()
    const api = backend()
    const toast = { success: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }
    store.attach({ orchestrator: { get: () => null, toast } })
    await store.run({ label: 'Create box', start: api.start, task: { get: api.get }, to: (id) => ({ name: 'task', params: { id } }) })
    api.set(1, { status: 'failed', error: 'no space left' })
    await vi.advanceTimersByTimeAsync(2000)
    expect(toast.error).toHaveBeenCalledWith('Create box', 'no space left', { emitter: 'TaskRunner', to: { name: 'task', params: { id: 1 } }, keep: 'long' })
  })

  it('resumes a run of a registered kind after a reload', async () => {
    vi.useFakeTimers()
    const api = backend()
    registerTaskKind('create-box', { task: { get: api.get, intervalMs: 1000 } })
    await store.run({ kind: 'create-box', label: 'Create box b1', start: api.start })
    expect(JSON.parse(sessionStorage.getItem('qdadm:tasks'))).toMatchObject([{ kind: 'create-box', taskId: 1 }])

    // A reload: a fresh store, the module registers its kind again.
    const saved = sessionStorage.getItem('qdadm:tasks')
    store.reset()
    sessionStorage.setItem('qdadm:tasks', saved)
    registerTaskKind('create-box', { task: { get: api.get, intervalMs: 1000 } })
    api.set(1, { status: 'running', progress: 50 })
    store.attach({})
    await vi.advanceTimersByTimeAsync(0)
    expect(store.state.runs[0]).toMatchObject({ label: 'Create box b1', status: 'running', progress: 50 })

    api.set(1, { status: 'done' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(sessionStorage.getItem('qdadm:tasks')).toBeNull()
  })
})

describe('task components (#4114)', () => {
  const global = { plugins: [PrimeVue], directives: { tooltip: {} }, stubs: { teleport: true } }

  function mountHost() {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
    return mount(defineComponent({ render: () => [h(TaskHost), h(TaskTray)] }), { global: { ...global, plugins: [...global.plugins, router] }, attachTo: document.body })
  }

  it('asks for the typed name before a dangerous task, and does not start on refusal', async () => {
    const wrapper = mountHost()
    const api = backend()
    const destroy = taskAction((box) => ({
      label: `Destroy ${box.name}`,
      start: api.start,
      task: { get: api.get },
      confirm: { typed: box.name, message: 'The box is deleted.' },
    }))

    const refused = destroy({ name: 'checkout-v2' })
    await flushPromises()
    const confirm = document.querySelector('.p-dialog .p-dialog-footer button:last-child')
    expect(document.body.textContent).toContain('The box is deleted.')
    expect(confirm.disabled).toBe(true)
    store.answerConfirm(false)
    expect(await refused).toBeNull()
    expect(api.start).not.toHaveBeenCalled()

    const accepted = destroy({ name: 'checkout-v2' })
    await flushPromises()
    const input = document.querySelector('#qd-task-typed')
    input.value = 'checkout-v'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(document.querySelector('.p-dialog .p-dialog-footer button:last-child').disabled).toBe(true)
    input.value = 'checkout-v2'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    document.querySelector('.p-dialog .p-dialog-footer button:last-child').click()
    expect((await accepted).label).toBe('Destroy checkout-v2')
    expect(api.start).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('does not start a task that needs confirming when no host is mounted', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const api = backend()
    expect(await store.run({ label: 'Destroy', start: api.start, task: { get: api.get }, confirm: { typed: 'x' } })).toBeNull()
    expect(api.start).not.toHaveBeenCalled()
    expect(warn.mock.calls[0][0]).toContain('no TaskHost is mounted')
    warn.mockRestore()
  })

  it('opens the follow dialog, and lists runs in the tray', async () => {
    const wrapper = mountHost()
    const api = backend()
    await store.run({ label: 'Create box b1', start: api.start, task: { get: api.get, intervalMs: 20 }, cancel: vi.fn() })
    api.set(1, { status: 'running', progress: 30, step: 'Installing dependencies' })
    await vi.waitFor(() => expect(document.querySelector('.qd-task-step')?.textContent).toBe('Installing dependencies'))

    expect(document.querySelector('.p-dialog-title').textContent).toBe('Create box b1')
    expect(document.querySelector('.qd-task-step').textContent).toBe('Installing dependencies')
    expect(document.querySelector('.p-progressbar').getAttribute('aria-valuenow')).toBe('30')
    expect(document.body.textContent).toContain('core.task.cancel')
    expect(wrapper.find('.qd-task-tray-count').text()).toBe('1')

    store.open(null)
    await nextTick()
    expect(document.querySelector('.qd-task-step')).toBeNull()
    expect(store.state.runs[0].status).toBe('running') // closing the dialog stops nothing
    wrapper.unmount()
  })
})
