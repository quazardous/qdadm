/**
 * Tasks on a record's page (#4695): TaskRunStatus shows a run's state in a
 * line, isActive tells a run still going, and the follow dialog closes when
 * the user goes to another page (keepOnNavigate keeps it).
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
import TaskRunStatus from '../../src/components/tasks/TaskRunStatus.vue'
import TaskHost from '../../src/components/tasks/TaskHost.vue'

const store = getTaskStore()
const global = { plugins: [PrimeVue], directives: { tooltip: {} }, stubs: { teleport: true } }
let wrapper

beforeEach(() => {
  store.reset()
  resetTaskUi()
  sessionStorage.clear()
  localStorage.clear()
})
afterEach(() => wrapper?.unmount())

const running = (overrides = {}) => ({ id: 'r1', kind: null, label: 'Check', taskId: 7, status: 'running', progress: 40, step: 'Counting', result: null, error: null, startedAt: 0, endedAt: null, cancelling: false, meta: null, ...overrides })

describe('TaskRunStatus (#4695)', () => {
  it('without a run: "Not run yet"', () => {
    wrapper = mount(TaskRunStatus, { props: { run: null }, global })
    expect(wrapper.text()).toContain('core.task.notRun')
  })

  it('running: status, progress, step; Follow reopens the dialog', async () => {
    const open = vi.spyOn(store, 'open')
    wrapper = mount(TaskRunStatus, { props: { run: running() }, global })
    expect(wrapper.find('.qd-task-status--running').exists()).toBe(true)
    expect(wrapper.find('.qd-task-run-status-progress').exists()).toBe(true)
    expect(wrapper.find('.qd-task-run-status-step').text()).toBe('Counting')
    expect(wrapper.attributes('aria-busy')).toBe('true')
    await wrapper.find('.qd-task-run-status-follow').trigger('click')
    expect(open).toHaveBeenCalledWith('r1')
  })

  it('failed: the error; succeeded: the result slot', () => {
    const failed = mount(TaskRunStatus, { props: { run: running({ status: 'failed', error: 'supplier down' }) }, global })
    expect(failed.find('.qd-task-run-status-error').text()).toBe('supplier down')
    expect(failed.find('.qd-task-run-status-progress').exists()).toBe(false)
    const done = mount(TaskRunStatus, {
      props: { run: running({ status: 'succeeded', result: { count: 12 } }) },
      slots: { result: ({ run }) => h('b', `${run.result.count} in stock`) },
      global,
    })
    expect(done.find('.qd-task-run-status-result').text()).toBe('12 in stock')
  })

  it('isActive: starting, queued, running; not a finished run nor none', () => {
    expect(['starting', 'queued', 'running'].map((s) => store.isActive(running({ status: s })))).toEqual([true, true, true])
    expect(['succeeded', 'failed', 'cancelled'].map((s) => store.isActive(running({ status: s })))).toEqual([false, false, false])
    expect(store.isActive(null)).toBe(false)
  })
})

describe('the follow dialog and navigation (#4695)', () => {
  async function host(kindDialog = {}) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { render: () => null } }, { path: '/other', component: { render: () => null } }],
    })
    await router.push('/')
    const get = vi.fn(async () => ({ status: 'running' }))
    registerTaskKind('check', { task: { get, intervalMs: 60_000 }, dialog: kindDialog })
    wrapper = mount(defineComponent({ render: () => h(TaskHost) }), {
      global: { ...global, plugins: [...global.plugins, router], provide: { qdadmApp: { name: 'X' } } },
      attachTo: document.body,
    })
    await store.run({ kind: 'check', label: 'Check', start: async () => ({ task_id: 1 }) })
    await flushPromises()
    return router
  }

  it('another page closes the dialog; the run goes on', async () => {
    const router = await host()
    expect(store.state.openId).not.toBeNull()
    await router.push('/other')
    await flushPromises()
    expect(store.state.openId).toBeNull()
    expect(store.isActive(store.state.runs[0])).toBe(true)
  })

  it('keepOnNavigate keeps it open', async () => {
    const router = await host({ keepOnNavigate: true })
    await router.push('/other')
    await flushPromises()
    expect(store.state.openId).not.toBeNull()
  })
})
