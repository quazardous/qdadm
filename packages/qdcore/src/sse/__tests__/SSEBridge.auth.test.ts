/**
 * Reconnecting across sessions, and keeping the token out of the logs
 * (#1898 lots B and E).
 *
 * Both come from a consumer's production incident: a stream that never came
 * back after a second login, and a durable credential written in clear where
 * anything capturing logs could keep it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SSEBridge } from '../SSEBridge'
import { createSignalBus } from '../../signal/SignalBus'

class FakeEventSource {
  static instances: FakeEventSource[] = []
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null

  constructor(public url: string) {
    FakeEventSource.instances.push(this)
  }
  addEventListener(): void {}
  close(): void {}
  /** Let the bridge believe the connection opened. */
  open(): void {
    this.onopen?.()
  }
}

describe('SSEBridge — auth coupling and log hygiene', () => {
  let signals: ReturnType<typeof createSignalBus>

  beforeEach(() => {
    FakeEventSource.instances = []
    signals = createSignalBus()
    vi.stubGlobal('EventSource', FakeEventSource)
    vi.stubGlobal('window', { location: { origin: 'https://admin.example' } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function makeBridge(overrides = {}) {
    return new SSEBridge({
      signals,
      url: '/events',
      autoConnect: false,
      reconnectDelay: 0,
      getToken: () => 'super-secret-token',
      ...overrides,
    })
  }

  describe('lot B — a second login reconnects', () => {
    it('connects again after logout and login', async () => {
      const bridge = makeBridge()

      signals.emit('auth:login')
      await Promise.resolve()
      await Promise.resolve()
      FakeEventSource.instances[0]?.open()
      expect(FakeEventSource.instances).toHaveLength(1)

      bridge.disconnect()

      // Was the bug: connectOnSignal used once(), so this did nothing and the
      // stream stayed dead for the rest of the session.
      signals.emit('auth:login')
      await Promise.resolve()
      await Promise.resolve()

      expect(FakeEventSource.instances.length).toBeGreaterThanOrEqual(2)
    })

    it('does not stack connections when already connected', async () => {
      makeBridge()

      signals.emit('auth:login')
      await Promise.resolve()
      await Promise.resolve()
      FakeEventSource.instances[0]?.open()

      // A duplicate login signal must not open a second stream alongside.
      signals.emit('auth:login')
      await Promise.resolve()
      await Promise.resolve()

      expect(FakeEventSource.instances).toHaveLength(1)
    })
  })

  describe('lot E — the token never reaches a log', () => {
    it('redacts the token parameter when logging the URL', async () => {
      const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const bridge = makeBridge({ debug: true, tokenParam: 'ticket' })

      await bridge.connect()

      const logged = debug.mock.calls.map((c) => c.join(' ')).join('\n')
      expect(logged).toContain('Connecting to')
      expect(logged).not.toContain('super-secret-token')
      expect(logged).toContain('ticket=REDACTED')
      // The rest of the URL stays readable, or the log is useless.
      expect(logged).toContain('/events')

      // Only the LOG is redacted — the real connection still carries it.
      expect(FakeEventSource.instances[0]!.url).toContain('super-secret-token')
      debug.mockRestore()
    })

    it('leaves a URL without a token untouched', async () => {
      const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const bridge = makeBridge({ debug: true, getToken: null })

      await bridge.connect()

      const logged = debug.mock.calls.map((c) => c.join(' ')).join('\n')
      expect(logged).not.toContain('REDACTED')
      debug.mockRestore()
    })
  })
})
