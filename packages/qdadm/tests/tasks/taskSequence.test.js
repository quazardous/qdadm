/**
 * Tasks chained in one window (#4934): a sequence runs its steps one after
 * another, a failure stops the rest, one toast says how it went, it goes on
 * after a reload when its kinds can start again, and its window shows the
 * list of steps, a step's detail on a click, and the way back.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import PrimeVue from 'primevue/config'
import { getTaskStore, registerTaskKind } from '../../src/tasks/taskStore'
import { resetTaskUi } from '../../src/tasks/taskUi'
import TaskHost from '../../src/components/tasks/TaskHost.vue'
import TaskTray from '../../src/components/tasks/TaskTray.vue'

/** A backend whose task records the test moves by hand */
function backend() {
  const records = new Map()
  let next = 1
  return {
    records,
    start: vi.fn(async () => {
      const id = next++
      records.set(id, { id, status: 'queued' })
      return { task_id: id }
    }),
    get: vi.fn(async (id) => ({ ...records.get(id) })),
    set: (id, patch) => records.set(id, { ...records.get(id), ...patch }),
  }
}

function toasts() {
  return { success: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }
}

const store = getTaskStore()
const T = 1000

beforeEach(() => {
  store.reset()
  resetTaskUi()
  sessionStorage.clear()
  localStorage.clear()
})
afterEach(() => vi.useRealTimers())

