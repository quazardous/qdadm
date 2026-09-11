/**
 * The MCP tab's collector (#2231): it follows the relay connector's
 * controller, and never lets the pairing code out through the bridge.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { RelayCollector, findRelayController } from './RelayCollector'

function fakeController(initial = { status: 'idle' }) {
  let state = initial
  const listeners = new Set()
  return {
    get state() {
      return state
    },
    subscribe(listener) {
      listeners.add(listener)
      listener(state)
      return () => listeners.delete(listener)
    },
    pair: vi.fn(async () => {}),
    unpair: vi.fn(),
    emit(next) {
      state = next
      for (const listener of listeners) listener(next)
    },
    listeners,
  }
}

const awaitingCode = { status: 'awaiting-code', code: '424242', relay: { project: 'demo', port: 47761 } }

afterEach(() => {
  delete globalThis.__qdadmRelay
})

describe('RelayCollector — the MCP tab (#2231)', () => {
  it('follows the controller, and asks for attention while a code waits', () => {
    const controller = fakeController()
    globalThis.__qdadmRelay = controller
    const collector = new RelayCollector()
    const notified = vi.fn()
    collector.onNotify(notified)
    collector.install({})

    expect(collector.state.status).toBe('idle')
    expect(collector.getBadge()).toBe(0)

    controller.emit(awaitingCode)

    expect(collector.state.code).toBe('424242') // the panel shows it
    expect(collector.getBadge()).toBe(1)
    expect(notified).toHaveBeenCalled()
  })

  it('never lets the code out through the bridge: snapshot and the state action redact it', async () => {
    const controller = fakeController(awaitingCode)
    globalThis.__qdadmRelay = controller
    const collector = new RelayCollector()
    collector.install({})

    expect(JSON.stringify(collector.snapshot())).not.toContain('424242')
    expect(JSON.stringify(await collector.call('state'))).not.toContain('424242')
    expect(JSON.stringify(await collector.call('pair'))).not.toContain('424242')
    expect(collector.snapshot().state.status).toBe('awaiting-code')
  })

  it('pair and unpair drive the controller', async () => {
    const controller = fakeController()
    globalThis.__qdadmRelay = controller
    const collector = new RelayCollector()
    collector.install({})

    await collector.call('pair', { port: 47762 })
    expect(controller.pair).toHaveBeenCalledWith(47762)
    await collector.call('unpair')
    expect(controller.unpair).toHaveBeenCalled()
  })

  it('without the connector: no controller, and the tab says so', async () => {
    expect(findRelayController()).toBeNull()
    const collector = new RelayCollector()
    collector.install({})

    expect(collector.state.status).toBe('unavailable')
    await expect(collector.pair()).resolves.toBeUndefined()
  })

  it('stops listening when uninstalled', () => {
    const controller = fakeController()
    globalThis.__qdadmRelay = controller
    const collector = new RelayCollector()
    collector.install({})
    expect(controller.listeners.size).toBe(1)

    collector.uninstall()

    expect(controller.listeners.size).toBe(0)
  })
})

describe('RelayCollector — the chat (#2231)', () => {
  it('follows the controller chat and sends what the panel types', () => {
    let messages = []
    const listeners = new Set()
    const controller = {
      ...fakeController(),
      chat: {
        get messages() {
          return messages
        },
        send: vi.fn((text) => {
          messages = [...messages, { id: messages.length + 1, from: 'user', text, at: 0 }]
          for (const l of listeners) l(messages)
        }),
        subscribe(listener) {
          listeners.add(listener)
          listener(messages)
          return () => listeners.delete(listener)
        },
      },
    }
    globalThis.__qdadmRelay = controller
    const collector = new RelayCollector()
    const notified = vi.fn()
    collector.onNotify(notified)
    collector.install({})

    expect(collector.canChat).toBe(true)
    collector.sendChat('hello')

    expect(controller.chat.send).toHaveBeenCalledWith('hello')
    expect(collector.chat.map((m) => m.text)).toEqual(['hello'])
    expect(notified).toHaveBeenCalled()

    collector.uninstall()
    expect(listeners.size).toBe(0)
  })
})

describe('RelayCollector — the MCP history (#2231)', () => {
  it('follows what agents did in the tab', () => {
    let entries = []
    const listeners = new Set()
    const controller = {
      ...fakeController(),
      activity: {
        get entries() {
          return entries
        },
        subscribe(listener) {
          listeners.add(listener)
          listener(entries)
          return () => listeners.delete(listener)
        },
      },
    }
    globalThis.__qdadmRelay = controller
    const collector = new RelayCollector()
    collector.install({})
    expect(collector.hasActivity).toBe(true)

    entries = [{ id: 1, at: 0, tool: 'routes', detail: '', ok: true, ms: 3 }]
    for (const l of listeners) l(entries)

    expect(collector.activity.map((e) => e.tool)).toEqual(['routes'])
    collector.uninstall()
    expect(listeners.size).toBe(0)
  })
})

describe('RelayCollector — real screenshots (#2247)', () => {
  it('follows whether a capture runs, and starts or stops it for the panel', async () => {
    let listener = () => {}
    const controller = {
      ...fakeController({ status: 'connected' }),
      capture: {
        active: false,
        start: vi.fn(async () => listener(true)),
        stop: vi.fn(() => listener(false)),
        subscribe: (l) => {
          listener = l
          l(false)
          return () => {}
        },
      },
    }
    globalThis.__qdadmRelay = controller
    const collector = new RelayCollector()
    collector.install({})
    expect(collector.canCapture).toBe(true)
    expect(collector.captureActive).toBe(false)

    await collector.startCapture()
    expect(controller.capture.start).toHaveBeenCalled()
    expect(collector.captureActive).toBe(true)
    collector.stopCapture()
    expect(collector.captureActive).toBe(false)
  })

  it('a connector without capture offers none', () => {
    globalThis.__qdadmRelay = fakeController()
    const collector = new RelayCollector()
    collector.install({})
    expect(collector.canCapture).toBe(false)
  })
})

describe('RelayCollector — what is new in the MCP tab (#2285)', () => {
  function relay(status = 'connected', { messages = [], entries = [] } = {}) {
    const chatListeners = new Set()
    const activityListeners = new Set()
    const controller = {
      ...fakeController({ status }),
      chat: {
        get messages() {
          return messages
        },
        send: vi.fn(),
        subscribe(l) {
          chatListeners.add(l)
          l(messages)
          return () => chatListeners.delete(l)
        },
      },
      activity: {
        get entries() {
          return entries
        },
        subscribe(l) {
          activityListeners.add(l)
          l(entries)
          return () => activityListeners.delete(l)
        },
      },
      say(from, text) {
        messages = [...messages, { id: (messages.at(-1)?.id ?? 0) + 1, from, text, at: 0 }]
        for (const l of chatListeners) l(messages)
      },
      request(tool) {
        entries = [...entries, { id: (entries.at(-1)?.id ?? 0) + 1, at: 0, tool, detail: '', ok: true, ms: 1 }]
        for (const l of activityListeners) l(entries)
      },
    }
    return controller
  }
  const installed = (controller) => {
    globalThis.__qdadmRelay = controller
    const collector = new RelayCollector()
    collector.install({})
    return collector
  }
  const memoryStorage = () => {
    const data = new Map()
    return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) }
  }

  afterEach(() => vi.unstubAllGlobals())

  it('counts agent messages and requests the tab has not shown; the user\'s own messages are not news', () => {
    vi.stubGlobal('sessionStorage', memoryStorage())
    const controller = relay()
    const collector = installed(controller)

    controller.say('agent', 'hello')
    controller.say('user', 'hi')
    controller.say('agent', 'done')
    controller.request('navigate')
    controller.request('page_snapshot')

    expect(collector.unseenChat).toBe(2)
    expect(collector.unseenHistory).toBe(2)
    expect(collector.getBadge()).toBe(4)
    expect(collector.snapshot().unseen).toBe(4)
    expect(collector.snapshot().unseenBy).toEqual({ chat: 2, history: 2 })
  })

  it('a sub-tab on screen marks only what it shows as seen', () => {
    vi.stubGlobal('sessionStorage', memoryStorage())
    const controller = relay()
    const collector = installed(controller)
    controller.say('agent', 'hello')
    controller.request('navigate')

    collector.markChatSeen()
    expect(collector.unseenChat).toBe(0)
    expect(collector.getBadge()).toBe(1)

    collector.markHistorySeen()
    expect(collector.getBadge()).toBe(0)

    controller.say('agent', 'again')
    expect(collector.getBadge()).toBe(1)
  })

  it('the marks survive a reload of the tab', () => {
    const storage = memoryStorage()
    vi.stubGlobal('sessionStorage', storage)
    const controller = relay()
    const before = installed(controller)
    controller.say('agent', 'hello')
    controller.request('navigate')
    before.markChatSeen()
    before.uninstall()

    const after = installed(controller)

    expect(after.unseenChat).toBe(0)
    expect(after.unseenHistory).toBe(1)
  })

  it('what the tab already held before any mark is not counted as new', () => {
    vi.stubGlobal('sessionStorage', memoryStorage())
    const collector = installed(
      relay('connected', {
        messages: [{ id: 7, from: 'agent', text: 'old', at: 0 }],
        entries: [{ id: 40, at: 0, tool: 'routes', detail: '', ok: true, ms: 1 }],
      })
    )

    expect(collector.getBadge()).toBe(0)
  })

  it('a waiting code or an error still asks for attention; the Status sub-tab also flags offline', () => {
    vi.stubGlobal('sessionStorage', memoryStorage())
    const controller = relay('connected')
    const collector = installed(controller)
    expect(collector.statusAlert).toBe(false)

    controller.emit(awaitingCode)
    expect(collector.getBadge()).toBe(1)
    expect(collector.statusAlert).toBe(true)

    controller.emit({ status: 'offline', message: 'relay gone', retryInMs: 1000 })
    expect(collector.getBadge()).toBe(0)
    expect(collector.statusAlert).toBe(true)
  })

  it('without sessionStorage the counts still work, for the page only', () => {
    vi.stubGlobal('sessionStorage', undefined)
    const controller = relay()
    const collector = installed(controller)

    controller.say('agent', 'hello')
    expect(collector.unseenChat).toBe(1)
    collector.markChatSeen()
    expect(collector.unseenChat).toBe(0)
  })
})

describe('RelayCollector — clearing the chat (#2231)', () => {
  it('asks the controller to clear', () => {
    const controller = {
      ...fakeController(),
      chat: { messages: [], send: vi.fn(), clear: vi.fn(), subscribe: (l) => (l([]), () => {}) },
    }
    globalThis.__qdadmRelay = controller
    const collector = new RelayCollector()
    collector.install({})

    collector.clearChat()

    expect(controller.chat.clear).toHaveBeenCalled()
  })
})
