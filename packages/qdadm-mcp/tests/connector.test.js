// @vitest-environment jsdom
/**
 * The page side of pairing (#2231), driven against a REAL RelayBroker over an
 * in-memory socket pair: scan → code in the tab → pair_accept → requests
 * answered; reload → the same instance re-pairs; restarted relay → refused.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { installQdadmRelayConnector } from '../src/connector.ts'
import { RelayBroker } from '../src/relay/broker.ts'

const ORIGIN = 'http://localhost:5174'
const identity = (port, project = 'demo') => ({
  name: 'qdadm-mcp-relay',
  protocol: 2,
  project,
  cwd: `/x/${project}`,
  port,
  pid: 1,
  startedAt: 0,
})

function memoryStorage() {
  const m = new Map()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}

/**
 * Browser-side WebSockets wired to what `net` says listens on each port: a
 * broker (a relay), 'held' (the browser holds the connection back), or
 * nothing (refused).
 */
function makeNetwork(net) {
  const created = []
  const sockets = []
  class LinkedWebSocket {
    constructor(url) {
      created.push(url)
      sockets.push(this)
      this.readyState = 0
      const target = net[Number(new URL(url).port)]
      setTimeout(() => {
        if (target === 'held') return
        if (!target) {
          this.readyState = 3
          this.onerror?.({})
          this.onclose?.({})
          return
        }
        const server = new EventEmitter()
        server.send = (data) =>
          setTimeout(() => {
            if (this.readyState === 1) this.onmessage?.({ data })
          }, 0)
        server.close = () => this.close()
        this.server = server
        this.readyState = 1
        this.onopen?.({})
        target.attach(server, { origin: ORIGIN })
      }, 0)
    }
    send(data) {
      const server = this.server
      setTimeout(() => server?.emit('message', data), 0)
    }
    close() {
      // Like a real socket: frames already sent still arrive, then it closes.
      if (this.closing) return
      this.closing = true
      setTimeout(() => {
        this.readyState = 3
        this.server?.emit('close')
        this.onclose?.({})
      }, 0)
    }
  }
  return { LinkedWebSocket, created, sockets }
}

let store
let tabStore

beforeEach(() => {
  delete window.__qdadmRelay
  store = memoryStorage()
  tabStore = memoryStorage()
  tabStore.setItem('qdadm-relay:instance', 'tab-1')
})

const install = (net) => {
  const network = makeNetwork(net)
  const controller = installQdadmRelayConnector({
    WebSocket: network.LinkedWebSocket,
    storage: store,
    tabStorage: tabStore,
    ports: [47761, 47762],
    probeTimeoutMs: 50,
  })
  return { controller, ...network }
}

const makeBroker = (project = 'demo', port = 47761, code = '424242') => {
  let n = 0
  return new RelayBroker({ identity: identity(port, project), generateCode: () => code, generateKey: () => `key-${++n}` })
}

const pairWith = async (controller, broker, code = '424242') => {
  await controller.pair()
  await vi.waitFor(() => expect(controller.state).toMatchObject({ status: 'awaiting-code', code }))
  broker.pairing.accept(code)
  await vi.waitFor(() => expect(controller.state.status).toBe('paired'))
}