describe('a sequence (#4934)', () => {
  it('runs its steps in order; a step\'s start gets the previous run; one toast at the end', async () => {
    vi.useFakeTimers()
    const api = backend()
    const toast = toasts()
    store.attach({ orchestrator: { get: () => null, toast } })
    const second = vi.fn(async () => api.start())
    const seq = await store.sequence('Verify', [
      { label: 'Check', start: api.start, task: { get: api.get, intervalMs: T } },
      { label: 'Conf check', start: second, task: { get: api.get, intervalMs: T } },
    ])
    expect(store.state.openId).toBe(seq.id)
    await vi.advanceTimersByTimeAsync(0)
    expect(seq.steps.map((s) => store.stepStatus(s))).toEqual(['queued', 'pending'])
    expect(second).not.toHaveBeenCalled()

    api.set(1, { status: 'done', result: { ok: 3 } })
    await vi.advanceTimersByTimeAsync(T)
    expect(second).toHaveBeenCalledTimes(1)
    expect(second.mock.calls[0][0]).toMatchObject({ label: 'Check', status: 'succeeded', result: { ok: 3 } })
    expect(seq.current).toBe(1)

    api.set(2, { status: 'done' })
    await vi.advanceTimersByTimeAsync(T)
    const end = await seq.finished
    expect(end.status).toBe('succeeded')
    expect(end.steps.map((s) => store.stepStatus(s))).toEqual(['succeeded', 'succeeded'])
    // The steps' own toasts are off: one toast, for the sequence
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Verify', '✓ Check · ✓ Conf check', expect.anything())
    // Every step is a run of the store, tied to its sequence
    expect(store.state.runs.every((r) => r.sequenceId === seq.id)).toBe(true)
  })

  it('a failure stops the rest: they show "not run", and the toast says which step failed and which passed', async () => {
    vi.useFakeTimers()
    const api = backend()
    const toast = toasts()
    store.attach({ orchestrator: { get: () => null, toast } })
    const third = vi.fn(api.start)
    const seq = await store.sequence('Deliver', [
      { label: 'Build', start: api.start, task: { get: api.get, intervalMs: T } },
      { label: 'Check', start: api.start, task: { get: api.get, intervalMs: T } },
      { label: 'Ship', start: third, task: { get: api.get, intervalMs: T } },
    ])
    api.set(1, { status: 'done' })
    await vi.advanceTimersByTimeAsync(T)
    api.set(2, { status: 'error', error: 'conf drift' })
    await vi.advanceTimersByTimeAsync(T)
    const end = await seq.finished
    expect(end.status).toBe('failed')
    expect(third).not.toHaveBeenCalled()
    expect(end.steps[2]).toMatchObject({ status: 'skipped', skipped: 'error', runId: null })
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error.mock.calls[0][1]).toBe('✓ Build · ✗ Check: conf drift · – Ship')
  })

  it('stopOnError: false goes on, and the sequence still ends failed', async () => {
    vi.useFakeTimers()
    const api = backend()
    const seq = await store.sequence('Checks', [
      { label: 'A', start: api.start, task: { get: api.get, intervalMs: T } },
      { label: 'B', start: api.start, task: { get: api.get, intervalMs: T } },
    ], { stopOnError: false })
    api.set(1, { status: 'failed', error: 'x' })
    await vi.advanceTimersByTimeAsync(T)
    api.set(2, { status: 'done' })
    await vi.advanceTimersByTimeAsync(T)
    const end = await seq.finished
    expect(end.steps.map((s) => store.stepStatus(s))).toEqual(['failed', 'succeeded'])
    expect(end.status).toBe('failed')
  })

  it('a step given as a function gets the previous run; its line says "Step n" until it starts', async () => {
    vi.useFakeTimers()
    const api = backend()
    const build = vi.fn((prev) => ({ label: `Deploy ${prev.result.version}`, start: api.start, task: { get: api.get, intervalMs: T } }))
    const seq = await store.sequence('Release', [
      { label: 'Build', start: api.start, task: { get: api.get, intervalMs: T } },
      build,
    ])
    expect(seq.steps[1].label).toBe('')
    api.set(1, { status: 'done', result: { version: '2.48' } })
    await vi.advanceTimersByTimeAsync(T)
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ status: 'succeeded' }))
    expect(seq.steps[1].label).toBe('Deploy 2.48')
  })

  it('cancel stops the running step on the backend and the rest is not run', async () => {
    vi.useFakeTimers()
    const api = backend()
    const cancel = vi.fn(async (id) => api.set(id, { status: 'cancelled' }))
    const seq = await store.sequence('Verify', [
      { label: 'A', start: api.start, cancel, task: { get: api.get, intervalMs: T } },
      { label: 'B', start: api.start, cancel, task: { get: api.get, intervalMs: T } },
    ])
    await vi.advanceTimersByTimeAsync(0)
    await store.cancelSequence(seq.id)
    await vi.advanceTimersByTimeAsync(T)
    const end = await seq.finished
    expect(cancel).toHaveBeenCalledWith(1)
    expect(end.status).toBe('cancelled')
    expect(end.steps[1]).toMatchObject({ status: 'skipped', skipped: 'cancelled' })
    expect(api.start).toHaveBeenCalledTimes(1)
  })

  it('one step only is a plain run: its own window and its own toast', async () => {
    vi.useFakeTimers()
    const api = backend()
    const toast = toasts()
    store.attach({ orchestrator: { get: () => null, toast } })
    const seq = await store.sequence('Verify', [{ label: 'Check', start: api.start, task: { get: api.get, intervalMs: T } }])
    await vi.advanceTimersByTimeAsync(0)
    expect(store.state.openId).toBe(seq.steps[0].runId)
    api.set(1, { status: 'done' })
    await vi.advanceTimersByTimeAsync(T)
    await seq.finished
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast.success.mock.calls[0][0]).toBe('Check')
  })

  it('sequenceFor finds it by its meta, and isActive tells it is going', async () => {
    const api = backend()
    await store.sequence('Verify', [
      { label: 'A', start: api.start, task: { get: api.get, intervalMs: 60_000 } },
      { label: 'B', start: api.start, task: { get: api.get, intervalMs: 60_000 } },
    ], { meta: { box: 'b1' }, open: false })
    expect(store.state.openId).toBeNull()
    expect(store.isActive(store.sequenceFor({ box: 'b1' }))).toBe(true)
    expect(store.sequenceFor({ box: 'b2' })).toBeNull()
  })
})

