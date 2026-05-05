import { describe, it, expect, vi } from 'vitest'

import { EventRouter, createEventRouter } from '../EventRouter'
import { SignalBus } from '../../signal/SignalBus'

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('EventRouter — basic routing', () => {
  it('forwards a source signal to a string target signal', async () => {
    const signals = new SignalBus()
    const received: unknown[] = []
    signals.on('forwarded', (event) => received.push(event.data))

    new EventRouter({
      signals,
      routes: { 'source:event': ['forwarded'] },
    })

    await signals.emit('source:event', { id: 1 })
    await tick()
    expect(received).toEqual([{ id: 1 }])
  })

  it('applies transform on { signal, transform } targets', async () => {
    const signals = new SignalBus()
    const received: unknown[] = []
    signals.on('downstream', (event) => received.push(event.data))

    new EventRouter({
      signals,
      routes: {
        'auth:login': [
          { signal: 'downstream', transform: (p) => ({ kind: 'auth', payload: p }) },
        ],
      },
    })

    await signals.emit('auth:login', { user: 'alice' })
    await tick()
    expect(received).toEqual([{ kind: 'auth', payload: { user: 'alice' } }])
  })

  it('invokes callback targets with (payload, ctx)', async () => {
    const signals = new SignalBus()
    const calls: Array<{ payload: unknown; hasSignals: boolean; extra: unknown }> = []
    new EventRouter({
      signals,
      routes: {
        'something:happened': [
          (payload, ctx) =>
            calls.push({ payload, hasSignals: !!ctx.signals, extra: ctx.extra }),
        ],
      },
      context: { extra: 'hello' },
    })

    await signals.emit('something:happened', { id: 7 })
    await tick()
    expect(calls).toEqual([{ payload: { id: 7 }, hasSignals: true, extra: 'hello' }])
  })

  it('routes one source to multiple targets', async () => {
    const signals = new SignalBus()
    const received1: unknown[] = []
    const received2: unknown[] = []
    signals.on('out1', (event) => received1.push(event.data))
    signals.on('out2', (event) => received2.push(event.data))

    new EventRouter({
      signals,
      routes: {
        'in:event': ['out1', { signal: 'out2', transform: () => ({ stamped: true }) }],
      },
    })

    await signals.emit('in:event', 42)
    await tick()
    expect(received1).toEqual([42])
    expect(received2).toEqual([{ stamped: true }])
  })
})

describe('EventRouter — cycle detection', () => {
  it('throws on direct cycle (a → a)', () => {
    const signals = new SignalBus()
    expect(
      () =>
        new EventRouter({
          signals,
          routes: { a: ['a'] },
        })
    ).toThrow(/Cycle detected/)
  })

  it('throws on indirect cycle (a → b → a)', () => {
    const signals = new SignalBus()
    expect(
      () =>
        new EventRouter({
          signals,
          routes: { a: ['b'], b: ['a'] },
        })
    ).toThrow(/Cycle detected/)
  })

  it('addRoute prevents inserting a route that would create a cycle', () => {
    const signals = new SignalBus()
    const router = new EventRouter({
      signals,
      routes: { a: ['b'], b: ['c'] },
    })
    expect(() => router.addRoute('c', ['a'])).toThrow(/cycle/)
  })
})

describe('EventRouter — validation', () => {
  it('rejects unknown target shape (e.g. a number in the targets array)', () => {
    const signals = new SignalBus()
    expect(
      () =>
        new EventRouter({
          signals,
          routes: { a: [123 as unknown as string] },
        })
    ).toThrow(/Invalid target/)
  })

  it('throws when signals is missing', () => {
    expect(
      () =>
        new EventRouter({
          signals: undefined as unknown as SignalBus,
          routes: {},
        })
    ).toThrow(/signals is required/)
  })
})

describe('EventRouter — addRoute / getRoutes / dispose', () => {
  it('addRoute wires a brand-new source after construction', async () => {
    const signals = new SignalBus()
    const router = new EventRouter({ signals, routes: {} })
    const received: unknown[] = []
    signals.on('downstream', (event) => received.push(event.data))

    router.addRoute('upstream', ['downstream'])
    await signals.emit('upstream', 1)
    await tick()
    expect(received).toEqual([1])
  })

  it('addRoute refuses to redeclare an existing source', () => {
    const signals = new SignalBus()
    const router = new EventRouter({ signals, routes: { a: ['b'] } })
    expect(() => router.addRoute('a', ['c'])).toThrow(/already exists/)
  })

  it('getRoutes returns a copy, not the live config', () => {
    const signals = new SignalBus()
    const router = new EventRouter({ signals, routes: { a: ['b'] } })
    const routes = router.getRoutes()
    routes.a = []
    expect(router.getRoutes()).toEqual({ a: ['b'] })
  })

  it('dispose unbinds every registered listener', async () => {
    const signals = new SignalBus()
    const callback = vi.fn()
    const router = new EventRouter({
      signals,
      routes: { 'src:1': [callback] },
    })

    router.dispose()
    await signals.emit('src:1', {})
    await tick()
    expect(callback).not.toHaveBeenCalled()
  })

  it('createEventRouter factory matches the class', () => {
    const signals = new SignalBus()
    expect(createEventRouter({ signals })).toBeInstanceOf(EventRouter)
  })
})
