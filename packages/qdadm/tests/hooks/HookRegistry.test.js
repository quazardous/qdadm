/**
 * HookRegistry Test Suite
 *
 * Tests for the Drupal-inspired hook system built on QuarKernel.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { HookRegistry, createHookRegistry, HOOK_PRIORITY } from '../../src/hooks/index.js'

describe('HookRegistry', () => {
  let hooks

  beforeEach(() => {
    hooks = createHookRegistry()
  })

  afterEach(() => {
    hooks.dispose()
  })

  describe('register()', () => {
    it('registers a handler and returns unbind function', () => {
      const handler = () => {}
      const unbind = hooks.register('test:hook', handler)

      expect(typeof unbind).toBe('function')
      expect(hooks.hasHook('test:hook')).toBe(true)
      expect(hooks.getHandlerCount('test:hook')).toBe(1)
    })

    it('accepts default priority (50)', () => {
      const callOrder = []
      hooks.register('test:hook', () => callOrder.push('default'))

      const registered = hooks._hooks.get('test:hook')
      expect(registered[0].priority).toBe(50)
    })

    it('accepts custom priority', () => {
      const callOrder = []
      hooks.register('test:hook', () => callOrder.push('low'), { priority: HOOK_PRIORITY.LOW })
      hooks.register('test:hook', () => callOrder.push('high'), { priority: HOOK_PRIORITY.HIGH })

      const registered = hooks._hooks.get('test:hook')
      expect(registered.find(h => h.priority === HOOK_PRIORITY.LOW)).toBeDefined()
      expect(registered.find(h => h.priority === HOOK_PRIORITY.HIGH)).toBeDefined()
    })

    it('accepts explicit handler ID', () => {
      hooks.register('test:hook', () => {}, { id: 'my-handler' })

      const registered = hooks._hooks.get('test:hook')
      expect(registered[0].id).toBe('my-handler')
    })

    it('tracks after dependencies in hook entry', () => {
      hooks.register('test:hook', () => {}, { id: 'first' })
      hooks.register('test:hook', () => {}, { id: 'second', after: 'first' })

      const registered = hooks._hooks.get('test:hook')
      const second = registered.find(h => h.id === 'second')
      expect(second.after).toBe('first')
    })

    it('tracks array of after dependencies', () => {
      hooks.register('test:hook', () => {}, { id: 'a' })
      hooks.register('test:hook', () => {}, { id: 'b' })
      hooks.register('test:hook', () => {}, { id: 'c', after: ['a', 'b'] })

      const registered = hooks._hooks.get('test:hook')
      const c = registered.find(h => h.id === 'c')
      expect(c.after).toEqual(['a', 'b'])
    })

    it('tracks once option in hook entry', () => {
      hooks.register('test:hook', () => {}, { once: true })

      const registered = hooks._hooks.get('test:hook')
      expect(registered[0].once).toBe(true)
    })

    it('unbind function removes handler', () => {
      const unbind = hooks.register('test:hook', () => {})
      expect(hooks.getHandlerCount('test:hook')).toBe(1)

      unbind()
      expect(hooks.getHandlerCount('test:hook')).toBe(0)
      expect(hooks.hasHook('test:hook')).toBe(false)
    })

    it('supports multiple handlers on same hook', () => {
      hooks.register('test:hook', () => {})
      hooks.register('test:hook', () => {})
      hooks.register('test:hook', () => {})

      expect(hooks.getHandlerCount('test:hook')).toBe(3)
    })

    it('colon-delimited hook names work correctly', () => {
      hooks.register('entity:presave', () => {})
      hooks.register('list:alter', () => {})
      hooks.register('module:entity:custom', () => {})

      expect(hooks.hasHook('entity:presave')).toBe(true)
      expect(hooks.hasHook('list:alter')).toBe(true)
      expect(hooks.hasHook('module:entity:custom')).toBe(true)
    })
  })

  describe('HOOK_PRIORITY constants', () => {
    it('provides correct priority values', () => {
      expect(HOOK_PRIORITY.FIRST).toBe(100)
      expect(HOOK_PRIORITY.HIGH).toBe(75)
      expect(HOOK_PRIORITY.NORMAL).toBe(50)
      expect(HOOK_PRIORITY.LOW).toBe(25)
      expect(HOOK_PRIORITY.LAST).toBe(0)
    })

    it('FIRST > HIGH > NORMAL > LOW > LAST', () => {
      expect(HOOK_PRIORITY.FIRST).toBeGreaterThan(HOOK_PRIORITY.HIGH)
      expect(HOOK_PRIORITY.HIGH).toBeGreaterThan(HOOK_PRIORITY.NORMAL)
      expect(HOOK_PRIORITY.NORMAL).toBeGreaterThan(HOOK_PRIORITY.LOW)
      expect(HOOK_PRIORITY.LOW).toBeGreaterThan(HOOK_PRIORITY.LAST)
    })
  })

  describe('priority ordering via QuarKernel', () => {
    it('higher priority handlers execute first in invoke', async () => {
      const callOrder = []

      hooks.register('test:hook', () => callOrder.push('last'), { priority: HOOK_PRIORITY.LAST })
      hooks.register('test:hook', () => callOrder.push('first'), { priority: HOOK_PRIORITY.FIRST })
      hooks.register('test:hook', () => callOrder.push('normal'), { priority: HOOK_PRIORITY.NORMAL })

      await hooks.invoke('test:hook', {})

      expect(callOrder).toEqual(['first', 'normal', 'last'])
    })
  })

  describe('dependency ordering via after option', () => {
    it('runs handler after specified dependency', async () => {
      const callOrder = []

      hooks.register('test:hook', () => callOrder.push('second'), { id: 'second', after: 'first' })
      hooks.register('test:hook', () => callOrder.push('first'), { id: 'first' })

      await hooks.invoke('test:hook', {})

      expect(callOrder.indexOf('first')).toBeLessThan(callOrder.indexOf('second'))
    })

    it('runs handler after multiple dependencies', async () => {
      const callOrder = []

      hooks.register('test:hook', () => callOrder.push('third'), { id: 'third', after: ['first', 'second'] })
      hooks.register('test:hook', () => callOrder.push('first'), { id: 'first' })
      hooks.register('test:hook', () => callOrder.push('second'), { id: 'second' })

      await hooks.invoke('test:hook', {})

      expect(callOrder.indexOf('first')).toBeLessThan(callOrder.indexOf('third'))
      expect(callOrder.indexOf('second')).toBeLessThan(callOrder.indexOf('third'))
    })
  })

  describe('once option', () => {
    it('removes handler after first invocation', async () => {
      let callCount = 0
      hooks.register('test:hook', () => callCount++, { once: true })

      await hooks.invoke('test:hook', {})
      await hooks.invoke('test:hook', {})
      await hooks.invoke('test:hook', {})

      expect(callCount).toBe(1)
    })
  })

  describe('introspection', () => {
    it('getRegisteredHooks returns all hook names', () => {
      hooks.register('hook:a', () => {})
      hooks.register('hook:b', () => {})
      hooks.register('hook:c', () => {})

      const registered = hooks.getRegisteredHooks()
      expect(registered).toContain('hook:a')
      expect(registered).toContain('hook:b')
      expect(registered).toContain('hook:c')
    })

    it('getHandlerCount returns correct count', () => {
      hooks.register('hook:a', () => {})
      hooks.register('hook:a', () => {})
      hooks.register('hook:b', () => {})

      expect(hooks.getHandlerCount('hook:a')).toBe(2)
      expect(hooks.getHandlerCount('hook:b')).toBe(1)
      expect(hooks.getHandlerCount()).toBe(3)
    })

    it('hasHook returns false for unregistered hooks', () => {
      expect(hooks.hasHook('nonexistent')).toBe(false)
    })
  })

  describe('dispose()', () => {
    it('removes all handlers', () => {
      hooks.register('hook:a', () => {})
      hooks.register('hook:b', () => {})

      hooks.dispose()

      expect(hooks.getHandlerCount()).toBe(0)
      expect(hooks.getRegisteredHooks()).toHaveLength(0)
    })
  })

  describe('invoke()', () => {
    it('calls handlers with context as event.data', async () => {
      let receivedEvent = null
      hooks.register('test:hook', (event) => {
        receivedEvent = event
      })

      const context = { entity: { id: 1 }, manager: 'test' }
      await hooks.invoke('test:hook', context)

      // QuarKernel passes (event, listenerContext) to handlers
      // event.data contains our context object
      expect(receivedEvent.data).toBe(context)
      expect(receivedEvent.name).toBe('test:hook')
    })

    it('allows handlers to mutate event.data (context)', async () => {
      hooks.register('test:hook', (event) => {
        event.data.modified = true
      }, { priority: HOOK_PRIORITY.FIRST })

      hooks.register('test:hook', (event) => {
        event.data.count = (event.data.count || 0) + 1
      }, { priority: HOOK_PRIORITY.NORMAL })

      const context = { count: 0 }
      await hooks.invoke('test:hook', context)

      expect(context.modified).toBe(true)
      expect(context.count).toBe(1)
    })

    it('executes handlers sequentially (serial execution)', async () => {
      const callOrder = []

      hooks.register('test:hook', async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        callOrder.push('slow')
      }, { priority: HOOK_PRIORITY.FIRST })

      hooks.register('test:hook', () => {
        callOrder.push('fast')
      }, { priority: HOOK_PRIORITY.NORMAL })

      await hooks.invoke('test:hook', {})

      // Serial execution means slow (higher priority) completes before fast starts
      expect(callOrder).toEqual(['slow', 'fast'])
    })

    it('supports async handlers', async () => {
      hooks.register('test:hook', async (event) => {
        await new Promise(resolve => setTimeout(resolve, 5))
        event.data.asyncValue = 'completed'
      })

      const context = {}
      await hooks.invoke('test:hook', context)

      expect(context.asyncValue).toBe('completed')
    })

    it('continues on handler error by default (error boundary)', async () => {
      const callOrder = []

      hooks.register('test:hook', () => {
        callOrder.push('first')
      }, { priority: HOOK_PRIORITY.FIRST })

      hooks.register('test:hook', () => {
        callOrder.push('error')
        throw new Error('Handler error')
      }, { priority: HOOK_PRIORITY.NORMAL })

      hooks.register('test:hook', () => {
        callOrder.push('last')
      }, { priority: HOOK_PRIORITY.LAST })

      // Should not throw - continues on error
      await hooks.invoke('test:hook', {})

      // All handlers should have been called
      expect(callOrder).toEqual(['first', 'error', 'last'])
    })

    it('throwOnError option rethrows collected errors', async () => {
      hooks.register('test:hook', () => {
        throw new Error('First error')
      }, { id: 'handler1', priority: HOOK_PRIORITY.FIRST })

      hooks.register('test:hook', () => {
        throw new Error('Second error')
      }, { id: 'handler2', priority: HOOK_PRIORITY.NORMAL })

      await expect(
        hooks.invoke('test:hook', {}, { throwOnError: true })
      ).rejects.toThrow(AggregateError)
    })

    it('throwOnError includes all errors in AggregateError', async () => {
      hooks.register('test:hook', () => {
        throw new Error('Error A')
      }, { id: 'a', priority: HOOK_PRIORITY.FIRST })

      hooks.register('test:hook', () => {
        throw new Error('Error B')
      }, { id: 'b', priority: HOOK_PRIORITY.LAST })

      try {
        await hooks.invoke('test:hook', {}, { throwOnError: true })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        expect(error.errors).toHaveLength(2)
        expect(error.errors[0].message).toBe('Error A')
        expect(error.errors[1].message).toBe('Error B')
      }
    })

    it('throwOnError does not throw when no errors', async () => {
      hooks.register('test:hook', () => {})

      // Should not throw
      await hooks.invoke('test:hook', {}, { throwOnError: true })
    })

    it('uses default empty context when not provided', async () => {
      let receivedEvent = null
      hooks.register('test:hook', (event) => {
        receivedEvent = event
      })

      await hooks.invoke('test:hook')

      // QuarKernel passes event, context is in event.data
      expect(receivedEvent.data).toEqual({})
    })

    it('does not throw for hook with no handlers', async () => {
      // Should complete without error
      await hooks.invoke('nonexistent:hook', { data: 'test' })
    })

    it('respects priority ordering', async () => {
      const callOrder = []

      hooks.register('test:hook', () => callOrder.push('last'), { priority: HOOK_PRIORITY.LAST })
      hooks.register('test:hook', () => callOrder.push('first'), { priority: HOOK_PRIORITY.FIRST })
      hooks.register('test:hook', () => callOrder.push('normal'), { priority: HOOK_PRIORITY.NORMAL })

      await hooks.invoke('test:hook', {})

      expect(callOrder).toEqual(['first', 'normal', 'last'])
    })

    it('respects dependency ordering via after', async () => {
      const callOrder = []

      hooks.register('test:hook', () => callOrder.push('second'), { id: 'second', after: 'first' })
      hooks.register('test:hook', () => callOrder.push('first'), { id: 'first' })

      await hooks.invoke('test:hook', {})

      expect(callOrder.indexOf('first')).toBeLessThan(callOrder.indexOf('second'))
    })
  })

  describe('alter()', () => {
    it('returns data unchanged when no handlers registered', async () => {
      const data = { value: 42 }
      const result = await hooks.alter('nonexistent:hook', data)
      expect(result).toBe(data)
    })

    it('chains handlers using reduce pattern', async () => {
      hooks.register('transform:data', (data) => {
        return { ...data, step1: true }
      }, { priority: HOOK_PRIORITY.FIRST })

      hooks.register('transform:data', (data) => {
        return { ...data, step2: true }
      }, { priority: HOOK_PRIORITY.NORMAL })

      hooks.register('transform:data', (data) => {
        return { ...data, step3: true }
      }, { priority: HOOK_PRIORITY.LAST })

      const result = await hooks.alter('transform:data', { initial: true })

      expect(result.initial).toBe(true)
      expect(result.step1).toBe(true)
      expect(result.step2).toBe(true)
      expect(result.step3).toBe(true)
    })

    it('passes output of each handler to the next', async () => {
      hooks.register('counter:alter', (num) => num + 1, { priority: HOOK_PRIORITY.FIRST })
      hooks.register('counter:alter', (num) => num * 2, { priority: HOOK_PRIORITY.NORMAL })
      hooks.register('counter:alter', (num) => num + 10, { priority: HOOK_PRIORITY.LAST })

      // 5 -> 6 (add 1) -> 12 (multiply 2) -> 22 (add 10)
      const result = await hooks.alter('counter:alter', 5)
      expect(result).toBe(22)
    })

    it('respects priority ordering (higher first)', async () => {
      const callOrder = []

      hooks.register('order:alter', (data) => {
        callOrder.push('last')
        return data
      }, { priority: HOOK_PRIORITY.LAST })

      hooks.register('order:alter', (data) => {
        callOrder.push('first')
        return data
      }, { priority: HOOK_PRIORITY.FIRST })

      hooks.register('order:alter', (data) => {
        callOrder.push('normal')
        return data
      }, { priority: HOOK_PRIORITY.NORMAL })

      await hooks.alter('order:alter', {})

      expect(callOrder).toEqual(['first', 'normal', 'last'])
    })

    it('respects after dependency ordering', async () => {
      const callOrder = []

      hooks.register('dep:alter', (data) => {
        callOrder.push('second')
        return data
      }, { id: 'second', after: 'first' })

      hooks.register('dep:alter', (data) => {
        callOrder.push('first')
        return data
      }, { id: 'first' })

      await hooks.alter('dep:alter', {})

      expect(callOrder.indexOf('first')).toBeLessThan(callOrder.indexOf('second'))
    })

    it('respects multiple after dependencies', async () => {
      const callOrder = []

      hooks.register('multi:alter', (data) => {
        callOrder.push('third')
        return data
      }, { id: 'third', after: ['first', 'second'] })

      hooks.register('multi:alter', (data) => {
        callOrder.push('first')
        return data
      }, { id: 'first' })

      hooks.register('multi:alter', (data) => {
        callOrder.push('second')
        return data
      }, { id: 'second' })

      await hooks.alter('multi:alter', {})

      expect(callOrder.indexOf('first')).toBeLessThan(callOrder.indexOf('third'))
      expect(callOrder.indexOf('second')).toBeLessThan(callOrder.indexOf('third'))
    })

    it('keeps current value when handler returns undefined', async () => {
      hooks.register('keep:alter', (data) => {
        data.mutated = true
        // No return - undefined
      }, { priority: HOOK_PRIORITY.FIRST })

      hooks.register('keep:alter', (data) => {
        return { ...data, explicit: true }
      }, { priority: HOOK_PRIORITY.LAST })

      const result = await hooks.alter('keep:alter', { original: true })

      // Since first handler mutates without returning, same object is kept
      // Then second handler returns a new object
      expect(result.original).toBe(true)
      expect(result.mutated).toBe(true)
      expect(result.explicit).toBe(true)
    })

    it('supports async handlers', async () => {
      hooks.register('async:alter', async (data) => {
        await new Promise(resolve => setTimeout(resolve, 5))
        return { ...data, async1: true }
      }, { priority: HOOK_PRIORITY.FIRST })

      hooks.register('async:alter', async (data) => {
        await new Promise(resolve => setTimeout(resolve, 5))
        return { ...data, async2: true }
      }, { priority: HOOK_PRIORITY.LAST })

      const result = await hooks.alter('async:alter', { initial: true })

      expect(result.initial).toBe(true)
      expect(result.async1).toBe(true)
      expect(result.async2).toBe(true)
    })

    it('preserves type for primitive values', async () => {
      hooks.register('string:alter', (str) => str + ' world')
      const stringResult = await hooks.alter('string:alter', 'hello')
      expect(stringResult).toBe('hello world')

      hooks.register('number:alter', (num) => num * 2)
      const numberResult = await hooks.alter('number:alter', 21)
      expect(numberResult).toBe(42)

      hooks.register('bool:alter', (bool) => !bool)
      const boolResult = await hooks.alter('bool:alter', true)
      expect(boolResult).toBe(false)
    })

    it('preserves type for arrays', async () => {
      hooks.register('array:alter', (arr) => [...arr, 3])
      hooks.register('array:alter', (arr) => [...arr, 4])

      const result = await hooks.alter('array:alter', [1, 2])
      expect(result).toEqual([1, 2, 3, 4])
      expect(Array.isArray(result)).toBe(true)
    })

    describe('immutability option', () => {
      it('clones data between handlers when immutable: true', async () => {
        const receivedInputs = []

        hooks.register('immutable:alter', (data) => {
          receivedInputs.push(data)
          data.handler1 = true
          return data
        }, { priority: HOOK_PRIORITY.FIRST })

        hooks.register('immutable:alter', (data) => {
          receivedInputs.push(data)
          data.handler2 = true
          return data
        }, { priority: HOOK_PRIORITY.LAST })

        const original = { initial: true }
        const result = await hooks.alter('immutable:alter', original, { immutable: true })

        // Each handler should receive a clone
        expect(receivedInputs[0]).not.toBe(receivedInputs[1])
        // Original should be unchanged
        expect(original.handler1).toBeUndefined()
        expect(original.handler2).toBeUndefined()
        // Final result should have all modifications
        expect(result.initial).toBe(true)
        expect(result.handler1).toBe(true)
        expect(result.handler2).toBe(true)
      })

      it('does not clone when immutable: false (default)', async () => {
        const receivedInputs = []

        hooks.register('mutable:alter', (data) => {
          receivedInputs.push(data)
          data.handler1 = true
          return data
        }, { priority: HOOK_PRIORITY.FIRST })

        hooks.register('mutable:alter', (data) => {
          receivedInputs.push(data)
          data.handler2 = true
          return data
        }, { priority: HOOK_PRIORITY.LAST })

        const original = { initial: true }
        const result = await hooks.alter('mutable:alter', original)

        // All handlers receive the same object
        expect(receivedInputs[0]).toBe(original)
        expect(receivedInputs[1]).toBe(original)
        // Original is mutated
        expect(original.handler1).toBe(true)
        expect(original.handler2).toBe(true)
        // Result is same object
        expect(result).toBe(original)
      })

      it('immutability clones nested objects', async () => {
        hooks.register('deep:alter', (data) => {
          data.nested.value = 'modified'
          return data
        })

        const original = { nested: { value: 'original' } }
        const result = await hooks.alter('deep:alter', original, { immutable: true })

        expect(original.nested.value).toBe('original')
        expect(result.nested.value).toBe('modified')
      })

      it('immutability handles null and undefined gracefully', async () => {
        hooks.register('null:alter', (data) => data)

        const nullResult = await hooks.alter('null:alter', null, { immutable: true })
        expect(nullResult).toBeNull()

        const undefinedResult = await hooks.alter('undefined:alter', undefined, { immutable: true })
        expect(undefinedResult).toBeUndefined()
      })

      it('immutability handles primitives without cloning', async () => {
        hooks.register('primitive:alter', (num) => num + 1)

        const result = await hooks.alter('primitive:alter', 42, { immutable: true })
        expect(result).toBe(43)
      })
    })

    it('typical use case: list config alteration', async () => {
      // Simulate list configuration alteration
      hooks.register('list:alter', (config) => {
        config.columns.push({ field: 'created_at', label: 'Created' })
        return config
      }, { id: 'core', priority: HOOK_PRIORITY.NORMAL })

      hooks.register('list:alter', (config) => {
        config.columns.push({ field: 'custom_field', label: 'Custom' })
        return config
      }, { id: 'custom', after: 'core', priority: HOOK_PRIORITY.LOW })

      const baseConfig = {
        columns: [
          { field: 'id', label: 'ID' },
          { field: 'name', label: 'Name' },
        ],
      }

      const result = await hooks.alter('list:alter', baseConfig)

      expect(result.columns).toHaveLength(4)
      expect(result.columns[2].field).toBe('created_at')
      expect(result.columns[3].field).toBe('custom_field')
    })
  })

  describe('factory function', () => {
    it('createHookRegistry returns HookRegistry instance', () => {
      const registry = createHookRegistry()
      expect(registry).toBeInstanceOf(HookRegistry)
      registry.dispose()
    })

    it('accepts debug option', () => {
      const registry = createHookRegistry({ debug: true })
      expect(registry).toBeInstanceOf(HookRegistry)
      registry.dispose()
    })
  })

  describe('edge cases', () => {
    it('handles circular dependencies gracefully', async () => {
      const callOrder = []

      // Create circular dependency: a -> b -> a
      hooks.register('circular:hook', () => callOrder.push('a'), { id: 'a', after: 'b' })
      hooks.register('circular:hook', () => callOrder.push('b'), { id: 'b', after: 'a' })

      // Should not hang or throw, handlers should still execute
      await hooks.alter('circular:hook', {})

      expect(callOrder).toHaveLength(2)
      expect(callOrder).toContain('a')
      expect(callOrder).toContain('b')
    })

    it('mixed priority and dependency ordering', async () => {
      const callOrder = []

      // High priority but depends on low priority handler
      hooks.register('mixed:hook', () => callOrder.push('high-dependent'),
        { id: 'high-dep', priority: HOOK_PRIORITY.HIGH, after: 'low' })
      hooks.register('mixed:hook', () => callOrder.push('low'),
        { id: 'low', priority: HOOK_PRIORITY.LOW })
      hooks.register('mixed:hook', () => callOrder.push('normal'),
        { id: 'normal', priority: HOOK_PRIORITY.NORMAL })

      await hooks.alter('mixed:hook', {})

      // Dependency takes precedence: low must run before high-dependent
      expect(callOrder.indexOf('low')).toBeLessThan(callOrder.indexOf('high-dependent'))
    })

    it('ignores non-existent dependency in after option', async () => {
      const callOrder = []

      // Handler depends on non-existent handler
      hooks.register('ignore:hook', () => callOrder.push('first'), { id: 'first' })
      hooks.register('ignore:hook', () => callOrder.push('depends'),
        { id: 'depends', after: 'nonexistent' })

      await hooks.alter('ignore:hook', {})

      // Both handlers should execute
      expect(callOrder).toHaveLength(2)
    })

    it('same priority maintains registration order', async () => {
      const callOrder = []

      hooks.register('order:hook', () => callOrder.push('a'), { priority: 50 })
      hooks.register('order:hook', () => callOrder.push('b'), { priority: 50 })
      hooks.register('order:hook', () => callOrder.push('c'), { priority: 50 })

      await hooks.invoke('order:hook', {})

      // QuarKernel maintains registration order for same priority
      expect(callOrder).toEqual(['a', 'b', 'c'])
    })

    it('debug() method enables/disables debug mode', () => {
      // Should not throw
      hooks.debug(true)
      hooks.debug(false)
    })

    it('accepts external kernel in constructor', async () => {
      const { createKernel } = await import('@quazardous/quarkernel')
      const externalKernel = createKernel({
        delimiter: ':',
        wildcard: true,
        errorBoundary: true,
      })

      const customHooks = new HookRegistry({ kernel: externalKernel })
      let called = false
      customHooks.register('test:hook', () => { called = true })
      await customHooks.invoke('test:hook', {})

      expect(called).toBe(true)
      customHooks.dispose()
    })

    it('getHandlerCount returns 0 for unknown hook', () => {
      expect(hooks.getHandlerCount('unknown:hook')).toBe(0)
    })

    it('unbind only removes specific handler', () => {
      const unbind1 = hooks.register('multi:hook', () => {})
      hooks.register('multi:hook', () => {})
      hooks.register('multi:hook', () => {})

      expect(hooks.getHandlerCount('multi:hook')).toBe(3)

      unbind1()
      expect(hooks.getHandlerCount('multi:hook')).toBe(2)
    })

    it('alter handles async error in handler', async () => {
      hooks.register('async-error:alter', async () => {
        await new Promise(resolve => setTimeout(resolve, 5))
        throw new Error('Async alter error')
      })

      // alter() does not have error boundary, should throw
      await expect(hooks.alter('async-error:alter', {})).rejects.toThrow('Async alter error')
    })
  })
})
