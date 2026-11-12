/**
 * The end of a task reaches the rest of the app (#4961): `task:settled` and
 * `task:sequence-settled` on the signal bus, and `invalidates` — the records a
 * task changed, read again when it ends, after an optional `ready`.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getTaskStore, registerTaskKind } from '../../src/tasks/taskStore'
import { createSignalBus } from '../../src/kernel/SignalBus'

function backend() {
  const records = new Map()
  let next = 1
  return {
    start: vi.fn(async () => {
      const id = next++
      records.set(id, { id, status: 'queued' })
      return { task_id: id }
    }),
    get: vi.fn(async (id) => ({ ...records.get(id) })),
    set: (id, patch) => records.set(id, { ...records.get(id), ...patch }),
  }
}

const store = getTaskStore()
const T = 1000

let signals
let events
let managers
let log

beforeEach(() => {
  vi.useFakeTimers()
  store.reset()
  sessionStorage.clear()
  signals = createSignalBus()
  events = []
  signals.on('task:settled', (e) => events.push(['task:settled', e.data]))
  signals.on('task:sequence-settled', (e) => events.push(['task:sequence-settled', e.data]))
  log = []
  managers = {
    instances: { invalidate: vi.fn((id) => log.push(['invalidate', 'instances', id])) },
    boxes: { invalidate: vi.fn((id) => log.push(['invalidate', 'boxes', id])) },
  }
  store.attach({
    orchestrator: {
      get: (name) => {
        if (!managers[name]) throw new Error(`no ${name}`)
        return managers[name]
      },
      toast: { success: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    },
    signals,
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('task:settled', () => {
  it('is emitted once a run ends, with its kind, status and meta', async () => {
    const api = backend()
    await store.run({ label: 'Deploy', start: api.start, task: { get: api.get, intervalMs: T }, meta: { instance: 'prod' }, open: false })
    api.set(1, { status: 'failed', error: 'boom' })
    await vi.advanceTimersByTimeAsync(T)

    expect(events).toHaveLength(1)
    const [name, data] = events[0]
    expect(name).toBe('task:settled')
    expect(data).toMatchObject({ kind: null, status: 'failed', meta: { instance: 'prod' } })
    expect(data.run.label).toBe('Deploy')
  })

  it('a sequence emits one per step, then task:sequence-settled', async () => {
    const api = backend()
    const seq = await store.sequence('Verify', [
      { label: 'Check', start: api.start, task: { get: api.get, intervalMs: T } },
      { label: 'Conf', start: api.start, task: { get: api.get, intervalMs: T } },
    ], { meta: { instance: 'prod' }, open: false })
    await vi.advanceTimersByTimeAsync(0)
    api.set(1, { status: 'done' })
    await vi.advanceTimersByTimeAsync(T)
    api.set(2, { status: 'done' })
    await vi.advanceTimersByTimeAsync(T)
    await seq.finished

    expect(events.map(([n]) => n)).toEqual(['task:settled', 'task:settled', 'task:sequence-settled'])
    expect(events[0][1].run.sequenceId).toBe(seq.id)
    expect(events[2][1]).toMatchObject({ status: 'succeeded', meta: { instance: 'prod' } })
  })
})

describe('invalidates', () => {
  it('reads again what the run changed, whatever the outcome, with the id from the run', async () => {
    const api = backend()
    await store.run({
      label: 'Deploy', start: api.start, task: { get: api.get, intervalMs: T }, open: false,
      meta: { instance: 'prod' },
      invalidates: [{ entity: 'instances', id: (run) => run.meta.instance }, { entity: 'boxes' }],
    })
    api.set(1, { status: 'failed', error: 'boom' })
    await vi.advanceTimersByTimeAsync(T)

    expect(log).toEqual([['invalidate', 'instances', 'prod'], ['invalidate', 'boxes', undefined]])
  })

  it('a run\'s targets add to its kind\'s', async () => {
    const api = backend()
    registerTaskKind('t4961-deploy', { task: { get: api.get, intervalMs: T }, invalidates: [{ entity: 'boxes', id: 'b1' }] })
    await store.run({ kind: 't4961-deploy', label: 'Deploy', start: api.start, open: false, invalidates: [{ entity: 'instances', id: 'prod' }] })
    api.set(1, { status: 'done' })
    await vi.advanceTimersByTimeAsync(T)

    expect(log).toEqual([['invalidate', 'boxes', 'b1'], ['invalidate', 'instances', 'prod']])
  })

  it('waits for ready: the signal first, then ready, then the invalidation', async () => {
    const api = backend()
    let release
    const ready = vi.fn(() => new Promise((r) => { release = r }))
    await store.run({
      label: 'Deploy', start: api.start, task: { get: api.get, intervalMs: T }, open: false,
      invalidates: [{ entity: 'instances', id: 'prod' }], ready,
    })
    api.set(1, { status: 'done' })
    await vi.advanceTimersByTimeAsync(T)

    expect(events).toHaveLength(1) // the task really is over
    expect(ready).toHaveBeenCalledWith(expect.objectContaining({ status: 'succeeded' }))
    expect(log).toEqual([])

    release()
    await vi.advanceTimersByTimeAsync(0)
    expect(log).toEqual([['invalidate', 'instances', 'prod']])
  })

  it('invalidates anyway when ready times out or fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const api = backend()
    await store.run({
      label: 'Slow', start: api.start, task: { get: api.get, intervalMs: T }, open: false,
      invalidates: [{ entity: 'instances', id: 'prod' }], ready: () => new Promise(() => {}), readyTimeoutMs: 5000,
    })
    await store.run({
      label: 'Broken', start: api.start, task: { get: api.get, intervalMs: T }, open: false,
      invalidates: [{ entity: 'instances', id: 'preprod' }], ready: () => Promise.reject(new Error('nope')),
    })
    api.set(1, { status: 'done' })
    api.set(2, { status: 'done' })
    await vi.advanceTimersByTimeAsync(T)
    expect(log).toEqual([['invalidate', 'instances', 'preprod']])

    await vi.advanceTimersByTimeAsync(5000)
    expect(log).toEqual([['invalidate', 'instances', 'preprod'], ['invalidate', 'instances', 'prod']])
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('skips an unknown entity with a warning, and goes on with the others', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const api = backend()
    await store.run({
      label: 'Deploy', start: api.start, task: { get: api.get, intervalMs: T }, open: false,
      invalidates: [{ entity: 'nope' }, { entity: 'instances', id: 'prod' }],
    })
    api.set(1, { status: 'done' })
    await vi.advanceTimersByTimeAsync(T)

    expect(log).toEqual([['invalidate', 'instances', 'prod']])
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('a sequence: each step\'s as it ends, then the sequence\'s with the sequence as subject', async () => {
    const api = backend()
    const seq = await store.sequence('Verify', [
      { label: 'Check', start: api.start, task: { get: api.get, intervalMs: T }, invalidates: [{ entity: 'boxes', id: 'b1' }] },
      { label: 'Conf', start: api.start, task: { get: api.get, intervalMs: T } },
    ], { meta: { instance: 'prod' }, open: false, invalidates: [{ entity: 'instances', id: (s) => s.meta.instance }] })
    await vi.advanceTimersByTimeAsync(0)
    api.set(1, { status: 'done' })
    await vi.advanceTimersByTimeAsync(T)
    expect(log).toEqual([['invalidate', 'boxes', 'b1']])

    api.set(2, { status: 'failed', error: 'diff' })
    await vi.advanceTimersByTimeAsync(T)
    await seq.finished
    await vi.advanceTimersByTimeAsync(0)
    expect(log).toEqual([['invalidate', 'boxes', 'b1'], ['invalidate', 'instances', 'prod']])
  })
})
