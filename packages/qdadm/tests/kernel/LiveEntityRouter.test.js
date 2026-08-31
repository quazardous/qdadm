/**
 * LiveEntityRouter (#1888 lot C, reported in #1887).
 *
 * Between "a frame lands on the bus" and "the right EntityManager drops its
 * cache" there was nobody. This routes it — but only for entities the APP
 * declared, and never past the front's own security scope.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LiveEntityRouter, createLiveEntityRouter } from '../../src/kernel/LiveEntityRouter'
import { createSignalBus } from '../../src/kernel/SignalBus'
import { EntityManager } from '../../src/entity/EntityManager'

function collect(signals, signal) {
  const seen = []
  signals.on(signal, (event) => seen.push(event.data))
  return seen
}

/** Mimics what SSEBridge puts on the bus for one frame. */
function sseFrame(event, body) {
  return { event, data: body, timestamp: new Date(), lastEventId: '' }
}

const orchestratorWith = (managers) => ({
  has: (name) => name in managers,
  get: (name) => managers[name],
})

describe('LiveEntityRouter', () => {
  let signals

  beforeEach(() => {
    signals = createSignalBus()
  })

  describe('declaration', () => {
    it('routes a declared entity as a remote change', () => {
      const router = createLiveEntityRouter({ signals, entities: ['runs'] })
      const seen = collect(signals, 'entity:data-invalidate')

      expect(router.notify('runs', 'updated', 42)).toBe(true)
      expect(seen).toHaveLength(1)
      expect(seen[0]).toMatchObject({
        entity: 'runs',
        action: 'updated',
        id: 42,
        source: 'remote',
      })
    })

    it('drops an undeclared entity — a stream carries more than entity mutations', () => {
      const router = createLiveEntityRouter({ signals, entities: ['runs'] })
      const seen = collect(signals, 'entity:data-invalidate')

      expect(router.notify('telemetry')).toBe(false)
      expect(seen).toHaveLength(0)
    })

    it('warns once per undeclared entity instead of dropping it in silence', () => {
      const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const router = createLiveEntityRouter({ signals, entities: ['runs'], debug: true })

      router.notify('telemetry')
      router.notify('telemetry')
      router.notify('other')

      const warnings = debug.mock.calls.filter((c) => String(c[1]).includes('not declared'))
      expect(warnings).toHaveLength(2) // one per entity, not one per frame
      debug.mockRestore()
    })

    it('accepts every entity when declared with true or "*"', () => {
      for (const declaration of [true, '*']) {
        const bus = createSignalBus()
        const router = createLiveEntityRouter({ signals: bus, entities: declaration })
        expect(router.notify('anything')).toBe(true)
      }
    })
  })

  describe('the security scope is the front\'s', () => {
    it('drops an event for an entity the user cannot read', () => {
      const router = createLiveEntityRouter({
        signals,
        entities: true,
        orchestrator: orchestratorWith({ payroll: { canRead: () => false } }),
      })
      const seen = collect(signals, 'entity:data-invalidate')

      expect(router.notify('payroll')).toBe(false)
      expect(seen).toHaveLength(0)
    })

    it('routes it when the user can read', () => {
      const router = createLiveEntityRouter({
        signals,
        entities: true,
        orchestrator: orchestratorWith({ runs: { canRead: () => true } }),
      })

      expect(router.notify('runs')).toBe(true)
    })

    it('drops an event naming a manager that is not registered', () => {
      const router = createLiveEntityRouter({
        signals,
        entities: true,
        orchestrator: orchestratorWith({}),
      })

      expect(router.notify('ghosts')).toBe(false)
    })
  })

  describe('transport', () => {
    it('routes the frames SSEBridge publishes', () => {
      const router = createLiveEntityRouter({ signals, entities: ['runs'] })
      router.attachSignalTransport()
      const seen = collect(signals, 'entity:data-invalidate')

      signals.emit('sse:entity:updated', sseFrame('entity:updated', { entity: 'runs', id: 7 }))

      expect(seen).toHaveLength(1)
      expect(seen[0]).toMatchObject({ entity: 'runs', id: 7, action: 'updated', source: 'remote' })
    })

    it('derives the action from the event name', () => {
      const router = createLiveEntityRouter({ signals, entities: true })
      router.attachSignalTransport()
      const seen = collect(signals, 'entity:data-invalidate')

      signals.emit('sse:entity:created', sseFrame('entity:created', { entity: 'runs' }))
      signals.emit('sse:entity:deleted', sseFrame('entity:deleted', { entity: 'runs' }))

      expect(seen.map((s) => s.action)).toEqual(['created', 'deleted'])
    })

    it('ignores a frame with no entity', () => {
      const router = createLiveEntityRouter({ signals, entities: true })
      router.attachSignalTransport()
      const seen = collect(signals, 'entity:data-invalidate')

      signals.emit('sse:entity:updated', sseFrame('entity:updated', { progress: 0.5 }))

      expect(seen).toHaveLength(0)
    })

    it('stops routing after destroy()', () => {
      const router = createLiveEntityRouter({ signals, entities: true })
      router.attachSignalTransport()
      const seen = collect(signals, 'entity:data-invalidate')

      router.destroy()
      signals.emit('sse:entity:updated', sseFrame('entity:updated', { entity: 'runs' }))

      expect(seen).toHaveLength(0)
    })

    it('accepts a bare payload — a non-SSE transport should not fake the wrapper', () => {
      const router = createLiveEntityRouter({ signals, entities: true })
      router.attachSignalTransport()
      const seen = collect(signals, 'entity:data-invalidate')

      signals.emit('sse:entity:updated', { entity: 'runs' })

      expect(seen).toHaveLength(1)
    })
  })

  it('end to end: a pushed frame drops the manager list cache', async () => {
    class CountingStorage {
      static capabilities = { supportsTotal: true, supportsPagination: true, supportsCaching: true }
      constructor() {
        this.listCallCount = 0
      }
      async list() {
        this.listCallCount++
        return { items: [{ id: 1 }], total: 1 }
      }
      async get() {
        return null
      }
    }

    const storage = new CountingStorage()
    const manager = new EntityManager({ name: 'runs', storage })
    manager.setSignals(signals)

    const router = new LiveEntityRouter({ signals, entities: ['runs'] })
    router.attachSignalTransport()

    await manager.list()
    await manager.list()
    expect(storage.listCallCount).toBe(1)

    signals.emit('sse:entity:updated', sseFrame('entity:updated', { entity: 'runs' }))

    await manager.list()
    expect(storage.listCallCount).toBe(2)
  })
})
