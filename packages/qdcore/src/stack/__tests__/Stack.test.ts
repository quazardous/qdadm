import { describe, it, expect } from 'vitest'

import { Stack } from '../Stack'
import { SignalBus } from '../../signal/SignalBus'
import type { ContentStackLevel } from '../types'

const lvl = (overrides: Partial<ContentStackLevel> & { name: string; type: string }): ContentStackLevel => ({
  ...overrides,
})

describe('Stack — getters', () => {
  it('starts empty', () => {
    const stack = new Stack()
    expect(stack.getDepth()).toBe(0)
    expect(stack.getLevels()).toEqual([])
    expect(stack.getCurrent()).toBeNull()
    expect(stack.getParent()).toBeNull()
    expect(stack.getRoot()).toBeNull()
  })

  it('exposes current/parent/root after set()', () => {
    const stack = new Stack()
    stack.set([
      lvl({ type: 'entity', name: 'books', id: '1' }),
      lvl({ type: 'entity', name: 'loans', id: '2' }),
    ])
    expect(stack.getDepth()).toBe(2)
    expect(stack.getCurrent()).toEqual({ type: 'entity', name: 'loans', id: '2' })
    expect(stack.getParent()).toEqual({ type: 'entity', name: 'books', id: '1' })
    expect(stack.getRoot()).toEqual({ type: 'entity', name: 'books', id: '1' })
  })

  it('getLevel(index) returns null for out-of-range', () => {
    const stack = new Stack()
    stack.set([lvl({ type: 'entity', name: 'books' })])
    expect(stack.getLevel(0)).toEqual({ type: 'entity', name: 'books' })
    expect(stack.getLevel(99)).toBeNull()
  })
})

describe('Stack — change emission', () => {
  it('emits stack:change on set() when levels actually change', async () => {
    const bus = new SignalBus()
    const stack = new Stack(bus)
    const events: unknown[] = []
    bus.on('stack:change', (event) => events.push(event.data))

    stack.set([lvl({ type: 'entity', name: 'books', id: '1' })])
    await new Promise((r) => setTimeout(r, 0))
    expect(events.length).toBe(1)
    expect((events[0] as { levels: unknown[] }).levels.length).toBe(1)
  })

  it('skips emission when set() receives equal levels', async () => {
    const bus = new SignalBus()
    const stack = new Stack(bus)
    let count = 0
    bus.on('stack:change', () => count++)

    stack.set([lvl({ type: 'entity', name: 'books', id: '1' })])
    await new Promise((r) => setTimeout(r, 0))
    stack.set([lvl({ type: 'entity', name: 'books', id: '1' })])
    await new Promise((r) => setTimeout(r, 0))

    expect(count).toBe(1)
  })

  it('clear() emits when non-empty, no-ops when already empty', async () => {
    const bus = new SignalBus()
    const stack = new Stack(bus)
    let count = 0
    bus.on('stack:change', () => count++)

    stack.set([lvl({ type: 'entity', name: 'books' })])
    await new Promise((r) => setTimeout(r, 0))
    stack.clear()
    await new Promise((r) => setTimeout(r, 0))
    stack.clear() // no-op
    await new Promise((r) => setTimeout(r, 0))

    expect(count).toBe(2)
  })

  it('uses a custom changeSignal name when provided', async () => {
    const bus = new SignalBus()
    const stack = new Stack(bus, { changeSignal: 'navigation:change' })
    const events: unknown[] = []
    bus.on('navigation:change', (event) => events.push(event.data))

    stack.set([lvl({ type: 'entity', name: 'x' })])
    await new Promise((r) => setTimeout(r, 0))
    expect(events.length).toBe(1)
  })
})

describe('Stack — equality customization', () => {
  it('uses a custom equals to suppress emission', async () => {
    const bus = new SignalBus()
    let count = 0
    bus.on('stack:change', () => count++)
    const stack = new Stack(bus, {
      equals: () => true, // never considers anything changed
    })
    stack.set([lvl({ type: 'entity', name: 'books' })])
    stack.set([lvl({ type: 'entity', name: 'completely-different' })])
    await new Promise((r) => setTimeout(r, 0))
    expect(count).toBe(0)
  })

  it('default equals compares (type, name, id) tuples', async () => {
    const bus = new SignalBus()
    let count = 0
    bus.on('stack:change', () => count++)
    const stack = new Stack(bus)

    stack.set([lvl({ type: 'entity', name: 'books', id: '1', params: { a: 1 } })])
    await new Promise((r) => setTimeout(r, 0))
    // Same tuple, different params → considered equal → no re-emit
    stack.set([lvl({ type: 'entity', name: 'books', id: '1', params: { a: 999 } })])
    await new Promise((r) => setTimeout(r, 0))

    expect(count).toBe(1)
  })
})