describe('relay connector — pairing (#2231)', () => {
  it('a tab that never paired opens no socket and wraps nothing', async () => {
    const originalError = console.error
    const { controller, created } = install({ 47761: makeBroker() })

    expect(window.__qdadmRelay).toBe(controller)
    expect(controller.state).toEqual({ status: 'idle' })
    await new Promise((r) => setTimeout(r, 20))
    expect(created).toEqual([])
    expect(console.error).toBe(originalError)
  })

  it('Pair: finds the relay, shows its code, pairs on pair_accept, then answers requests', async () => {
    const broker = makeBroker()
    const { controller } = install({ 47761: broker })

    await pairWith(controller, broker)

    expect(controller.state.relay.project).toBe('demo')
    expect(JSON.parse(store.getItem('qdadm-relay:pairing'))).toMatchObject({ port: 47761, key: 'key-1' })
    const info = await broker.ask('sessionInfo')
    expect(info.sessionId).toBe('tab-1')
    expect(info.transport).toBe('relay')
  })

  it('a reload re-pairs silently: one attempt on the remembered port, same instance', async () => {
    const broker = makeBroker()
    const first = install({ 47761: broker })
    await pairWith(first.controller, broker)

    // The page unloads: its socket goes, and nothing of it survives.
    const live = first.sockets.find((s) => s.readyState === 1)
    live.onclose = live.onmessage = null
    live.close()
    await vi.waitFor(() => expect(broker.listSessions()[0].connected).toBe(false))
    await expect(broker.ask('routes')).rejects.toThrow(/most likely reloading/)

    delete window.__qdadmRelay
    const second = install({ 47761: broker })
    await vi.waitFor(() => expect(second.controller.state.status).toBe('paired'))

    expect(second.created).toEqual(['ws://localhost:47761/'])
    expect((await broker.ask('sessionInfo')).sessionId).toBe('tab-1')
  })

  it('a restarted relay does not know the pairing: the tab says so and forgets it', async () => {
    store.setItem('qdadm-relay:pairing', JSON.stringify({ port: 47761, key: 'key-old', relay: identity(47761) }))
    const { controller } = install({ 47761: makeBroker() })

    await vi.waitFor(() =>
      expect(controller.state).toMatchObject({ status: 'error', message: expect.stringMatching(/does not know that pairing/) })
    )
    expect(store.getItem('qdadm-relay:pairing')).toBeNull()
  })

  it('nothing answering → none-found; a held connection → the local-network permission hint', async () => {
    const quiet = install({})
    await quiet.controller.pair()
    expect(quiet.controller.state).toEqual({ status: 'none-found', ports: [47761, 47762], permissionPending: false })

    delete window.__qdadmRelay
    const held = install({ 47762: 'held' })
    await held.controller.pair()
    expect(held.controller.state).toEqual({ status: 'none-found', ports: [47761, 47762], permissionPending: true })
  })

  it('two relays → the tab chooses, and pairs with the one picked', async () => {
    const other = makeBroker('other', 47762, '515151')
    const { controller } = install({ 47761: makeBroker(), 47762: other })

    await controller.pair()
    expect(controller.state.status).toBe('choose')
    expect(controller.state.relays.map((r) => r.project)).toEqual(['demo', 'other'])

    await controller.pair(47762)
    await vi.waitFor(() => expect(controller.state).toMatchObject({ status: 'awaiting-code', code: '515151' }))
  })

  it('unpair forgets the pairing on both sides', async () => {
    const broker = makeBroker()
    const { controller } = install({ 47761: broker })
    await pairWith(controller, broker)

    controller.unpair()

    expect(controller.state).toEqual({ status: 'idle' })
    expect(store.getItem('qdadm-relay:pairing')).toBeNull()
    await vi.waitFor(() => expect(broker.listSessions()).toEqual([]))
  })

  it('pairing another tab leaves this one paired — the relay serves both', async () => {
    const broker = makeBroker()
    const { controller } = install({ 47761: broker })
    await pairWith(controller, broker)

    const other = new EventEmitter()
    other.send = (data) => {
      const msg = JSON.parse(data)
      if (msg.kind === 'pair-pending') setTimeout(() => broker.pairing.accept(msg.code), 0)
    }
    other.close = () => {}
    broker.attach(other, { origin: ORIGIN })
    other.emit('message', JSON.stringify({ kind: 'pair', instanceId: 'tab-2', meta: {} }))

    await vi.waitFor(() => expect(broker.listSessions().map((s) => s.instance).sort()).toEqual(['tab-1', 'tab-2']))
    expect(controller.state.status).toBe('paired')
  })
})

