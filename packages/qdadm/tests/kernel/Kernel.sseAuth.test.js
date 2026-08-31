/**
 * Kernel wiring for the stream's auth and config (#1898 lots C and A).
 *
 * Both come from a consumer incident: a stream that only ever connected on a
 * fresh interactive login, and a config key silently ignored while the durable
 * session token went into the URL in its place.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Kernel } from '../../src/kernel/Kernel'

class FakeEventSource {
  static instances = []
  constructor(url) {
    this.url = url
    FakeEventSource.instances.push(this)
  }
  addEventListener() {}
  close() {}
}

function makeKernel(options) {
  const kernel = new Kernel({ root: {}, moduleDefs: [], ...options })
  kernel._createSignalBus()
  kernel._createOrchestrator()
  return kernel
}

const authed = (isAuth) => ({
  isAuthenticated: () => isAuth,
  getToken: () => 'session-token',
})

describe('Kernel — SSE auth wiring (lot C)', () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('connects the stream when the session is already authenticated', async () => {
    // The reported symptom: reloading a page with a valid session left the
    // stream permanently disconnected, because it waited for auth:login —
    // emitted by the login PAGE, which a reload never renders.
    const kernel = makeKernel({ sse: { url: '/events' }, authAdapter: authed(true) })
    kernel._createSSEBridge()
    await new Promise((r) => setTimeout(r, 0))

    expect(FakeEventSource.instances).toHaveLength(1)
  })

  it('does not connect when there is no session', async () => {
    const kernel = makeKernel({ sse: { url: '/events' }, authAdapter: authed(false) })
    kernel._createSSEBridge()
    await new Promise((r) => setTimeout(r, 0))

    expect(FakeEventSource.instances).toHaveLength(0)
  })

  it('leaves an app that opted out of the auth coupling alone', async () => {
    const kernel = makeKernel({
      sse: { url: '/events', connectOnSignal: null },
      authAdapter: authed(true),
    })
    kernel._createSSEBridge()
    await new Promise((r) => setTimeout(r, 0))

    // connectOnSignal: null means "I drive the connection myself".
    expect(FakeEventSource.instances).toHaveLength(0)
  })

  it('does not double-connect when autoConnect already did', async () => {
    const kernel = makeKernel({
      sse: { url: '/events', autoConnect: true },
      authAdapter: authed(true),
    })
    kernel._createSSEBridge()
    await new Promise((r) => setTimeout(r, 0))

    expect(FakeEventSource.instances).toHaveLength(1)
  })
})

describe('Kernel — SSE config validation (lot A)', () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('says what happens INSTEAD, not just that the key was ignored', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // A typo, or a key from a newer version than the installed one — which is
    // exactly how a consumer sent their durable token into access logs.
    const kernel = makeKernel({ sse: { url: '/events', getTokens: () => 'x' } })
    kernel._createSSEBridge()

    const message = warn.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(message).toContain('sse.getTokens')
    expect(message).toContain('IGNORED')
    // The half that matters: naming the consequence, not the omission.
    expect(message).toContain('session auth token will be sent')
    expect(message).toContain('Did you mean "getToken"?')
    warn.mockRestore()
  })

  it('mentions the version, since that is the usual cause', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const kernel = makeKernel({ sse: { url: '/events', somethingNew: true } })
    kernel._createSSEBridge()

    expect(warn.mock.calls.map((c) => c.join(' ')).join('\n')).toContain('predates the option')
    warn.mockRestore()
  })

  it('stays silent on a valid config', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const kernel = makeKernel({
      sse: {
        url: '/events',
        entities: ['runs'],
        getToken: () => 't',
        tokenParam: 'ticket',
        reconnectDelay: 1000,
        connectOnSignal: null,
      },
    })
    kernel._createSSEBridge()

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
