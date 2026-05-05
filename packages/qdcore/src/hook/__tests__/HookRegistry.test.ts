import { describe, it, expect } from 'vitest'

import { HookRegistry, createHookRegistry, HOOK_PRIORITY } from '../HookRegistry'

describe('HookRegistry — register / invoke', () => {
  it('runs registered handlers on invoke()', async () => {
    const hooks = new HookRegistry()
    const events: string[] = []
    hooks.register('entity:presave', () => {
      events.push('a')
    })
    hooks.register('entity:presave', () => {
      events.push('b')
    })
    await hooks.invoke('entity:presave', {})
    expect(new Set(events)).toEqual(new Set(['a', 'b']))
  })

  it('register returns an unbind that removes the handler', async () => {
    const hooks = new HookRegistry()
    let count = 0
    const unbind = hooks.register('ping', () => {
      count++
    })
    await hooks.invoke('ping')
    unbind()
    await hooks.invoke('ping')
    expect(count).toBe(1)
    expect(hooks.hasHook('ping')).toBe(false)
  })

  it('passes context to handlers via event.data', async () => {
    const hooks = new HookRegistry()
    let captured: unknown
    hooks.register('test', (event) => {
      captured = (event as { data: unknown }).data
    })
    await hooks.invoke('test', { foo: 42 })
    expect(captured).toEqual({ foo: 42 })
  })

  it('throwOnError raises an AggregateError when a handler throws', async () => {
    const hooks = new HookRegistry()
    hooks.register('boom', () => {
      throw new Error('handler failure')
    })
    await expect(hooks.invoke('boom', {}, { throwOnError: true })).rejects.toThrow(
      /handler failure/
    )
  })

  it('throwOnError=false swallows handler errors silently', async () => {
    const hooks = new HookRegistry()
    hooks.register('boom', () => {
      throw new Error('silent failure')
    })
    await expect(hooks.invoke('boom', {})).resolves.toBeUndefined()
  })
})

describe('HookRegistry — alter (transform chain)', () => {
  it('returns the input untouched when no handler is registered', async () => {
    const hooks = new HookRegistry()
    const out = await hooks.alter('list:alter', { columns: ['a'] })
    expect(out).toEqual({ columns: ['a'] })
  })

  it('chains handler outputs (last return wins for that step)', async () => {
    const hooks = new HookRegistry()
    hooks.register('list:alter', (data: unknown) => ({
      ...(data as object),
      added1: true,
    }))
    hooks.register('list:alter', (data: unknown) => ({
      ...(data as object),
      added2: true,
    }))
    const out = await hooks.alter('list:alter', { base: 1 })
    expect(out).toEqual({ base: 1, added1: true, added2: true })
  })

  it('respects priority order (HIGH runs before LOW for alter)', async () => {
    const hooks = new HookRegistry()
    hooks.register(
      'order',
      (data: unknown) => ({ ...(data as object), order: [...((data as { order: string[] }).order ?? []), 'low'] }),
      { priority: HOOK_PRIORITY.LOW }
    )
    hooks.register(
      'order',
      (data: unknown) => ({ ...(data as object), order: [...((data as { order: string[] }).order ?? []), 'high'] }),
      { priority: HOOK_PRIORITY.HIGH }
    )
    const out = await hooks.alter('order', { order: [] })
    expect((out as { order: string[] }).order).toEqual(['high', 'low'])
  })

  it('respects after dependencies (id-based ordering)', async () => {
    const hooks = new HookRegistry()
    hooks.register(
      'chain',
      (data: unknown) => ({ ...(data as object), trace: [...((data as { trace: string[] }).trace ?? []), 'B'] }),
      { id: 'B', after: 'A' }
    )
    hooks.register(
      'chain',
      (data: unknown) => ({ ...(data as object), trace: [...((data as { trace: string[] }).trace ?? []), 'A'] }),
      { id: 'A' }
    )
    const out = await hooks.alter('chain', { trace: [] })
    expect((out as { trace: string[] }).trace).toEqual(['A', 'B'])
  })

  it('immutable: true prevents handlers from mutating callers data', async () => {
    const hooks = new HookRegistry()
    hooks.register('mut', (data: unknown) => {
      ;(data as { x: number }).x = 999
      return data
    })
    const original = { x: 1 }
    await hooks.alter('mut', original, { immutable: true })
    expect(original.x).toBe(1)
  })
})

describe('HookRegistry — introspection', () => {
  it('hasHook reflects whether at least one handler exists', () => {
    const hooks = new HookRegistry()
    expect(hooks.hasHook('a')).toBe(false)
    const unbind = hooks.register('a', () => {})
    expect(hooks.hasHook('a')).toBe(true)
    unbind()
    expect(hooks.hasHook('a')).toBe(false)
  })

  it('getHandlerCount(name) and (no arg) report sizes', () => {
    const hooks = new HookRegistry()
    hooks.register('x', () => {})
    hooks.register('x', () => {})
    hooks.register('y', () => {})
    expect(hooks.getHandlerCount('x')).toBe(2)
    expect(hooks.getHandlerCount('y')).toBe(1)
    expect(hooks.getHandlerCount()).toBe(3)
  })

  it('getRegisteredHooks lists every hook name with at least one handler', () => {
    const hooks = new HookRegistry()
    hooks.register('alpha', () => {})
    hooks.register('beta', () => {})
    expect(new Set(hooks.getRegisteredHooks())).toEqual(new Set(['alpha', 'beta']))
  })

  it('dispose unbinds every handler', async () => {
    const hooks = new HookRegistry()
    let count = 0
    hooks.register('x', () => {
      count++
    })
    hooks.register('y', () => {
      count++
    })
    hooks.dispose()
    await hooks.invoke('x')
    await hooks.invoke('y')
    expect(count).toBe(0)
    expect(hooks.getHandlerCount()).toBe(0)
  })
})

describe('HookRegistry — factory + once', () => {
  it('createHookRegistry returns a HookRegistry instance', () => {
    expect(createHookRegistry()).toBeInstanceOf(HookRegistry)
  })

  it('once: true makes the handler fire a single time', async () => {
    const hooks = new HookRegistry()
    let count = 0
    hooks.register(
      'one',
      () => {
        count++
      },
      { once: true }
    )
    await hooks.invoke('one')
    await hooks.invoke('one')
    expect(count).toBe(1)
  })
})