describe('relay connector — dev pages connect on their own (#2231)', () => {
  const autoInstall = (net, config) => {
    window.__qdadmRelayAuto = '/__qdadm/relay.json'
    const fetchMock = vi.fn(config)
    vi.stubGlobal('fetch', fetchMock)
    return { ...install(net), fetchMock }
  }
  const answering = (body) => async () => ({ ok: true, status: 200, json: async () => body() })

  afterEach(() => {
    delete window.__qdadmRelayAuto
    vi.unstubAllGlobals()
  })

  it('connects at startup with the page token — no code, no click', async () => {
    const broker = new RelayBroker({ token: 'dev-token', identity: identity(47761) })
    const { controller, fetchMock } = autoInstall({ 47761: broker }, answering(() => ({ port: 47761, token: 'dev-token' })))

    expect(controller.mode).toBe('auto')
    await vi.waitFor(() => expect(controller.state.status).toBe('connected'))
    expect(fetchMock).toHaveBeenCalledWith('/__qdadm/relay.json', { cache: 'no-store' })
    expect(broker.listSessions()).toEqual([expect.objectContaining({ instance: 'tab-1', via: 'token', connected: true })])
    expect((await broker.ask('sessionInfo')).sessionId).toBe('tab-1')
  })

  it('a relay restart: the tab asks the dev server again and rejoins with the new token', async () => {
    let token = 'first'
    const net = { 47761: new RelayBroker({ token: 'first', identity: identity(47761) }) }
    const { controller, sockets } = autoInstall(net, answering(() => ({ port: 47761, token })))
    await vi.waitFor(() => expect(controller.state.status).toBe('connected'))

    // The relay dies — its connections close — and a new one takes the port, with a new token.
    const replacement = new RelayBroker({ token: 'second', identity: identity(47761) })
    net[47761] = replacement
    token = 'second'
    sockets.find((s) => s.readyState === 1).close()

    await vi.waitFor(() => expect(replacement.listSessions().map((s) => s.instance)).toEqual(['tab-1']), { timeout: 4000 })
    expect(controller.state.status).toBe('connected')
  })

  it('pair() does nothing on a dev page — it is already connected', async () => {
    const broker = new RelayBroker({ token: 'dev-token', identity: identity(47761) })
    const { controller, created } = autoInstall({ 47761: broker }, answering(() => ({ port: 47761, token: 'dev-token' })))
    await vi.waitFor(() => expect(controller.state.status).toBe('connected'))
    const sockets = created.length

    await controller.pair()

    expect(controller.state.status).toBe('connected')
    expect(created.length).toBe(sockets)
  })

  it('the dev server not answering → offline, and it keeps trying', async () => {
    const { controller } = autoInstall({}, async () => {
      throw new Error('ECONNREFUSED')
    })
    await vi.waitFor(() =>
      expect(controller.state).toMatchObject({ status: 'offline', message: expect.stringMatching(/dev server could not provide the relay/) })
    )
    expect(controller.state.retryInMs).toBeGreaterThan(0)
  })
})

describe('relay connector — the MCP tab chat (#2231)', () => {
  afterEach(() => {
    delete window.__qdadmRelayAuto
    vi.unstubAllGlobals()
  })

  const connected = async () => {
    window.__qdadmRelayAuto = '/__qdadm/relay.json'
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({ port: 47761, token: 'dev-token' }) }))
    const broker = new RelayBroker({ token: 'dev-token', identity: identity(47761) })
    const { controller } = install({ 47761: broker })
    await vi.waitFor(() => expect(controller.state.status).toBe('connected'))
    return { broker, controller }
  }

  it('the agent writes into the tab; the tab sees it at once', async () => {
    const { broker, controller } = await connected()
    const seen = []
    controller.chat.subscribe((messages) => seen.push(messages.length))

    const res = await broker.ask('chatPost', { message: 'Hello from the agent' })

    expect(res).toEqual({ shown: true, unreadFromUser: 0 })
    expect(controller.chat.messages).toEqual([expect.objectContaining({ from: 'agent', text: 'Hello from the agent' })])
    expect(seen.at(-1)).toBe(1)
  })

  it('what the user types, the agent reads once', async () => {
    const { broker, controller } = await connected()
    controller.chat.send('  hi agent  ')
    controller.chat.send('')

    expect((await broker.ask('chatPost', { message: 'ping' })).unreadFromUser).toBe(1)
    const first = await broker.ask('chatRead')
    expect(first.messages.map((m) => m.text)).toEqual(['hi agent'])
    expect((await broker.ask('chatRead')).messages).toEqual([])
  })

  it('an empty message from the agent is refused with a reason', async () => {
    const { broker } = await connected()
    await expect(broker.ask('chatPost', { message: '   ' })).rejects.toThrow(/non-empty message/)
  })
})