describe('a sequence and a reload (#4934)', () => {
  it('kinds with a start: the running step is followed again and the next one starts from its meta', async () => {
    vi.useFakeTimers()
    const api = backend()
    const startConf = vi.fn(async () => api.start())
    const register = () => {
      registerTaskKind('check', { task: { get: api.get, intervalMs: T }, start: api.start })
      registerTaskKind('conf-check', { task: { get: api.get, intervalMs: T }, start: startConf })
    }
    register()
    store.attach({})
    await store.sequence('Verify', [
      { kind: 'check', label: 'Check', meta: { box: 'b1' } },
      { kind: 'conf-check', label: 'Conf check', meta: { box: 'b1' } },
    ], { meta: { box: 'b1' } })
    await vi.advanceTimersByTimeAsync(0)

    // The page reloads: the store starts empty, the modules register their kinds again
    store.reset()
    register()
    store.attach({})
    const seq = store.sequenceFor({ box: 'b1' })
    expect(seq.label).toBe('Verify')
    expect(store.stepStatus(seq.steps[0])).toBe('running')
    api.set(1, { status: 'done' })
    await vi.advanceTimersByTimeAsync(T)
    expect(startConf).toHaveBeenCalledWith({ box: 'b1' })
    api.set(2, { status: 'done' })
    await vi.advanceTimersByTimeAsync(T)
    expect((await seq.finished).status).toBe('succeeded')
  })

  it('a step that cannot start again shows "the page was reloaded"', async () => {
    vi.useFakeTimers()
    const api = backend()
    registerTaskKind('check', { task: { get: api.get, intervalMs: T } })
    store.attach({})
    await store.sequence('Verify', [
      { kind: 'check', label: 'Check', start: api.start },
      { label: 'Conf check', start: api.start, task: { get: api.get } },
    ])
    await vi.advanceTimersByTimeAsync(0)

    store.reset()
    registerTaskKind('check', { task: { get: api.get, intervalMs: T } })
    store.attach({})
    const seq = store.state.sequences[0]
    api.set(1, { status: 'done' })
    await vi.advanceTimersByTimeAsync(T)
    const end = await seq.finished
    expect(end.steps[1]).toMatchObject({ status: 'skipped', skipped: 'reload' })
    expect(end.status).toBe('cancelled')
  })
})

describe('the sequence window (#4934)', () => {
  async function host() {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
    await router.push('/')
    return mount(defineComponent({ render: () => [h(TaskHost), h(TaskTray)] }), {
      global: {
        plugins: [PrimeVue, router],
        directives: { tooltip: {} },
        stubs: { teleport: true },
        provide: { qdadmApp: { name: 'X' }, qdadmTasksConfig: { tray: true } },
      },
      attachTo: document.body,
    })
  }

  it('lists the steps, shows a step on a click, and goes back to the list', async () => {
    const api = backend()
    const wrapper = await host()
    await store.sequence('Verify', [
      { label: 'Check', start: api.start, task: { get: api.get, intervalMs: 60_000 } },
      { label: 'Conf check', start: api.start, task: { get: api.get, intervalMs: 60_000 } },
    ])
    const lines = () => document.querySelectorAll('.qd-task-sequence-step')
    await vi.waitFor(() => expect(lines()).toHaveLength(2))
    // The first step's line opens once its run has started
    await vi.waitFor(() => expect(lines()[0].disabled).toBe(false))
    expect(lines()[0].classList.contains('qd-task-sequence-step--current')).toBe(true)
    expect(lines()[1].textContent).toContain('core.task.sequence.pending')
    expect(lines()[1].disabled).toBe(true)

    await wrapper.find('.qd-task-sequence-step').trigger('click')
    await vi.waitFor(() => expect(document.querySelector('.qd-task-sequence-list')).toBeNull())
    expect(document.querySelector('.qd-task-sequence-detail-title').textContent).toContain('Check')
    expect(document.querySelector('.qd-task-run-view')).not.toBeNull()

    document.querySelector('.qd-task-sequence-back').click()
    await vi.waitFor(() => expect(lines()).toHaveLength(2))

    expect(store.state.runs).toHaveLength(1)
    wrapper.unmount()
  })
})
