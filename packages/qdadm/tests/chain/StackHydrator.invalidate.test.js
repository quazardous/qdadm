/**
 * The active stack follows its records (#4960): an `entity:data-invalidate`
 * for a record of the stack (its id, or no id) reads it again, coalesced,
 * never twice at once, and a failed read keeps what was shown.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StackHydrator } from '../../src/chain/StackHydrator'
import { createSignalBus } from '../../src/kernel/SignalBus'

let signals
let records
let manager
let hydrator

function setup(live) {
  records = { prod: { name: 'prod', state: 'v1' }, preprod: { name: 'preprod', state: 'v1' } }
  manager = {
    live,
    get: vi.fn(async (id) => ({ ...records[id] })),
    getEntityLabel: (data) => `${data.name} (${data.state})`,
  }
  const orchestrator = { get: (name) => (name === 'instances' ? manager : null) }
  hydrator = new StackHydrator({}, orchestrator, signals)
}

async function stack(...ids) {
  signals.emit('stack:change', { levels: ids.map((id) => ({ entity: 'instances', param: 'name', foreignKey: null, id })) })
  await vi.advanceTimersByTimeAsync(0)
}

const invalidate = (data) => signals.emit('entity:data-invalidate', { entity: 'instances', action: 'updated', ...data })

beforeEach(() => {
  vi.useFakeTimers()
  signals = createSignalBus()
})
afterEach(() => {
  hydrator?.destroy()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('StackHydrator — a record of the stack changed (#4960)', () => {
  it('reads it again and emits stack:hydrated with the new data', async () => {
    setup()
    await stack('prod')
    expect(hydrator.getCurrent().data.state).toBe('v1')
    const hydrated = vi.fn()
    signals.on('stack:hydrated', hydrated)

    records.prod.state = 'v2'
    invalidate({ id: 'prod', source: 'app' })
    await vi.advanceTimersByTimeAsync(300)

    expect(manager.get).toHaveBeenLastCalledWith('prod', undefined, { listCache: false })
    expect(hydrator.getCurrent().data.state).toBe('v2')
    expect(hydrator.getCurrent().label).toBe('prod (v2)')
    expect(hydrated).toHaveBeenCalled()
  })

  it('an event without an id concerns it; another id does not', async () => {
    setup()
    await stack('prod')
    manager.get.mockClear()

    invalidate({ id: 'preprod', source: 'remote' })
    await vi.advanceTimersByTimeAsync(300)
    expect(manager.get).not.toHaveBeenCalled()

    invalidate({ source: 'remote' })
    await vi.advanceTimersByTimeAsync(300)
    expect(manager.get).toHaveBeenCalledTimes(1)
  })

  it('a local write counts too', async () => {
    setup()
    await stack('prod')
    manager.get.mockClear()
    invalidate({ id: 'prod', source: 'local' })
    await vi.advanceTimersByTimeAsync(300)
    expect(manager.get).toHaveBeenCalledTimes(1)
  })

  it('coalesces a burst over the entity\'s live.coalesceMs', async () => {
    setup({ coalesceMs: 1000 })
    await stack('prod')
    manager.get.mockClear()
    for (let i = 0; i < 20; i++) invalidate({ id: 'prod', source: 'remote' })
    await vi.advanceTimersByTimeAsync(999)
    expect(manager.get).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(manager.get).toHaveBeenCalledTimes(1)
  })

  it('never reads twice at once: one more read after the one in flight', async () => {
    setup({ coalesceMs: 0 })
    await stack('prod')
    manager.get.mockClear()
    let release
    manager.get.mockImplementationOnce(() => new Promise((r) => { release = () => r({ ...records.prod }) }))

    invalidate({ id: 'prod', source: 'app' })
    await vi.advanceTimersByTimeAsync(0)
    records.prod.state = 'v3'
    invalidate({ id: 'prod', source: 'app' })
    await vi.advanceTimersByTimeAsync(0)
    expect(manager.get).toHaveBeenCalledTimes(1)

    release()
    await vi.advanceTimersByTimeAsync(0)
    expect(manager.get).toHaveBeenCalledTimes(2)
    expect(hydrator.getCurrent().data.state).toBe('v3')
  })

  it('waits for a hydration in flight instead of racing it', async () => {
    setup({ coalesceMs: 0 })
    let release
    manager.get.mockImplementationOnce(() => new Promise((r) => { release = () => r({ ...records.prod }) }))
    signals.emit('stack:change', { levels: [{ entity: 'instances', param: 'name', foreignKey: null, id: 'prod' }] })
    await vi.advanceTimersByTimeAsync(0)

    invalidate({ id: 'prod', source: 'app' })
    await vi.advanceTimersByTimeAsync(0)
    expect(manager.get).toHaveBeenCalledTimes(1)

    release()
    await vi.advanceTimersByTimeAsync(0)
    expect(manager.get).toHaveBeenCalledTimes(2)
  })

  it('a failed read keeps the data shown', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setup()
    await stack('prod')
    manager.get.mockRejectedValueOnce(new Error('down'))
    invalidate({ id: 'prod', source: 'app' })
    await vi.advanceTimersByTimeAsync(300)
    expect(hydrator.getCurrent().data.state).toBe('v1')
    expect(hydrator.getCurrent().loading).toBe(false)
    expect(warn).toHaveBeenCalled()
  })

  it('drops a pending read when the stack moves on', async () => {
    setup()
    await stack('prod')
    invalidate({ id: 'prod', source: 'app' })
    await stack('preprod')
    manager.get.mockClear()
    await vi.advanceTimersByTimeAsync(300)
    expect(manager.get).not.toHaveBeenCalled()
  })
})