describe('relay connector — the MCP history (#2231)', () => {
  afterEach(() => {
    delete window.__qdadmRelayAuto
    vi.unstubAllGlobals()
  })

  it('logs every request the tab serves, named after the tool, failures included', async () => {
    window.__qdadmRelayAuto = '/__qdadm/relay.json'
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({ port: 47761, token: 'dev-token' }) }))
    const broker = new RelayBroker({ token: 'dev-token', identity: identity(47761) })
    const { controller } = install({ 47761: broker })
    await vi.waitFor(() => expect(controller.state.status).toBe('connected'))

    await broker.ask('sessionInfo')
    await broker.ask('chatPost', { message: 'hello' })
    await expect(broker.ask('entityCall', { entity: 'books', op: 'get', id: 7 })).rejects.toThrow()

    expect(controller.activity.entries.map(({ tool, detail, ok }) => ({ tool, detail, ok }))).toEqual([
      { tool: 'session_info', detail: '', ok: true },
      { tool: 'chat_send', detail: 'hello', ok: true },
      { tool: 'entity_get', detail: 'books #7', ok: false },
    ])
    expect(controller.activity.entries[2].error).toMatch(/orchestrator not ready/)
  })
})

describe('relay connector — chat and history survive a reload (#2231)', () => {
  afterEach(() => {
    delete window.__qdadmRelayAuto
    vi.unstubAllGlobals()
  })

  it('a message the agent has not read yet is still there after the tab reloads', async () => {
    window.__qdadmRelayAuto = '/__qdadm/relay.json'
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({ port: 47761, token: 'dev-token' }) }))
    const broker = new RelayBroker({ token: 'dev-token', identity: identity(47761) })
    const first = install({ 47761: broker })
    await vi.waitFor(() => expect(first.controller.state.status).toBe('connected'))
    await broker.ask('chatPost', { message: 'hello' })
    first.controller.chat.send('typed just before a reload')

    // The page reloads: same tab storage, a fresh connector.
    const live = first.sockets.find((s) => s.readyState === 1)
    live.onclose = live.onmessage = null
    live.close()
    delete window.__qdadmRelayAuto
    delete window.__qdadmRelay
    window.__qdadmRelayAuto = '/__qdadm/relay.json'
    const second = install({ 47761: broker })
    await vi.waitFor(() => expect(second.controller.state.status).toBe('connected'))

    expect(second.controller.chat.messages.map((m) => m.text)).toEqual(['hello', 'typed just before a reload'])
    expect((await broker.ask('chatRead')).messages.map((m) => m.text)).toEqual(['typed just before a reload'])
    expect(second.controller.activity.entries.map((e) => e.tool)).toEqual(['chat_send', 'chat_read'])
  })
})

describe('relay connector — clearing the chat (#2231)', () => {
  afterEach(() => {
    delete window.__qdadmRelayAuto
    vi.unstubAllGlobals()
  })

  it('wipes the conversation for good: nothing to read, nothing back after a reload', async () => {
    window.__qdadmRelayAuto = '/__qdadm/relay.json'
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({ port: 47761, token: 'dev-token' }) }))
    const broker = new RelayBroker({ token: 'dev-token', identity: identity(47761) })
    const { controller } = install({ 47761: broker })
    await vi.waitFor(() => expect(controller.state.status).toBe('connected'))
    await broker.ask('chatPost', { message: 'hello' })
    controller.chat.send('not read yet')
    const seen = []
    controller.chat.subscribe((messages) => seen.push(messages.length))

    controller.chat.clear()

    expect(controller.chat.messages).toEqual([])
    expect(seen.at(-1)).toBe(0)
    expect((await broker.ask('chatRead')).messages).toEqual([])
    expect(JSON.parse(tabStore.getItem('qdadm-relay:chat')).messages).toEqual([])

    controller.chat.send('after the clear')
    expect((await broker.ask('chatRead')).messages.map((m) => m.text)).toEqual(['after the clear'])
  })
})
