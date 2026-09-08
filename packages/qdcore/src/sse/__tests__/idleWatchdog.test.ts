/**
 * Silence is the only signal that did not lie (#2138).
 *
 * Measured on a proxy bench in #1899: after the socket was cut, `EventSource`
 * kept reporting `readyState` OPEN with no `error` ever firing, and a `fetch`
 * reader's `read()` never resolved either. Neither API noticed. Time since the
 * last sign of life caught it, 10.1 s after the last frame on a 10 s budget.
 *
 * These pin the watchdog on both transports — including the asymmetry, which
 * is the part someone will otherwise trip over.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { EventSourceTransport } from '../transport'
import { FetchTransport } from '../FetchTransport'
import type { StreamHandlers } from '../transport'

function collector() {
  const errors: unknown[] = []
  const frames: unknown[] = []
  return {
    errors,
    frames,
    handlers: {
      onOpen: () => {},
      onFrame: (f) => frames.push(f),
      onError: (e) => errors.push(e),
    } satisfies StreamHandlers,
  }
}

/** A minimal stand-in for the browser's EventSource. */
class FakeEventSource {
  static instances: FakeEventSource[] = []
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  closed = false
  constructor() {
    FakeEventSource.instances.push(this)
  }
  addEventListener(): void {}
  close(): void {
    this.closed = true
  }
  emit(data: string): void {
    this.onmessage?.({ data, lastEventId: '' } as MessageEvent)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  FakeEventSource.instances = []
})

describe('EventSourceTransport — the watchdog and its limit', () => {
  it('stays silent when no budget is asked for', async () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    const c = collector()
    const t = new EventSourceTransport()
    t.open('/events', { withCredentials: false, eventNames: [] }, c.handlers)
    FakeEventSource.instances[0]!.onopen?.()
    await new Promise((r) => setTimeout(r, 60))

    expect(c.errors).toHaveLength(0)
    t.close()
  })

  it('calls a silent stream dead — the failure EventSource cannot report', async () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    const c = collector()
    const t = new EventSourceTransport()
    t.open('/events', { withCredentials: false, eventNames: [], idleTimeout: 40 }, c.handlers)
    FakeEventSource.instances[0]!.onopen?.()
    await new Promise((r) => setTimeout(r, 90))

    expect(String(c.errors[0])).toContain('No frame for 40ms')
    // And it closes the source, so nothing lingers claiming to be OPEN.
    expect(FakeEventSource.instances[0]!.closed).toBe(true)
  })

  it('a data frame pushes the deadline back', async () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    const c = collector()
    const t = new EventSourceTransport()
    t.open('/events', { withCredentials: false, eventNames: [], idleTimeout: 60 }, c.handlers)
    const source = FakeEventSource.instances[0]!
    source.onopen?.()
    await new Promise((r) => setTimeout(r, 40))
    source.emit('still here')
    await new Promise((r) => setTimeout(r, 40))

    expect(c.errors).toHaveLength(0)
    t.close()
  })

  it('closing disarms it — a deliberate stop is not a death', async () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    const c = collector()
    const t = new EventSourceTransport()
    t.open('/events', { withCredentials: false, eventNames: [], idleTimeout: 30 }, c.handlers)
    FakeEventSource.instances[0]!.onopen?.()
    t.close()
    await new Promise((r) => setTimeout(r, 70))

    expect(c.errors).toHaveLength(0)
  })
})

describe('the asymmetry between the two transports', () => {
  it('EventSource CANNOT see a heartbeat, so a comment does not save it', async () => {
    // This is the limit worth knowing: the browser eats comment lines, so a
    // server heartbeat never becomes an event here. The budget must be set
    // against how often real DATA arrives, not against the heartbeat.
    vi.stubGlobal('EventSource', FakeEventSource)
    const c = collector()
    const t = new EventSourceTransport()
    t.open('/events', { withCredentials: false, eventNames: [], idleTimeout: 40 }, c.handlers)
    FakeEventSource.instances[0]!.onopen?.()
    // A real server heartbeat happens here — invisible, by construction.
    await new Promise((r) => setTimeout(r, 90))

    expect(c.errors).toHaveLength(1)
  })

  it('FetchTransport DOES see a heartbeat, because it reads the wire', async () => {
    const encoder = new TextEncoder()
    let sent = false
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      status: 200,
      body: new ReadableStream({
        async pull(controller) {
          if (!sent) {
            sent = true
            controller.enqueue(encoder.encode(': heartbeat\n\n'))
            return
          }
          return new Promise(() => {})
        },
      }),
    }))
    const c = collector()
    const t = new FetchTransport()
    t.open('/events', { withCredentials: false, eventNames: [], idleTimeout: 60 }, c.handlers)
    await new Promise((r) => setTimeout(r, 40))

    // The comment delivered no frame and still proved the stream alive.
    expect(c.frames).toHaveLength(0)
    expect(c.errors).toHaveLength(0)
    t.close()
  })
})

describe('SSEBridge passes the budget down', () => {
  // _buildUrl resolves against window.location.origin, and this suite runs
  // in node.
  const withWindow = (): void => {
    vi.stubGlobal('window', { location: { origin: 'https://app.example' } })
  }

  it('hands idleTimeout to whatever transport it was given', async () => {
    withWindow()
    const { SSEBridge } = await import('../SSEBridge')
    const { createSignalBus } = await import('../../signal')
    let seen: number | undefined = -1
    const spy = {
      name: 'spy',
      open: (_u: string, o: { idleTimeout?: number }) => { seen = o.idleTimeout },
      addEventName: () => {},
      close: () => {},
    }

    const bridge = new SSEBridge({
      signals: createSignalBus({}),
      url: '/events',
      transport: spy,
      idleTimeout: 7000,
    })
    await bridge.connect()

    expect(seen).toBe(7000)
  })

  it('is off unless asked for — the budget depends on the server', async () => {
    withWindow()
    const { SSEBridge } = await import('../SSEBridge')
    const { createSignalBus } = await import('../../signal')
    let seen: number | undefined = -1
    const spy = {
      name: 'spy',
      open: (_u: string, o: { idleTimeout?: number }) => { seen = o.idleTimeout },
      addEventName: () => {},
      close: () => {},
    }

    const bridge = new SSEBridge({ signals: createSignalBus({}), url: '/events', transport: spy })
    await bridge.connect()

    expect(seen).toBe(0)
  })
})
