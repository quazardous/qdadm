/**
 * What survives a reconnect (#1899 follow-up).
 *
 * A consumer deduced from the code that named event listeners are lost on
 * every reconnect, then measured that their events kept arriving — and said
 * plainly that they could not explain how. On a stream that reconnects every
 * minute, an unexplained "it works anyway" is worth resolving: either the
 * deduction is wrong, or the mechanism is accidental.
 *
 * These tests answer it for the bridge in isolation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SSEBridge } from '../SSEBridge'
import { createSignalBus } from '../../signal/SignalBus'

class FakeEventSource {
  static instances: FakeEventSource[] = []
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  listeners: Record<string, Array<(e: MessageEvent) => void>> = {}
  closed = false

  constructor(public url: string) {
    FakeEventSource.instances.push(this)
  }

  addEventListener(name: string, fn: (e: MessageEvent) => void): void {
    ;(this.listeners[name] ??= []).push(fn)
  }

  close(): void {
    this.closed = true
  }

  /** Deliver a named SSE event, as a server would. */
  emitNamed(name: string, data: unknown): void {
    for (const fn of this.listeners[name] ?? []) {
      fn({ data: JSON.stringify(data), lastEventId: '' } as MessageEvent)
    }
  }

  /** Deliver an unnamed event — the `message` channel. */
  emitMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data), lastEventId: '' } as MessageEvent)
  }
}

function makeBridge(signals = createSignalBus()) {
  return {
    signals,
    bridge: new SSEBridge({
      signals,
      url: '/events',
      autoConnect: false,
      connectOnSignal: null,
      disconnectOnSignal: null,
      reconnectDelay: 0,
    }),
  }
}

describe('SSEBridge — what survives a reconnect', () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
    vi.stubGlobal('window', { location: { origin: 'https://app.example' } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('routes a named event once registered', async () => {
    const { signals, bridge } = makeBridge()
    const seen: unknown[] = []
    signals.on('sse:entity:updated', (e: { data: unknown }) => seen.push(e.data))

    await bridge.connect()
    bridge.registerEvents(['entity:updated'])
    FakeEventSource.instances[0]!.emitNamed('entity:updated', { entity: 'runs' })

    expect(seen).toHaveLength(1)
  })

  it('keeps named listeners across a reconnect — the bridge re-attaches them', async () => {
    // Was the defect (#1898 lot F): listeners live on an EventSource instance
    // and every reconnect builds a new one, so the named channel died after
    // the first drop. Silently — the stream stayed connected and unnamed
    // events kept flowing, which is exactly why nobody noticed.
    const { signals, bridge } = makeBridge()
    const seen: unknown[] = []
    signals.on('sse:entity:updated', (e: { data: unknown }) => seen.push(e.data))

    await bridge.connect()
    bridge.registerEvents(['entity:updated'])

    // Reconnect, as happens on every transient drop.
    await bridge.connect()
    expect(FakeEventSource.instances).toHaveLength(2)

    const fresh = FakeEventSource.instances[1]!
    fresh.emitNamed('entity:updated', { entity: 'runs' })

    expect(fresh.listeners['entity:updated']).toHaveLength(1)
    expect(seen).toHaveLength(1)
  })

  it('survives many reconnects, and binds each name exactly once per connection', async () => {
    const { signals, bridge } = makeBridge()
    const seen: unknown[] = []
    signals.on('sse:entity:updated', (e: { data: unknown }) => seen.push(e.data))

    await bridge.connect()
    bridge.registerEvents(['entity:updated'])
    for (let i = 0; i < 5; i++) await bridge.connect()

    const last = FakeEventSource.instances.at(-1)!
    // One listener, not six: a duplicated binding would deliver the same event
    // several times and look like a burst from the server.
    expect(last.listeners['entity:updated']).toHaveLength(1)

    last.emitNamed('entity:updated', { entity: 'runs' })
    expect(seen).toHaveLength(1)
  })

  it('accepts registration BEFORE the first connection', async () => {
    const { signals, bridge } = makeBridge()
    const seen: unknown[] = []
    signals.on('sse:entity:updated', (e: { data: unknown }) => seen.push(e.data))

    // Registering while disconnected used to be a silent no-op.
    bridge.registerEvents(['entity:updated'])
    await bridge.connect()

    FakeEventSource.instances[0]!.emitNamed('entity:updated', { entity: 'runs' })
    expect(seen).toHaveLength(1)
  })

  it('does not double-bind when the same name is registered twice', async () => {
    const { signals, bridge } = makeBridge()
    const seen: unknown[] = []
    signals.on('sse:entity:updated', (e: { data: unknown }) => seen.push(e.data))

    await bridge.connect()
    bridge.registerEvents(['entity:updated'])
    bridge.registerEvents(['entity:updated', 'entity:deleted'])

    FakeEventSource.instances[0]!.emitNamed('entity:updated', { entity: 'runs' })
    expect(seen).toHaveLength(1)
  })

  it('keeps routing UNNAMED events across reconnects — onmessage is re-attached', async () => {
    const { signals, bridge } = makeBridge()
    const seen: unknown[] = []
    signals.on('sse:message', (e: { data: unknown }) => seen.push(e.data))

    await bridge.connect()
    await bridge.connect()
    FakeEventSource.instances[1]!.emitMessage({ entity: 'runs' })

    // connect() sets onmessage every time, so this channel survives — which is
    // how a stream can look alive while its named events are gone.
    expect(seen).toHaveLength(1)
  })

  it('re-registering after each connect restores the named channel', async () => {
    const { signals, bridge } = makeBridge()
    const seen: unknown[] = []
    signals.on('sse:entity:updated', (e: { data: unknown }) => seen.push(e.data))

    await bridge.connect()
    bridge.registerEvents(['entity:updated'])
    await bridge.connect()
    bridge.registerEvents(['entity:updated'])

    FakeEventSource.instances[1]!.emitNamed('entity:updated', { entity: 'runs' })

    expect(seen).toHaveLength(1)
  })
})
