/**
 * SSEBridge — async token resolution (#1888 lot A).
 *
 * EventSource takes no headers, so the token rides in the query string. An app
 * that refuses to leak a durable credential into access logs serves a
 * short-lived ticket instead, which means fetching one per connect — hence an
 * async `getToken`, and hence the supersede window these tests pin down.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SSEBridge } from '../SSEBridge'
import { createSignalBus } from '../../signal/SignalBus'

class FakeEventSource {
  static instances: FakeEventSource[] = []
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  closed = false

  constructor(public url: string) {
    FakeEventSource.instances.push(this)
  }

  addEventListener(): void {}
  close(): void {
    this.closed = true
  }
}

function tokenParamOf(url: string): string | null {
  return new URL(url).searchParams.get('token')
}

describe('SSEBridge — async getToken', () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
    vi.stubGlobal('window', { location: { origin: 'https://admin.example' } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const make = (getToken: SSEBridge['_getToken'] extends never ? never : unknown): SSEBridge =>
    new SSEBridge({
      signals: createSignalBus(),
      url: '/events',
      autoConnect: false,
      connectOnSignal: null,
      disconnectOnSignal: null,
      reconnectDelay: 0,
      getToken: getToken as () => string | null,
    })

  it('still accepts a synchronous getToken (no consumer breaks)', async () => {
    const bridge = make(() => 'sync-token')
    await bridge.connect()

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(tokenParamOf(FakeEventSource.instances[0].url)).toBe('sync-token')
  })

  it('awaits a promise-returning getToken before opening the connection', async () => {
    const bridge = make(async () => {
      await Promise.resolve()
      return 'ticket-abc'
    })
    await bridge.connect()

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(tokenParamOf(FakeEventSource.instances[0].url)).toBe('ticket-abc')
  })

  it('fetches a fresh ticket on every connect — that is the whole point', async () => {
    let issued = 0
    const bridge = make(async () => `ticket-${++issued}`)

    await bridge.connect()
    await bridge.connect()

    expect(FakeEventSource.instances.map((es) => tokenParamOf(es.url))).toEqual([
      'ticket-1',
      'ticket-2',
    ])
  })

  it('omits the query param when getToken resolves to null', async () => {
    const bridge = make(async () => null)
    await bridge.connect()

    expect(tokenParamOf(FakeEventSource.instances[0].url)).toBeNull()
  })

  it('does not open a connection when disconnect() lands while the token resolves', async () => {
    let release: (v: string) => void = () => {}
    const bridge = make(() => new Promise<string>((r) => (release = r)))

    const pending = bridge.connect()
    bridge.disconnect() // user logged out while the ticket was in flight
    release('too-late')
    await pending

    expect(FakeEventSource.instances).toHaveLength(0)
  })

  it('keeps only the newest connection when two connects overlap', async () => {
    const releases: ((v: string) => void)[] = []
    const bridge = make(() => new Promise<string>((r) => releases.push(r)))

    const first = bridge.connect()
    const second = bridge.connect()

    releases[0]('stale')
    releases[1]('fresh')
    await Promise.all([first, second])

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(tokenParamOf(FakeEventSource.instances[0].url)).toBe('fresh')
  })

  it('reports a rejected token fetch as a connection error', async () => {
    const signals = createSignalBus()
    const errors: unknown[] = []
    signals.on('sse:error', (e: { data: unknown }) => errors.push(e.data))

    const bridge = new SSEBridge({
      signals,
      url: '/events',
      autoConnect: false,
      connectOnSignal: null,
      disconnectOnSignal: null,
      reconnectDelay: 0,
      getToken: async () => {
        throw new Error('ticket endpoint down')
      },
    })

    await bridge.connect()

    expect(FakeEventSource.instances).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect((errors[0] as { error: string }).error).toBe('ticket endpoint down')
  })

  it('stays quiet when a superseded connect fails to get its token', async () => {
    const signals = createSignalBus()
    const errors: unknown[] = []
    signals.on('sse:error', (e: unknown) => errors.push(e))

    let reject: (e: Error) => void = () => {}
    const bridge = new SSEBridge({
      signals,
      url: '/events',
      autoConnect: false,
      connectOnSignal: null,
      disconnectOnSignal: null,
      reconnectDelay: 0,
      getToken: () => new Promise<string>((_, rj) => (reject = rj)),
    })

    const pending = bridge.connect()
    bridge.disconnect()
    reject(new Error('irrelevant now'))
    await pending

    expect(errors).toHaveLength(0)
  })
})
