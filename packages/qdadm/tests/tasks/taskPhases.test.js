/**
 * A task's phases (#4655): log lines that carry their step and the phase
 * markers, the lines of a phase, the TaskPhases frieze, and the follow
 * dialog that reads the phases and filters its log by phase.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import PrimeVue from 'primevue/config'
import { useLogStream } from '../../src/composables/useLogStream'
import { linesOfPhase, phasesMarkedIn, formatPhaseDuration, phaseLabel } from '../../src/tasks/taskPhases'
import TaskPhases from '../../src/components/tasks/TaskPhases.vue'
import TaskHost from '../../src/components/tasks/TaskHost.vue'
import { getTaskStore, registerTaskKind } from '../../src/tasks/taskStore'
import { configureTasks, resetTaskUi } from '../../src/tasks/taskUi'
import { I18N_INJECTION_KEY } from '../../src/i18n/useI18n'
import { I18n } from '../../src/i18n/I18n'

const LOG = [
  { text: '==> status', step: 'status', phase: { event: 'start', name: 'status' } },
  { text: 'clean tree', step: 'status' },
  { text: '<== status', step: 'status', phase: { event: 'end', name: 'status' } },
  { text: '==> deploy', step: 'deploy', phase: { event: 'start', name: 'deploy' } },
  { text: 'rsync 12 files', step: 'deploy' },
  { text: '--> wait-crons', step: 'deploy', phase: { event: 'start', name: 'deploy.wait-crons' } },
  { text: 'cron 1 still running', step: 'deploy' },
  { text: '<-- wait-crons', step: 'deploy', phase: { event: 'end', name: 'deploy.wait-crons' } },
  { text: 'switch symlink', step: 'deploy' },
]

const PHASES = {
  task: 42,
  state: 'running',
  steps: [
    { name: 'status', state: 'done', started: '2026-11-02T09:41:01+01:00', ended: '2026-11-02T09:41:02+01:00', dur: 1.2, subs: [] },
    {
      name: 'deploy', state: 'running', started: '2026-11-02T09:41:02+01:00', ended: null, dur: null,
      subs: [{ name: 'deploy.wait-crons', state: 'done', started: '2026-11-02T09:41:05+01:00', ended: '2026-11-02T09:42:08+01:00', dur: 63 }],
    },
    { name: 'backup-after', state: 'pending', started: null, ended: null, dur: null, subs: [] },
  ],
}

const texts = (lines) => lines.map((l) => l.text)

describe('log lines with their step (#4655)', () => {
  it('a source may give entries: the step stays on every line, the marker on the first', () => {
    const log = useLogStream({ lines: ['plain', { text: 'one\ntwo', step: 'deploy', phase: { event: 'start', name: 'deploy' } }] })
    const [plain, one, two] = log.lines.value
    expect(plain.step).toBeUndefined()
    expect(one).toMatchObject({ text: 'one', step: 'deploy', phase: { event: 'start', name: 'deploy' } })
    expect(two.step).toBe('deploy')
    expect(two.phase).toBeUndefined()
  })

  it("a step's lines carry its name; a sub-phase's lie between its markers", () => {
    const lines = useLogStream({ lines: LOG }).lines.value
    expect(texts(linesOfPhase(lines, 'status'))).toEqual(['==> status', 'clean tree', '<== status'])
    expect(linesOfPhase(lines, 'deploy')).toHaveLength(6)
    expect(texts(linesOfPhase(lines, 'deploy.wait-crons'))).toEqual(['--> wait-crons', 'cron 1 still running', '<-- wait-crons'])
    expect(linesOfPhase(lines, 'backup-after')).toEqual([])
    expect([...phasesMarkedIn(lines)]).toEqual(['status', 'deploy', 'deploy.wait-crons'])
  })

  it('a running sub-phase runs to the last line', () => {
    const lines = useLogStream({ lines: LOG.slice(0, 7) }).lines.value
    expect(texts(linesOfPhase(lines, 'deploy.wait-crons'))).toEqual(['--> wait-crons', 'cron 1 still running'])
  })

  it('durations, short', () => {
    expect(formatPhaseDuration(1.2)).toBe('1.2 s')
    expect(formatPhaseDuration(12.4)).toBe('12 s')
    expect(formatPhaseDuration(63)).toBe('1 min 3 s')
    expect(formatPhaseDuration(3725)).toBe('1 h 2 min')
    expect(formatPhaseDuration(null)).toBe('')
  })
})

describe('TaskPhases (#4655)', () => {
  let i18n
  beforeAll(async () => {
    i18n = new I18n({ defaultLocale: 'en' })
    await i18n.bootstrap()
    i18n.addMessages('en', { phase: { deploy: 'Delivery', 'wait-crons': 'Waiting for the crons' } })
  })
  const frieze = (props) => mount(TaskPhases, { props, global: { provide: { [I18N_INJECTION_KEY]: i18n } } })
  const item = (w, name) => w.findAll('.qd-task-phases-list > .qd-task-phase').find((li) => li.text().includes(name))

  it('each step: its state, its label from the catalogue or its name, its duration', () => {
    const w = frieze({ phases: PHASES })
    const items = w.findAll('.qd-task-phases-list > .qd-task-phase')
    expect(items.map((li) => li.classes().find((c) => /--(pending|running|done|failed|cancelled|skipped)$/.test(c)))).toEqual([
      'qd-task-phase--done', 'qd-task-phase--running', 'qd-task-phase--pending',
    ])
    expect(items[0].find('.qd-task-phase-label').text()).toBe('status')
    expect(items[0].find('.qd-task-phase-time').text()).toBe('1.2 s')
    expect(items[1].find('.qd-task-phase-label').text()).toBe('Delivery')
    expect(items[1].find('.qd-task-phase-icon').classes()).toContain('pi-spinner')
    expect(items[2].find('.qd-task-phase-time').text()).toBe('')
    expect(items[0].find('.qd-task-phase-main').attributes('aria-label')).toBe('status, Done 1.2 s')
  })

  it('a running step counts the time since it started', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-02T09:41:14+01:00'))
    const w = frieze({ phases: PHASES })
    expect(item(w, 'Delivery').find('.qd-task-phase-time').text()).toBe('12 s')
    vi.advanceTimersByTime(3000)
    await w.vm.$nextTick()
    expect(item(w, 'Delivery').find('.qd-task-phase-time').text()).toBe('15 s')
    vi.useRealTimers()
  })

  it('sub-phases fold out; a failed one opens its step by itself', async () => {
    const w = frieze({ phases: PHASES })
    expect(w.find('.qd-task-phase-subs').exists()).toBe(false)
    await w.find('.qd-task-phase-toggle').trigger('click')
    // Its last segment in the catalogue
    expect(w.find('.qd-task-phase-subs .qd-task-phase-label').text()).toBe('Waiting for the crons')
    expect(w.find('.qd-task-phase-subs .qd-task-phase-time').text()).toBe('1 min 3 s')

    const failed = structuredClone(PHASES)
    failed.steps[1].state = 'failed'
    failed.steps[1].subs[0].state = 'failed'
    const f = frieze({ phases: failed })
    expect(f.find('.qd-task-phase--failed .qd-task-phase-subs').exists()).toBe(true)
  })

  it('cancelled and skipped have their own look; the app may give an icon per phase', () => {
    const steps = [
      { name: 'deploy', state: 'cancelled', dur: 4, subs: [] },
      { name: 'backup-after', state: 'skipped', subs: [] },
    ]
    const w = frieze({ phases: steps, icons: { 'backup-after': 'pi pi-database' } })
    expect(w.find('.qd-task-phase--cancelled .qd-task-phase-icon').classes()).toContain('pi-ban')
    expect(w.find('.qd-task-phase--skipped .qd-task-phase-icon').classes()).toContain('pi-database')
  })

  it('picks a step, then gives it back; a sub-phase only when the log marks it', async () => {
    const w = frieze({ phases: PHASES, selectable: true, selectableSubs: [] })
    await item(w, 'status').find('.qd-task-phase-main').trigger('click')
    expect(w.emitted('update:selected')[0]).toEqual(['status'])
    await w.setProps({ selected: 'status' })
    await item(w, 'status').find('.qd-task-phase-main').trigger('click')
    expect(w.emitted('update:selected')[1]).toEqual([null])

    await w.find('.qd-task-phase-toggle').trigger('click')
    expect(w.find('.qd-task-phase-subs .qd-task-phase-main').attributes('disabled')).toBeDefined()
    await w.setProps({ selectableSubs: ['deploy.wait-crons'] })
    await w.find('.qd-task-phase-subs .qd-task-phase-main').trigger('click')
    expect(w.emitted('update:selected')[2]).toEqual(['deploy.wait-crons'])
  })

  it('without phases, nothing', () => {
    expect(frieze({ phases: null }).find('.qd-task-phases').exists()).toBe(false)
    expect(phaseLabel((_k, fallback) => fallback, 'deploy.wait-crons', true)).toBe('wait-crons')
  })
})

describe('TaskDialog with phases (#4655)', () => {
  const store = getTaskStore()
  const global = { plugins: [PrimeVue], directives: { tooltip: {} }, stubs: { teleport: true } }
  let wrapper

  function mountHost() {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
    return mount(defineComponent({ render: () => h(TaskHost) }), {
      global: { ...global, plugins: [...global.plugins, router], provide: { qdadmApp: { name: 'Cockpit X' } } },
      attachTo: document.body,
    })
  }

  beforeEach(() => {
    store.reset()
    resetTaskUi()
    sessionStorage.clear()
    localStorage.clear()
  })
  afterEach(() => wrapper?.unmount())

  const shown = () => [...document.querySelectorAll('.qd-log-line .qd-log-text')].map((l) => l.textContent)

  async function deliver(kind) {
    const get = vi.fn(async () => ({ id: 42, status: 'running' }))
    registerTaskKind('deliver', { task: { get, intervalMs: 60_000 }, log: () => ({ lines: LOG }), ...kind })
    wrapper = mountHost()
    await store.run({ label: 'Deliver', kind: 'deliver', start: async () => ({ task_id: 42 }) })
    await flushPromises()
    return get
  }

  it('reads the phases, shows the frieze, and filters the log by phase', async () => {
    const phases = vi.fn(async () => PHASES)
    configureTasks({ phaseIcons: { deploy: 'pi pi-upload' } })
    await deliver({ phases })
    expect(phases).toHaveBeenCalledWith(42)
    expect(document.querySelectorAll('.qd-task-phases-list > .qd-task-phase')).toHaveLength(3)
    expect(document.querySelector('.qd-task-phase--running .qd-task-phase-icon').classList).toContain('pi-upload')
    expect(shown()).toHaveLength(9)

    document.querySelector('.qd-task-phase--done .qd-task-phase-main').click()
    await flushPromises()
    expect(shown()).toEqual(['==> status', 'clean tree', '<== status'])
    expect(document.querySelector('.qd-task-phase-filter')).not.toBeNull()

    // The sub-phase: its markers are in the log, so it can be picked
    document.querySelector('.qd-task-phase-toggle').click()
    await flushPromises()
    document.querySelector('.qd-task-phase-subs .qd-task-phase-main').click()
    await flushPromises()
    expect(shown()).toEqual(['--> wait-crons', 'cron 1 still running', '<-- wait-crons'])

    document.querySelector('.qd-task-phase-filter-clear').click()
    await flushPromises()
    expect(shown()).toHaveLength(9)
    expect(document.querySelector('.qd-task-phase-filter')).toBeNull()
  })

  it('reads them again at the pace of the log, and once more when the run ends', async () => {
    vi.useFakeTimers()
    const phases = vi.fn(async () => PHASES)
    const get = vi.fn(async () => ({ id: 42, status: 'running' }))
    registerTaskKind('deliver', { task: { get, intervalMs: 60_000 }, log: () => ({ poll: async () => ({ lines: [] }), intervalMs: 500 }), phases })
    wrapper = mountHost()
    await store.run({ label: 'Deliver', kind: 'deliver', start: async () => ({ task_id: 42 }) })
    await vi.advanceTimersByTimeAsync(0)
    const first = phases.mock.calls.length
    await vi.advanceTimersByTimeAsync(1000)
    expect(phases.mock.calls.length).toBeGreaterThanOrEqual(first + 2)

    get.mockResolvedValue({ id: 42, status: 'done' })
    await store.poke(store.state.openId)
    await vi.advanceTimersByTimeAsync(0)
    const atEnd = phases.mock.calls.length
    await vi.advanceTimersByTimeAsync(5000)
    expect(phases.mock.calls.length).toBe(atEnd)
    vi.useRealTimers()
  })

  it('fixed phases need no reader; without phases the dialog is as before', async () => {
    await deliver({ phases: PHASES.steps })
    expect(document.querySelectorAll('.qd-task-phases-list > .qd-task-phase')).toHaveLength(3)
    wrapper.unmount()
    store.reset()
    await deliver({})
    expect(document.querySelector('.qd-task-dialog')).not.toBeNull()
    expect(document.querySelector('.qd-task-phases')).toBeNull()
  })
})
