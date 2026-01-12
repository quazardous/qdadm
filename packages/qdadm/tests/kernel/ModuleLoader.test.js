/**
 * Unit tests for ModuleLoader
 *
 * Tests duck typing detection, module normalization, topological sorting,
 * and error handling for the module loading system.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ModuleLoader,
  createModuleLoader,
  ModuleNotFoundError,
  CircularDependencyError,
  ModuleLoadError,
} from '../../src/kernel/ModuleLoader'
import { Module } from '../../src/kernel/Module'

describe('ModuleLoader', () => {
  describe('factory function', () => {
    it('createModuleLoader returns ModuleLoader instance', () => {
      const loader = createModuleLoader()
      expect(loader).toBeInstanceOf(ModuleLoader)
    })
  })

  describe('add() - duck typing detection', () => {
    let loader

    beforeEach(() => {
      loader = new ModuleLoader()
    })

    it('accepts Module instance', () => {
      class TestModule extends Module {
        static name = 'test'
      }
      const instance = new TestModule()

      loader.add(instance)
      expect(loader._registered.has('test')).toBe(true)
    })

    it('accepts Module class and instantiates it', () => {
      class TestModule extends Module {
        static name = 'test'
      }

      loader.add(TestModule)
      expect(loader._registered.has('test')).toBe(true)
      expect(loader._registered.get('test')).toBeInstanceOf(Module)
    })

    it('accepts class with static name and prototype.connect', () => {
      // Note: Classes must use Object.defineProperty for static name
      // because 'class X { static name = "..." }' doesn't create an own property
      // in the same way across all JS engines
      class CustomModule {
        async connect() {}
      }
      Object.defineProperty(CustomModule, 'name', { value: 'custom', writable: true })

      loader.add(CustomModule)
      expect(loader._registered.has('custom')).toBe(true)
    })

    it('accepts plain object with connect function', () => {
      const obj = {
        name: 'plain',
        connect() {},
      }

      loader.add(obj)
      expect(loader._registered.has('plain')).toBe(true)
    })

    it('accepts legacy init function', () => {
      function legacyInit({ registry }) {
        // Legacy pattern
      }

      loader.add(legacyInit)
      expect(loader._registered.has('legacyInit')).toBe(true)
    })

    it('throws on module without name', () => {
      const obj = {
        connect() {},
      }

      expect(() => loader.add(obj)).toThrow('Module must have a name')
    })

    it('throws on duplicate module name', () => {
      loader.add({ name: 'dup', connect() {} })

      expect(() => loader.add({ name: 'dup', connect() {} })).toThrow(
        "Module 'dup' is already registered"
      )
    })

    it('throws on invalid module format', () => {
      expect(() => loader.add('invalid')).toThrow('Invalid module format')
      expect(() => loader.add(42)).toThrow('Invalid module format')
      expect(() => loader.add(null)).toThrow('Invalid module format')
      expect(() => loader.add({})).toThrow('Invalid module format')
    })

    it('supports chaining', () => {
      const result = loader
        .add({ name: 'a', connect() {} })
        .add({ name: 'b', connect() {} })

      expect(result).toBe(loader)
      expect(loader._registered.size).toBe(2)
    })
  })

  describe('module normalization', () => {
    let loader

    beforeEach(() => {
      loader = new ModuleLoader()
    })

    it('normalized module has name property', () => {
      loader.add({ name: 'test', connect() {} })
      const module = loader._registered.get('test')

      expect(module.name).toBe('test')
    })

    it('normalized module has requires array (default empty)', () => {
      loader.add({ name: 'test', connect() {} })
      const module = loader._registered.get('test')

      expect(module.requires).toEqual([])
    })

    it('normalized module preserves requires array', () => {
      loader.add({ name: 'test', requires: ['dep1', 'dep2'], connect() {} })
      const module = loader._registered.get('test')

      expect(module.requires).toEqual(['dep1', 'dep2'])
    })

    it('normalized module has priority (default 0)', () => {
      loader.add({ name: 'test', connect() {} })
      const module = loader._registered.get('test')

      expect(module.priority).toBe(0)
    })

    it('normalized module preserves priority', () => {
      loader.add({ name: 'test', priority: 100, connect() {} })
      const module = loader._registered.get('test')

      expect(module.priority).toBe(100)
    })

    it('normalized module has enabled method (default true)', () => {
      loader.add({ name: 'test', connect() {} })
      const module = loader._registered.get('test')

      expect(module.enabled({})).toBe(true)
    })

    it('normalized module respects enabled: false', () => {
      loader.add({ name: 'test', enabled: false, connect() {} })
      const module = loader._registered.get('test')

      expect(module.enabled({})).toBe(false)
    })

    it('normalized module respects enabled function', () => {
      loader.add({
        name: 'test',
        enabled: (ctx) => ctx.isDev,
        connect() {},
      })
      const module = loader._registered.get('test')

      expect(module.enabled({ isDev: true })).toBe(true)
      expect(module.enabled({ isDev: false })).toBe(false)
    })

    it('normalized module has connect method', async () => {
      const connectFn = vi.fn()
      loader.add({ name: 'test', connect: connectFn })
      const module = loader._registered.get('test')

      await module.connect({ foo: 'bar' })
      expect(connectFn).toHaveBeenCalledWith({ foo: 'bar' })
    })

    it('normalized module has disconnect method', async () => {
      const disconnectFn = vi.fn()
      loader.add({ name: 'test', connect() {}, disconnect: disconnectFn })
      const module = loader._registered.get('test')

      await module.disconnect()
      expect(disconnectFn).toHaveBeenCalled()
    })
  })

  describe('legacy function adapter', () => {
    let loader

    beforeEach(() => {
      loader = new ModuleLoader()
    })

    it('wraps function with module interface', () => {
      function myLegacyModule() {}
      loader.add(myLegacyModule)

      const module = loader._registered.get('myLegacyModule')
      expect(module.name).toBe('myLegacyModule')
      expect(module.requires).toEqual([])
      expect(module.priority).toBe(0)
      expect(module.enabled()).toBe(true)
    })

    it('calls function with legacy API on connect', async () => {
      function initFn() {}
      const mockFn = vi.fn()
      const wrappedInitFn = function initFn(api) {
        mockFn(api)
      }
      loader.add(wrappedInitFn)

      const ctx = {
        routes: vi.fn().mockReturnThis(),
        navItem: vi.fn().mockReturnThis(),
        routeFamily: vi.fn().mockReturnThis(),
        zones: {},
      }

      const module = loader._registered.get('initFn')
      await module.connect(ctx)

      expect(mockFn).toHaveBeenCalled()
      const legacyApi = mockFn.mock.calls[0][0]
      expect(legacyApi.registry).toBeDefined()
      expect(legacyApi.zones).toBe(ctx.zones)
      expect(legacyApi.ctx).toBe(ctx)
    })

    it('legacy registry.addRoutes delegates to ctx.routes', async () => {
      function initFn({ registry }) {
        registry.addRoutes('users', [{ path: '' }], {})
      }
      loader.add(initFn)

      const ctx = {
        routes: vi.fn().mockReturnThis(),
        navItem: vi.fn().mockReturnThis(),
        routeFamily: vi.fn().mockReturnThis(),
        zones: {},
      }

      const module = loader._registered.get('initFn')
      await module.connect(ctx)

      expect(ctx.routes).toHaveBeenCalledWith('users', [{ path: '' }], {})
    })
  })

  describe('topological sort', () => {
    let loader

    beforeEach(() => {
      loader = new ModuleLoader()
    })

    it('sorts modules without dependencies', async () => {
      loader.add({ name: 'a', connect() {} })
      loader.add({ name: 'b', connect() {} })
      loader.add({ name: 'c', connect() {} })

      await loader.loadAll({})
      expect(loader._loadOrder.length).toBe(3)
    })

    it('respects requires dependencies', async () => {
      const order = []
      loader.add({
        name: 'child',
        requires: ['parent'],
        connect() {
          order.push('child')
        },
      })
      loader.add({
        name: 'parent',
        connect() {
          order.push('parent')
        },
      })

      await loader.loadAll({})
      expect(order).toEqual(['parent', 'child'])
    })

    it('handles complex dependency graph', async () => {
      const order = []
      // a -> b -> d
      // a -> c -> d
      loader.add({
        name: 'd',
        requires: ['b', 'c'],
        connect() {
          order.push('d')
        },
      })
      loader.add({
        name: 'b',
        requires: ['a'],
        connect() {
          order.push('b')
        },
      })
      loader.add({
        name: 'c',
        requires: ['a'],
        connect() {
          order.push('c')
        },
      })
      loader.add({
        name: 'a',
        connect() {
          order.push('a')
        },
      })

      await loader.loadAll({})

      // a must come before b and c, which must come before d
      expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
      expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'))
      expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'))
      expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'))
    })

    it('respects priority for modules without dependencies', async () => {
      const order = []
      loader.add({
        name: 'low',
        priority: 100,
        connect() {
          order.push('low')
        },
      })
      loader.add({
        name: 'high',
        priority: 0,
        connect() {
          order.push('high')
        },
      })
      loader.add({
        name: 'medium',
        priority: 50,
        connect() {
          order.push('medium')
        },
      })

      await loader.loadAll({})
      expect(order).toEqual(['high', 'medium', 'low'])
    })

    it('respects priority within same dependency level', async () => {
      const order = []
      loader.add({
        name: 'root',
        connect() {
          order.push('root')
        },
      })
      loader.add({
        name: 'childLow',
        requires: ['root'],
        priority: 100,
        connect() {
          order.push('childLow')
        },
      })
      loader.add({
        name: 'childHigh',
        requires: ['root'],
        priority: 0,
        connect() {
          order.push('childHigh')
        },
      })

      await loader.loadAll({})
      expect(order).toEqual(['root', 'childHigh', 'childLow'])
    })
  })

  describe('error handling', () => {
    let loader

    beforeEach(() => {
      loader = new ModuleLoader()
    })

    describe('ModuleNotFoundError', () => {
      it('thrown when required module not registered', async () => {
        loader.add({ name: 'child', requires: ['missing'], connect() {} })

        await expect(loader.loadAll({})).rejects.toThrow(ModuleNotFoundError)
      })

      it('contains module name and requiredBy', async () => {
        loader.add({ name: 'child', requires: ['missing'], connect() {} })

        try {
          await loader.loadAll({})
        } catch (err) {
          expect(err).toBeInstanceOf(ModuleNotFoundError)
          expect(err.moduleName).toBe('missing')
          expect(err.requiredBy).toBe('child')
          expect(err.message).toContain('missing')
          expect(err.message).toContain('child')
        }
      })
    })

    describe('CircularDependencyError', () => {
      it('thrown on direct circular dependency', async () => {
        loader.add({ name: 'a', requires: ['b'], connect() {} })
        loader.add({ name: 'b', requires: ['a'], connect() {} })

        await expect(loader.loadAll({})).rejects.toThrow(CircularDependencyError)
      })

      it('thrown on indirect circular dependency', async () => {
        loader.add({ name: 'a', requires: ['b'], connect() {} })
        loader.add({ name: 'b', requires: ['c'], connect() {} })
        loader.add({ name: 'c', requires: ['a'], connect() {} })

        await expect(loader.loadAll({})).rejects.toThrow(CircularDependencyError)
      })

      it('contains cycle path', async () => {
        loader.add({ name: 'a', requires: ['b'], connect() {} })
        loader.add({ name: 'b', requires: ['a'], connect() {} })

        try {
          await loader.loadAll({})
        } catch (err) {
          expect(err).toBeInstanceOf(CircularDependencyError)
          expect(err.cycle).toBeDefined()
          expect(err.cycle.length).toBeGreaterThan(1)
          expect(err.message).toContain('→')
        }
      })
    })

    describe('ModuleLoadError', () => {
      it('thrown when connect() fails', async () => {
        loader.add({
          name: 'failing',
          connect() {
            throw new Error('Connection failed')
          },
        })

        await expect(loader.loadAll({})).rejects.toThrow(ModuleLoadError)
      })

      it('contains module name and cause', async () => {
        const originalError = new Error('Connection failed')
        loader.add({
          name: 'failing',
          connect() {
            throw originalError
          },
        })

        try {
          await loader.loadAll({})
        } catch (err) {
          expect(err).toBeInstanceOf(ModuleLoadError)
          expect(err.moduleName).toBe('failing')
          expect(err.cause).toBe(originalError)
          expect(err.message).toContain('failing')
          expect(err.message).toContain('Connection failed')
        }
      })
    })
  })

  describe('loadAll()', () => {
    let loader

    beforeEach(() => {
      loader = new ModuleLoader()
    })

    it('passes context to connect()', async () => {
      const connectFn = vi.fn()
      loader.add({ name: 'test', connect: connectFn })

      const ctx = { foo: 'bar' }
      await loader.loadAll(ctx)

      expect(connectFn).toHaveBeenCalledWith(ctx)
    })

    it('skips disabled modules', async () => {
      const connectFn = vi.fn()
      loader.add({
        name: 'disabled',
        enabled: () => false,
        connect: connectFn,
      })

      await loader.loadAll({})
      expect(connectFn).not.toHaveBeenCalled()
    })

    it('tracks loaded modules', async () => {
      loader.add({ name: 'a', connect() {} })
      loader.add({ name: 'b', connect() {} })

      await loader.loadAll({})

      const modules = loader.getModules()
      expect(modules.size).toBe(2)
      expect(modules.has('a')).toBe(true)
      expect(modules.has('b')).toBe(true)
    })

    it('does not track disabled modules', async () => {
      loader.add({ name: 'enabled', connect() {} })
      loader.add({ name: 'disabled', enabled: false, connect() {} })

      await loader.loadAll({})

      const modules = loader.getModules()
      expect(modules.size).toBe(1)
      expect(modules.has('enabled')).toBe(true)
      expect(modules.has('disabled')).toBe(false)
    })
  })

  describe('unloadAll()', () => {
    let loader

    beforeEach(() => {
      loader = new ModuleLoader()
    })

    it('calls disconnect on all loaded modules', async () => {
      const disconnectA = vi.fn()
      const disconnectB = vi.fn()

      loader.add({ name: 'a', connect() {}, disconnect: disconnectA })
      loader.add({ name: 'b', connect() {}, disconnect: disconnectB })

      await loader.loadAll({})
      await loader.unloadAll()

      expect(disconnectA).toHaveBeenCalled()
      expect(disconnectB).toHaveBeenCalled()
    })

    it('unloads in reverse order', async () => {
      const order = []

      loader.add({
        name: 'first',
        connect() {},
        disconnect() {
          order.push('first')
        },
      })
      loader.add({
        name: 'second',
        requires: ['first'],
        connect() {},
        disconnect() {
          order.push('second')
        },
      })

      await loader.loadAll({})
      await loader.unloadAll()

      expect(order).toEqual(['second', 'first'])
    })

    it('clears loaded modules after unload', async () => {
      loader.add({ name: 'test', connect() {} })

      await loader.loadAll({})
      expect(loader.getModules().size).toBe(1)

      await loader.unloadAll()
      expect(loader.getModules().size).toBe(0)
    })
  })

  describe('getModules()', () => {
    let loader

    beforeEach(() => {
      loader = new ModuleLoader()
    })

    it('returns empty map before loading', () => {
      const modules = loader.getModules()
      expect(modules).toBeInstanceOf(Map)
      expect(modules.size).toBe(0)
    })

    it('returns copy of loaded modules', async () => {
      loader.add({ name: 'test', connect() {} })
      await loader.loadAll({})

      const modules = loader.getModules()
      modules.set('fake', {})

      expect(loader.getModules().has('fake')).toBe(false)
    })
  })

  describe('Module class integration', () => {
    let loader

    beforeEach(() => {
      loader = new ModuleLoader()
    })

    it('works with full Module subclass', async () => {
      class UsersModule extends Module {
        static name = 'users'
        static requires = []
        static priority = 10

        enabled(ctx) {
          return ctx.isDev !== false
        }

        async connect(ctx) {
          this.ctx = ctx
        }

        async disconnect() {
          this.ctx = null
        }
      }

      loader.add(UsersModule)
      await loader.loadAll({ isDev: true })

      const modules = loader.getModules()
      expect(modules.has('users')).toBe(true)
      expect(modules.get('users').ctx).toEqual({ isDev: true })
    })

    it('reads static properties from Module class', async () => {
      const order = []

      class ConfigModule extends Module {
        async connect() {
          order.push('config')
        }
      }
      Object.defineProperty(ConfigModule, 'name', { value: 'config', writable: true })

      class AuthModule extends Module {
        async connect() {
          order.push('auth')
        }
      }
      Object.defineProperty(AuthModule, 'name', { value: 'auth', writable: true })
      AuthModule.requires = ['config']
      AuthModule.priority = -10

      loader.add(AuthModule)
      loader.add(ConfigModule)

      await loader.loadAll({})
      expect(order).toEqual(['config', 'auth'])
    })
  })
})
