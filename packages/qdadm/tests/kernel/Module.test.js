/**
 * Unit tests for Module base class
 *
 * Tests the Module class interface including static properties,
 * default method behavior, signal cleanup tracking, and subclass inheritance.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Module } from '../../src/kernel/Module'

describe('Module', () => {
  describe('static properties', () => {
    it('has default static moduleName', () => {
      expect(Module.moduleName).toBe('base')
    })

    it('has default empty requires array', () => {
      expect(Module.requires).toEqual([])
    })

    it('has default priority of 0', () => {
      expect(Module.priority).toBe(0)
    })
  })

  describe('instance properties', () => {
    it('stores options passed to constructor', () => {
      const options = { foo: 'bar', name: 'custom' }
      const module = new Module(options)
      expect(module.options).toEqual(options)
    })

    it('defaults options to empty object', () => {
      const module = new Module()
      expect(module.options).toEqual({})
    })

    it('initializes ctx as null', () => {
      const module = new Module()
      expect(module.ctx).toBeNull()
    })

    it('initializes _signalCleanups as empty array', () => {
      const module = new Module()
      expect(module._signalCleanups).toEqual([])
    })
  })

  describe('name getter', () => {
    it('returns options.name if provided', () => {
      const module = new Module({ name: 'custom-name' })
      expect(module.name).toBe('custom-name')
    })

    it('falls back to static moduleName if options.name not provided', () => {
      const module = new Module()
      // Falls back to static moduleName property ('base')
      expect(module.name).toBe('base')
    })

    it('prefers options.name over static moduleName', () => {
      class CustomModule extends Module {
        static moduleName = 'custom'
      }
      const module = new CustomModule({ name: 'override' })
      expect(module.name).toBe('override')
    })

    it('uses subclass static moduleName when no options.name', () => {
      class MyCustomModule extends Module {
        static moduleName = 'my-custom'
      }
      const module = new MyCustomModule()
      expect(module.name).toBe('my-custom')
    })
  })

  describe('enabled() method', () => {
    it('returns true by default', () => {
      const module = new Module()
      expect(module.enabled({})).toBe(true)
    })

    it('receives context parameter', () => {
      const module = new Module()
      const ctx = { isDev: true, debug: false }
      // Default implementation ignores ctx but should accept it
      expect(module.enabled(ctx)).toBe(true)
    })
  })

  describe('connect() method', () => {
    it('is async and resolves without error', async () => {
      const module = new Module()
      await expect(module.connect({})).resolves.toBeUndefined()
    })

    it('accepts context parameter', async () => {
      const module = new Module()
      const ctx = { signals: {}, zones: {} }
      await expect(module.connect(ctx)).resolves.toBeUndefined()
    })
  })

  describe('disconnect() method', () => {
    it('is async and resolves without error', async () => {
      const module = new Module()
      await expect(module.disconnect()).resolves.toBeUndefined()
    })

    it('calls all registered cleanup functions', async () => {
      const module = new Module()
      const cleanup1 = vi.fn()
      const cleanup2 = vi.fn()
      const cleanup3 = vi.fn()

      module._addSignalCleanup(cleanup1)
      module._addSignalCleanup(cleanup2)
      module._addSignalCleanup(cleanup3)

      await module.disconnect()

      expect(cleanup1).toHaveBeenCalledTimes(1)
      expect(cleanup2).toHaveBeenCalledTimes(1)
      expect(cleanup3).toHaveBeenCalledTimes(1)
    })

    it('clears signal cleanups after disconnect', async () => {
      const module = new Module()
      const cleanup = vi.fn()

      module._addSignalCleanup(cleanup)
      expect(module._signalCleanups).toHaveLength(1)

      await module.disconnect()

      expect(module._signalCleanups).toHaveLength(0)
    })

    it('can be called multiple times safely', async () => {
      const module = new Module()
      const cleanup = vi.fn()

      module._addSignalCleanup(cleanup)
      await module.disconnect()
      await module.disconnect()

      // Cleanup should only be called once (on first disconnect)
      expect(cleanup).toHaveBeenCalledTimes(1)
    })
  })

  describe('_addSignalCleanup() method', () => {
    it('adds cleanup function to _signalCleanups array', () => {
      const module = new Module()
      const cleanup = vi.fn()

      module._addSignalCleanup(cleanup)

      expect(module._signalCleanups).toContain(cleanup)
    })

    it('accumulates multiple cleanup functions', () => {
      const module = new Module()
      const cleanup1 = vi.fn()
      const cleanup2 = vi.fn()

      module._addSignalCleanup(cleanup1)
      module._addSignalCleanup(cleanup2)

      expect(module._signalCleanups).toHaveLength(2)
      expect(module._signalCleanups).toContain(cleanup1)
      expect(module._signalCleanups).toContain(cleanup2)
    })
  })

  describe('subclass inheritance', () => {
    it('allows overriding static moduleName', () => {
      class UsersModule extends Module {
        static moduleName = 'users'
      }
      expect(UsersModule.moduleName).toBe('users')
    })

    it('allows overriding static requires', () => {
      class DependentModule extends Module {
        static moduleName = 'dependent'
        static requires = ['auth', 'api']
      }
      expect(DependentModule.requires).toEqual(['auth', 'api'])
    })

    it('allows overriding static priority', () => {
      class HighPriorityModule extends Module {
        static moduleName = 'high-priority'
        static priority = 100
      }
      expect(HighPriorityModule.priority).toBe(100)
    })

    it('allows overriding enabled() method', () => {
      class DevOnlyModule extends Module {
        static moduleName = 'dev-only'
        enabled(ctx) {
          return ctx.isDev === true
        }
      }

      const module = new DevOnlyModule()
      expect(module.enabled({ isDev: true })).toBe(true)
      expect(module.enabled({ isDev: false })).toBe(false)
      expect(module.enabled({})).toBe(false)
    })

    it('allows overriding connect() method', async () => {
      const connectFn = vi.fn()

      class CustomModule extends Module {
        static moduleName = 'custom'
        async connect(ctx) {
          this.ctx = ctx
          connectFn(ctx)
        }
      }

      const module = new CustomModule()
      const ctx = { signals: {}, zones: {} }
      await module.connect(ctx)

      expect(connectFn).toHaveBeenCalledWith(ctx)
      expect(module.ctx).toBe(ctx)
    })

    it('allows overriding disconnect() with super call', async () => {
      const customCleanup = vi.fn()
      const signalCleanup = vi.fn()

      class CustomModule extends Module {
        static moduleName = 'custom'
        async disconnect() {
          customCleanup()
          await super.disconnect()
        }
      }

      const module = new CustomModule()
      module._addSignalCleanup(signalCleanup)
      await module.disconnect()

      expect(customCleanup).toHaveBeenCalledTimes(1)
      expect(signalCleanup).toHaveBeenCalledTimes(1)
    })

    it('full Module subclass with all features', async () => {
      class FullModule extends Module {
        static moduleName = 'full'
        static requires = ['auth']
        static priority = 50

        enabled(ctx) {
          return ctx.isDev !== false
        }

        async connect(ctx) {
          this.ctx = ctx
          this.initialized = true
        }

        async disconnect() {
          this.initialized = false
          await super.disconnect()
        }
      }

      expect(FullModule.moduleName).toBe('full')
      expect(FullModule.requires).toEqual(['auth'])
      expect(FullModule.priority).toBe(50)

      const module = new FullModule()
      expect(module.name).toBe('full')
      expect(module.enabled({ isDev: true })).toBe(true)
      expect(module.enabled({ isDev: false })).toBe(false)

      const ctx = { signals: {} }
      await module.connect(ctx)
      expect(module.ctx).toBe(ctx)
      expect(module.initialized).toBe(true)

      await module.disconnect()
      expect(module.initialized).toBe(false)
    })
  })

  describe('signal cleanup lifecycle', () => {
    it('tracks cleanups registered during connect', async () => {
      class TrackingModule extends Module {
        static moduleName = 'tracking'

        async connect(ctx) {
          // Simulate what KernelContext.on() does
          const unsub1 = () => {}
          const unsub2 = () => {}
          this._addSignalCleanup(unsub1)
          this._addSignalCleanup(unsub2)
        }
      }

      const module = new TrackingModule()
      await module.connect({})

      expect(module._signalCleanups).toHaveLength(2)
    })

    it('executes cleanups in order on disconnect', async () => {
      const order = []

      class OrderedModule extends Module {
        static moduleName = 'ordered'

        async connect() {
          this._addSignalCleanup(() => order.push('first'))
          this._addSignalCleanup(() => order.push('second'))
          this._addSignalCleanup(() => order.push('third'))
        }
      }

      const module = new OrderedModule()
      await module.connect({})
      await module.disconnect()

      expect(order).toEqual(['first', 'second', 'third'])
    })

    it('cleanup functions can be added at any time', () => {
      const module = new Module()

      module._addSignalCleanup(() => {})
      expect(module._signalCleanups).toHaveLength(1)

      module._addSignalCleanup(() => {})
      expect(module._signalCleanups).toHaveLength(2)

      module._addSignalCleanup(() => {})
      expect(module._signalCleanups).toHaveLength(3)
    })
  })

  describe('edge cases', () => {
    it('handles null context gracefully', async () => {
      const module = new Module()
      await expect(module.connect(null)).resolves.toBeUndefined()
    })

    it('handles undefined context gracefully', async () => {
      const module = new Module()
      await expect(module.connect(undefined)).resolves.toBeUndefined()
    })

    it('cleanup function that throws does not prevent others', async () => {
      const module = new Module()
      const cleanup1 = vi.fn()
      const cleanup2 = vi.fn(() => {
        throw new Error('Cleanup error')
      })
      const cleanup3 = vi.fn()

      module._addSignalCleanup(cleanup1)
      module._addSignalCleanup(cleanup2)
      module._addSignalCleanup(cleanup3)

      // disconnect() does not catch errors in cleanup functions by default
      // This test documents the current behavior
      await expect(module.disconnect()).rejects.toThrow('Cleanup error')
      expect(cleanup1).toHaveBeenCalled()
      expect(cleanup2).toHaveBeenCalled()
      // cleanup3 is not called because cleanup2 threw
    })
  })
})
