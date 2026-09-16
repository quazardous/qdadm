/**
 * The stream and the subscriptions name the same tab (#2664).
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Kernel } from '../../src/kernel/Kernel'
import { createSignalBus } from '../../src/kernel/SignalBus'
import { withQueryParam } from '../../src/kernel/sseSubscriptions'

function bridgeFor(sse) {
  const kernel = new Kernel({ root: {}, moduleDefs: [], sse })
  kernel.signals = createSignalBus()
  kernel._createSSEBridge()
  return kernel
}

describe('sse.subscriptions', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('puts the tab id the pages subscribe with in the stream URL', () => {
    const kernel = bridgeFor({ url: '/api/events', subscriptions: { url: '/api/events/subscriptions' } })

    const session = kernel.sseSubscriptions.session
    expect(session).toBeTruthy()
    expect(kernel.sseSubscriptions.url).toBe('/api/events/subscriptions')
    expect(kernel.sseBridge._url).toBe(`/api/events?session=${encodeURIComponent(session)}`)
  })

  it('keeps the same tab id across a reload of the tab', () => {
    const first = bridgeFor({ url: '/api/events', subscriptions: { url: '/s' } }).sseSubscriptions.session
    const second = bridgeFor({ url: '/api/events', subscriptions: { url: '/s' } }).sseSubscriptions.session
    expect(second).toBe(first)
  })

  it('uses the parameter name the backend reads', () => {
    const kernel = bridgeFor({ url: '/api/events?x=1', subscriptions: { url: '/s', sessionParam: 'tab' } })
    expect(kernel.sseBridge._url).toBe(`/api/events?x=1&tab=${encodeURIComponent(kernel.sseSubscriptions.session)}`)
  })

  it('changes nothing when absent', () => {
    const kernel = bridgeFor({ url: '/api/events' })
    expect(kernel.sseSubscriptions).toBeNull()
    expect(kernel.sseBridge._url).toBe('/api/events')
  })

  it('is a recognised sse key', () => {
    bridgeFor({ url: '/api/events', subscriptions: { url: '/s' } })
    expect(console.warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('sse.subscriptions'))).toHaveLength(0)
  })

  it('adds the parameter before a fragment', () => {
    expect(withQueryParam('/e#top', 'session', 'a b')).toBe('/e?session=a%20b#top')
  })
})
