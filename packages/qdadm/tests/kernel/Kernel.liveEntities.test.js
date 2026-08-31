/**
 * Kernel wiring for live entities (#1888 lot C).
 *
 * The LiveEntityRouter tests prove the routing; this proves the kernel builds
 * one from `sse.entities` at all — the seam between config and behaviour, and
 * the place where a feature silently fails to exist.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { Kernel } from '../../src/kernel/Kernel'
import { EntityManager } from '../../src/entity/EntityManager'

class FakeEventSource {
  constructor(url) {
    this.url = url
  }
  addEventListener() {}
  close() {}
}

function makeKernel(sse) {
  const kernel = new Kernel({ root: {}, moduleDefs: [], sse })
  // The bridge needs the signal bus and the orchestrator; build just those
  // rather than the whole app, so the test stays about the wiring.
  kernel._createSignalBus()
  kernel._createOrchestrator()
  return kernel
}

describe('Kernel — live entity wiring', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds no router when sse declares no entities', () => {
    const kernel = makeKernel({ url: '/events' })
    kernel._createSSEBridge()

    expect(kernel.sseBridge).not.toBeNull()
    expect(kernel.liveEntityRouter).toBeNull()
  })

  it('builds a router from the declaration', () => {
    const kernel = makeKernel({ url: '/events', entities: ['runs'] })
    kernel._createSSEBridge()

    expect(kernel.liveEntityRouter).not.toBeNull()
    expect(kernel.liveEntityRouter.isDeclared('runs')).toBe(true)
    expect(kernel.liveEntityRouter.isDeclared('jobs')).toBe(false)
  })

  it('accepts every entity when declared with true', () => {
    const kernel = makeKernel({ url: '/events', entities: true })
    kernel._createSSEBridge()

    expect(kernel.liveEntityRouter.isDeclared('anything')).toBe(true)
  })

  it('builds nothing at all without an sse url', () => {
    const kernel = makeKernel(undefined)
    kernel._createSSEBridge()

    expect(kernel.sseBridge).toBeNull()
    expect(kernel.liveEntityRouter).toBeNull()
  })

  it('drops a frame naming an entity no manager is registered for', () => {
    const kernel = makeKernel({ url: '/events', entities: ['runs'] })
    kernel._createSSEBridge()

    const seen = []
    kernel.signals.on('entity:data-invalidate', (event) => seen.push(event.data))

    kernel.signals.emit('sse:entity:updated', {
      event: 'entity:updated',
      data: { entity: 'runs', id: 3 },
    })

    // Declared but unknown: there is no cache to invalidate, and inventing one
    // would hide a real misconfiguration.
    expect(seen).toHaveLength(0)
  })

  it('does not throw when the declared entity has no manager', () => {
    // Orchestrator.get() throws on an unknown name by design. A typo in
    // sse.entities, or a module not yet loaded, must drop the event — not
    // raise inside the signal bus on every frame the backend sends.
    const kernel = makeKernel({ url: '/events', entities: ['typo'] })
    kernel._createSSEBridge()

    expect(() => kernel.liveEntityRouter.notify('typo')).not.toThrow()
    expect(kernel.liveEntityRouter.notify('typo')).toBe(false)
  })

  it('routes a frame end to end, from the bus to an invalidation', () => {
    const kernel = makeKernel({ url: '/events', entities: ['runs'] })
    kernel.orchestrator.register('runs', new EntityManager({ name: 'runs' }))
    kernel._createSSEBridge()

    const seen = []
    kernel.signals.on('entity:data-invalidate', (event) => seen.push(event.data))

    kernel.signals.emit('sse:entity:updated', {
      event: 'entity:updated',
      data: { entity: 'runs', id: 3 },
    })

    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ entity: 'runs', id: 3, source: 'remote' })
  })
})
