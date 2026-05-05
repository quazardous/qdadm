import { describe, it, expect } from 'vitest'

import { SignalBus, buildSignal, createSignalBus, SIGNAL_ACTIONS } from '../SignalBus'

describe('SignalBus — emit / on / off', () => {
  it('routes payload to subscribers', async () => {
    const bus = new SignalBus()
    const received: unknown[] = []
    bus.on('thing:created', (event) => received.push(event.data))
    await bus.emit('thing:created', { id: 1 })
    await bus.emit('thing:created', { id: 2 })
    expect(received).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('returns an unbind function from on()', async () => {
    const bus = new SignalBus()
    const seen: number[] = []
    const unbind = bus.on('ping', () => seen.push(1))
    await bus.emit('ping')
    unbind()
    await bus.emit('ping')
    expect(seen).toEqual([1])
  })

  it('off(signal, handler) removes a specific handler', async () => {
    const bus = new SignalBus()
    const seen: string[] = []
    const a = () => seen.push('a')
    const b = () => seen.push('b')
    bus.on('x', a)
    bus.on('x', b)
    bus.off('x', a)
    await bus.emit('x')
    expect(seen).toEqual(['b'])
  })

  it('matches single-segment wildcards (entity:*)', async () => {
    const bus = new SignalBus()
    const events: string[] = []
    bus.on('entity:*', (event) => events.push(event.name))
    await bus.emit('entity:created')
    await bus.emit('entity:updated')
    await bus.emit('other:thing') // not matched
    expect(events).toEqual(['entity:created', 'entity:updated'])
  })

  it('matches deep wildcards (entity:**)', async () => {
    const bus = new SignalBus()
    const events: string[] = []
    bus.on('entity:**', (event) => events.push(event.name))
    await bus.emit('entity:books:created')
    await bus.emit('entity:users:auth:login')
    expect(events).toEqual(['entity:books:created', 'entity:users:auth:login'])
  })
})

describe('SignalBus — once', () => {
  it('callback form fires only once and returns an unbind', async () => {
    const bus = new SignalBus()
    let count = 0
    bus.once('ping', () => {
      count++
    })
    await bus.emit('ping')
    await bus.emit('ping')
    expect(count).toBe(1)
  })

  it('promise form resolves on first emission', async () => {
    const bus = new SignalBus()
    const resultP = bus.once('hello') as Promise<{ name: string; data: unknown }>
    await bus.emit('hello', 'world')
    const result = await resultP
    expect(result.data).toBe('world')
  })
})

describe('SignalBus — convenience', () => {
  it('emitEntity builds entity:<action> with namespaced payload', async () => {
    const bus = new SignalBus()
    let captured: unknown
    bus.on('entity:created', (event) => {
      captured = event.data
    })
    await bus.emitEntity('books', SIGNAL_ACTIONS.CREATED, { id: 7 })
    expect(captured).toEqual({ entity: 'books', data: { id: 7 } })
  })

  it('buildSignal joins name and action', () => {
    expect(buildSignal('books', 'created')).toBe('books:created')
    expect(buildSignal('users', 'updated')).toBe('users:updated')
  })

  it('createSignalBus factory matches the class constructor', () => {
    const bus = createSignalBus()
    expect(bus).toBeInstanceOf(SignalBus)
  })
})

describe('SignalBus — introspection', () => {
  it('listenerCount tracks per-signal listeners', () => {
    const bus = new SignalBus()
    const noop = () => {}
    bus.on('a', noop)
    bus.on('a', noop)
    bus.on('b', noop)
    expect(bus.listenerCount('a')).toBe(2)
    expect(bus.listenerCount('b')).toBe(1)
  })

  it('signalNames returns all signal names that have listeners', () => {
    const bus = new SignalBus()
    bus.on('alpha', () => {})
    bus.on('beta', () => {})
    expect(new Set(bus.signalNames())).toEqual(new Set(['alpha', 'beta']))
  })

  it('offAll(signal) removes every listener of that signal', async () => {
    const bus = new SignalBus()
    let count = 0
    bus.on('x', () => count++)
    bus.on('x', () => count++)
    bus.offAll('x')
    await bus.emit('x')
    expect(count).toBe(0)
  })
})
