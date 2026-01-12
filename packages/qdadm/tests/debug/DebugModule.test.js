/**
 * Unit tests for DebugModule
 *
 * Tests the DebugModule class which integrates debug tools
 * into the Module System v2.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DebugModule, DEBUG_BRIDGE_KEY, DEBUG_ZONE } from '../../src/modules/debug/DebugModule'
import { Module } from '../../src/kernel/Module'
import { DebugBridge } from '../../src/modules/debug/DebugBridge'
import { ErrorCollector } from '../../src/modules/debug/ErrorCollector'
import { SignalCollector } from '../../src/modules/debug/SignalCollector'

// Mock KernelContext for testing
function createMockContext(overrides = {}) {
  const zones = new Map()
  const blocks = new Map()
  const provided = new Map()

  return {
    isDev: false,
    debug: false,
    signals: {
      on: vi.fn(() => vi.fn()) // Returns cleanup function
    },
    zone: vi.fn((name) => {
      zones.set(name, { blocks: [] })
    }),
    block: vi.fn((zoneName, config) => {
      if (!blocks.has(zoneName)) {
        blocks.set(zoneName, [])
      }
      blocks.get(zoneName).push(config)
    }),
    provide: vi.fn((key, value) => {
      provided.set(key, value)
    }),
    component: vi.fn(), // Register global Vue component
    // Test helpers
    _zones: zones,
    _blocks: blocks,
    _provided: provided,
    ...overrides
  }
}

describe('DebugModule', () => {
  let module
  let ctx

  beforeEach(() => {
    module = new DebugModule()
    ctx = createMockContext()
  })

  afterEach(async () => {
    await module.disconnect()
  })

  describe('static properties', () => {
    it('has static moduleName set to "debug"', () => {
      expect(DebugModule.moduleName).toBe('debug')
    })

    it('has empty requires array', () => {
      expect(DebugModule.requires).toEqual([])
    })

    it('has high priority (1000) to run last', () => {
      expect(DebugModule.priority).toBe(1000)
    })
  })

  describe('inheritance', () => {
    it('extends Module base class', () => {
      expect(module).toBeInstanceOf(Module)
    })

    it('has name getter returning "debug"', () => {
      expect(module.name).toBe('debug')
    })
  })

  describe('enabled()', () => {
    it('returns true when ctx.isDev is true', () => {
      const ctx = createMockContext({ isDev: true, debug: false })
      expect(module.enabled(ctx)).toBe(true)
    })

    it('returns true when ctx.debug is true', () => {
      const ctx = createMockContext({ isDev: false, debug: true })
      expect(module.enabled(ctx)).toBe(true)
    })

    it('returns false when both isDev and debug are false', () => {
      const ctx = createMockContext({ isDev: false, debug: false })
      expect(module.enabled(ctx)).toBe(false)
    })

    it('returns true when both isDev and debug are true', () => {
      const ctx = createMockContext({ isDev: true, debug: true })
      expect(module.enabled(ctx)).toBe(true)
    })
  })

  describe('connect()', () => {
    it('stores context reference', async () => {
      await module.connect(ctx)
      expect(module.ctx).toBe(ctx)
    })

    it('creates DebugBridge instance', async () => {
      await module.connect(ctx)
      expect(module.getBridge()).toBeInstanceOf(DebugBridge)
    })

    it('respects enabled option for bridge', async () => {
      module = new DebugModule({ enabled: true })
      await module.connect(ctx)

      expect(module.getBridge().enabled.value).toBe(true)
    })

    it('defaults bridge to disabled', async () => {
      await module.connect(ctx)
      expect(module.getBridge().enabled.value).toBe(false)
    })

    it('registers ErrorCollector by default', async () => {
      await module.connect(ctx)

      const bridge = module.getBridge()
      // DebugBridge uses collector.constructor.name which is the class name
      const collectors = Array.from(bridge.getAllCollectors().values())
      const errorCollector = collectors.find(c => c instanceof ErrorCollector)
      expect(errorCollector).toBeInstanceOf(ErrorCollector)
    })

    it('registers SignalCollector by default', async () => {
      await module.connect(ctx)

      const bridge = module.getBridge()
      // DebugBridge uses collector.constructor.name which is the class name
      const collectors = Array.from(bridge.getAllCollectors().values())
      const signalCollector = collectors.find(c => c instanceof SignalCollector)
      expect(signalCollector).toBeInstanceOf(SignalCollector)
    })

    it('skips ErrorCollector when errorCollector option is false', async () => {
      module = new DebugModule({ errorCollector: false })
      await module.connect(ctx)

      const bridge = module.getBridge()
      const collectors = Array.from(bridge.getAllCollectors().values())
      const errorCollector = collectors.find(c => c instanceof ErrorCollector)
      expect(errorCollector).toBeUndefined()
    })

    it('skips SignalCollector when signalCollector option is false', async () => {
      module = new DebugModule({ signalCollector: false })
      await module.connect(ctx)

      const bridge = module.getBridge()
      const collectors = Array.from(bridge.getAllCollectors().values())
      const signalCollector = collectors.find(c => c instanceof SignalCollector)
      expect(signalCollector).toBeUndefined()
    })

    it('passes maxEntries option to collectors', async () => {
      module = new DebugModule({ maxEntries: 50 })
      await module.connect(ctx)

      const bridge = module.getBridge()
      const collectors = Array.from(bridge.getAllCollectors().values())
      const errorCollector = collectors.find(c => c instanceof ErrorCollector)
      expect(errorCollector.maxEntries).toBe(50)
    })

    it('defines app:debug zone', async () => {
      await module.connect(ctx)

      expect(ctx.zone).toHaveBeenCalledWith(DEBUG_ZONE)
    })

    it('registers DebugBar block in zone', async () => {
      await module.connect(ctx)

      expect(ctx.block).toHaveBeenCalledWith(
        DEBUG_ZONE,
        expect.objectContaining({
          id: 'debug-bar',
          weight: 100,
          props: expect.objectContaining({
            bridge: module.getBridge()
          })
        })
      )
    })

    it('provides debug bridge for injection', async () => {
      await module.connect(ctx)

      expect(ctx.provide).toHaveBeenCalledWith(DEBUG_BRIDGE_KEY, module.getBridge())
    })
  })

  describe('disconnect()', () => {
    it('uninstalls bridge', async () => {
      await module.connect(ctx)
      const bridge = module.getBridge()
      const uninstallSpy = vi.spyOn(bridge, 'uninstall')

      await module.disconnect()

      expect(uninstallSpy).toHaveBeenCalled()
    })

    it('clears bridge reference', async () => {
      await module.connect(ctx)
      expect(module.getBridge()).not.toBeNull()

      await module.disconnect()
      expect(module.getBridge()).toBeNull()
    })

    it('is safe to call multiple times', async () => {
      await module.connect(ctx)

      await expect(module.disconnect()).resolves.not.toThrow()
      await expect(module.disconnect()).resolves.not.toThrow()
    })

    it('is safe to call without connect', async () => {
      await expect(module.disconnect()).resolves.not.toThrow()
    })
  })

  describe('getBridge()', () => {
    it('returns null before connect', () => {
      expect(module.getBridge()).toBeNull()
    })

    it('returns bridge after connect', async () => {
      await module.connect(ctx)
      expect(module.getBridge()).toBeInstanceOf(DebugBridge)
    })

    it('returns null after disconnect', async () => {
      await module.connect(ctx)
      await module.disconnect()
      expect(module.getBridge()).toBeNull()
    })
  })

  describe('constructor options', () => {
    it('accepts all options', () => {
      module = new DebugModule({
        enabled: true,
        maxEntries: 200,
        errorCollector: false,
        signalCollector: false
      })

      expect(module.options.enabled).toBe(true)
      expect(module.options.maxEntries).toBe(200)
      expect(module.options.errorCollector).toBe(false)
      expect(module.options.signalCollector).toBe(false)
    })

    it('defaults options to empty object', () => {
      module = new DebugModule()
      expect(module.options).toEqual({})
    })
  })

  describe('exports', () => {
    it('exports DEBUG_BRIDGE_KEY symbol', () => {
      expect(typeof DEBUG_BRIDGE_KEY).toBe('symbol')
    })

    it('exports DEBUG_ZONE constant', () => {
      expect(DEBUG_ZONE).toBe('_app:debug')
    })
  })
})
