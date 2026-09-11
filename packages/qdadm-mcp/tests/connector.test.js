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

// jsdom draws nothing: the picture itself is proven live on the demo.
vi.mock('@zumer/snapdom', () => ({
  snapdom: { toCanvas: vi.fn(async () => ({ width: 1200, height: 800, toDataURL: (type) => `data:${type};base64,QUJD` })) },
}))

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
    // The relay knows the tab once it said hello; the tab calls itself connected once the welcome is back.
    await vi.waitFor(() => expect(controller.state.status).toBe('connected'))
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

  it('agent hooks (#2252): each unanswered message is shown once, across instances; chat_read still returns it', async () => {
    const { broker, controller } = await connected()
    controller.chat.send('are you there?')
    controller.chat.send('the save button does nothing')

    expect(await broker.chatPending(false)).toEqual([
      expect.objectContaining({
        instance: 'tab-1',
        messages: [expect.objectContaining({ text: 'are you there?' }), expect.objectContaining({ text: 'the save button does nothing' })],
      }),
    ])
    expect((await broker.chatPending(true))[0].messages).toHaveLength(2)
    expect(await broker.chatPending(true)).toEqual([])

    controller.chat.send('hello?')
    expect((await broker.chatPending(true))[0].messages.map((m) => m.text)).toEqual(['hello?'])
    expect((await broker.ask('chatRead')).messages.map((m) => m.text)).toEqual(['are you there?', 'the save button does nothing', 'hello?'])
    expect(controller.activity.entries.map((e) => e.tool)).not.toContain('chatPending')
  })

  it('a screenshot the user annotated goes with the message; hooks are told, chat_read hands it over (#2309)', async () => {
    const { broker, controller } = await connected()
    expect(typeof controller.chat.shoot).toBe('function')

    controller.chat.send('  this one  ', { mimeType: 'image/jpeg', data: 'QUJD' })
    controller.chat.send('', { mimeType: 'image/jpeg', data: 'REVG' })
    controller.chat.send('', { mimeType: 'text/html', data: 'PHA+' }) // not a picture, and no text: nothing sent

    expect(controller.chat.messages.map((m) => [m.text, m.image?.data])).toEqual([
      ['this one', 'QUJD'],
      ['', 'REVG'],
    ])
    expect((await broker.chatPending(false))[0].messages).toEqual([
      { text: 'this one', at: expect.any(Number), screenshot: true },
      { text: '', at: expect.any(Number), screenshot: true },
    ])
    expect((await broker.ask('chatRead')).messages).toEqual([
      { text: 'this one', at: expect.any(Number), image: { mimeType: 'image/jpeg', data: 'QUJD' } },
      { text: '', at: expect.any(Number), image: { mimeType: 'image/jpeg', data: 'REVG' } },
    ])
  })

  it('the chat keeps the last 5 screenshots; a full storage drops the oldest pictures, never the text (#2309)', async () => {
    const { controller } = await connected()
    for (let i = 1; i <= 7; i++) controller.chat.send(`shot ${i}`, { mimeType: 'image/jpeg', data: `DATA${i}` })

    expect(controller.chat.messages.map((m) => Boolean(m.image))).toEqual([false, false, true, true, true, true, true])
    expect(controller.chat.messages[0]).toMatchObject({ text: 'shot 1', imageDropped: true })
    expect(JSON.parse(tabStore.getItem('qdadm-relay:chat')).messages.filter((m) => m.image)).toHaveLength(5)

    // A storage that silently refuses the chat once it holds more than two pictures.
    const setItem = tabStore.setItem
    tabStore.setItem = (k, v) => {
      if (k === 'qdadm-relay:chat' && (v.match(/"image":/g) ?? []).length > 2) return
      setItem(k, v)
    }
    controller.chat.send('shot 8', { mimeType: 'image/jpeg', data: 'DATA8' })

    const kept = JSON.parse(tabStore.getItem('qdadm-relay:chat')).messages
    expect(kept.map((m) => m.text)).toEqual(['shot 1', 'shot 2', 'shot 3', 'shot 4', 'shot 5', 'shot 6', 'shot 7', 'shot 8'])
    expect(kept.filter((m) => m.image).map((m) => m.text)).toEqual(['shot 7', 'shot 8'])
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

describe('relay connector — navigation, feedback and waiting (#2247)', () => {
  let emit
  const fakeApp = () => {
    const listeners = []
    const route = { value: { name: 'home', fullPath: '/', params: {} } }
    const known = {
      '/books': { name: 'book', fullPath: '/books', params: {} },
      '/books/7/edit': { name: 'book-edit', fullPath: '/books/7/edit', params: { bookId: '7' } },
    }
    emit = (name, data) => listeners.forEach((cb) => cb({ name, data }))
    window.__qdadm = {
      router: {
        currentRoute: route,
        getRoutes: () => [],
        push: async (to) => {
          const path = typeof to === 'string' ? to : to.name === 'book-edit' ? `/books/${to.params.bookId}/edit` : null
          if (!known[path]) throw new Error(`No match for ${JSON.stringify(to)}`)
          route.value = known[path]
          emit('stack:change')
          if (path.endsWith('/edit')) {
            emit('i18n:missing', { key: 'books.fields.isbn', locale: 'en' })
            emit('i18n:missing', { key: 'books.fields.isbn', locale: 'en' })
            console.error('boom in the edit page')
          }
        },
      },
      signals: {
        on: (_pattern, cb) => {
          listeners.push(cb)
          return () => {}
        },
      },
    }
  }

  const connected = async () => {
    fakeApp()
    window.__qdadmRelayAuto = '/__qdadm/relay.json'
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({ port: 47761, token: 'dev-token' }) }))
    const broker = new RelayBroker({ token: 'dev-token', identity: identity(47761) })
    const { controller } = install({ 47761: broker })
    await vi.waitFor(() => expect(controller.state.status).toBe('connected'))
    return { broker, controller }
  }

  afterEach(() => {
    delete window.__qdadm
    delete window.__qdadmRelayAuto
    vi.unstubAllGlobals()
  })

  it('navigate settles, and the feedback names the route, the missing key and the console error', async () => {
    // No console spy here: restoring one would also remove the connector's capture wrapper.
    const { broker } = await connected()
    const mark = await broker.ask('feedbackMark')

    const res = await broker.ask('navigate', { path: '/books/7/edit' })
    expect(res.route).toMatchObject({ name: 'book-edit', fullPath: '/books/7/edit', params: { bookId: '7' } })

    const feedback = await broker.ask('feedbackSince', { mark })
    expect(feedback.route).toEqual({ from: '/', to: '/books/7/edit', name: 'book-edit' })
    expect(feedback.i18nMissing).toEqual([{ key: 'books.fields.isbn', locale: 'en' }])
    expect(feedback.errors).toEqual([expect.stringContaining('boom in the edit page')])
    expect(feedback.signals).toEqual(['stack:change', 'i18n:missing', 'i18n:missing'])
  })

  it('navigate by route name and params; an unknown target fails with the router reason', async () => {
    const { broker } = await connected()
    expect((await broker.ask('navigate', { route: 'book-edit', params: { bookId: '7' } })).route.fullPath).toBe('/books/7/edit')
    await expect(broker.ask('navigate', { path: '/nowhere' })).rejects.toThrow(/No match/)
  })

  it('wait_for resolves on a signal emitted after the call, and on a route reached', async () => {
    const { broker } = await connected()

    setTimeout(() => emit('entity:books:updated', { id: 7 }), 50)
    expect(await broker.ask('waitFor', { signal: '^entity:books:' })).toMatchObject({
      matched: 'signal',
      signal: { name: 'entity:books:updated', data: { id: 7 } },
    })

    setTimeout(() => window.__qdadm.router.push('/books'), 50)
    expect(await broker.ask('waitFor', { route: 'book' })).toMatchObject({ matched: 'route', route: { fullPath: '/books' } })
  })

  it('wait_for times out saying where the tab is', async () => {
    const { broker } = await connected()
    await expect(broker.ask('waitFor', { route: 'nowhere', timeoutMs: 200 })).rejects.toThrow(
      /timed out after 200 ms — route is \/; signals meanwhile: none/
    )
  })

  it('the MCP history names the navigation and hides the feedback plumbing', async () => {
    const { broker, controller } = await connected()
    const mark = await broker.ask('feedbackMark')
    await broker.ask('navigate', { path: '/books' })
    await broker.ask('feedbackSince', { mark })

    expect(controller.activity.entries.map(({ tool, detail }) => ({ tool, detail }))).toEqual([{ tool: 'navigate', detail: '/books' }])
  })
})

describe('relay connector — reading the page (#2247)', () => {
  const PAGE = `
    <nav aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><span>Books</span></li></ol></nav>
    <main>
      <h1>Books</h1>
      <button><span>Add Book</span></button>
      <table>
        <thead><tr><th>Title</th><th>Author</th><th>Actions</th></tr></thead>
        <tbody>
          <tr><td>Dune</td><td>Frank Herbert</td><td><button><span class="pi pi-pencil"></span></button></td></tr>
          <tr><td>Hyperion</td><td>Dan Simmons</td><td></td></tr>
          <tr><td>Ilium</td><td>Dan Simmons</td><td></td></tr>
        </tbody>
      </table>
      <div class="form-field field-invalid"><label for="title">Title *</label><input id="title" class="p-inputtext p-invalid" required /><small class="field-error">Title is required</small></div>
      <div class="form-field"><label for="year">Year</label><input id="year" value="1965" disabled /></div>
      <div class="form-field"><label for="author">Author</label><input role="combobox" aria-expanded="false" value="Frank Herbert" /><button class="p-autocomplete-dropdown p-button" aria-expanded="false"><svg></svg></button></div>
      <div class="form-field"><label for="shelf">Shelf</label><div class="p-select"><span role="combobox" aria-label="Top shelf" aria-expanded="false">Top shelf</span></div></div>
      <label><input type="checkbox" checked /> Available</label>
      <select aria-label="Genre"><option>sci-fi</option><option selected>fantasy</option></select>
      <button aria-expanded="false">Details</button>
      <p style="display: none">Hidden text</p>
      <button disabled>Save</button>
    </main>
    <div class="qd-debug" style="display: contents"><button>Pause</button></div>
    <div role="dialog" aria-label="Delete book?"><p>This cannot be undone.</p><button>Cancel</button></div>`

  afterEach(() => {
    document.body.innerHTML = ''
    delete window.__qdadmRelayAuto
    vi.unstubAllGlobals()
  })

  const connected = async () => {
    document.body.innerHTML = PAGE
    window.__qdadmRelayAuto = '/__qdadm/relay.json'
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({ port: 47761, token: 'dev-token' }) }))
    const broker = new RelayBroker({ token: 'dev-token', identity: identity(47761) })
    const { controller } = install({ 47761: broker })
    await vi.waitFor(() => expect(controller.state.status).toBe('connected'))
    return { broker, controller }
  }
  const refIn = (text, line) => text.split('\n').find((l) => l.includes(line))?.match(/\[ref=(e\d+)\]/)?.[1]

  it('page_snapshot: an accessibility tree with roles, names, states, values and refs — never the debug bar', async () => {
    const { broker, controller } = await connected()
    const { text } = await broker.ask('pageSnapshot', { maxRows: 2 })

    for (const line of [
      '- navigation "Breadcrumb" [ref=',
      '- link "Home" [ref=',
      '- /url: /',
      '- heading "Books" [level=1] [ref=',
      '- button "Add Book" [ref=',
      '- columnheader "Title" [ref=',
      ']: Dune',
      '- button [icon=pencil] [ref=',
      '(1 more rows — maxRows to see them)',
      '- textbox "Title *" [required] [invalid] [ref=',
      '- text: Title is required',
      '- textbox "Year" [disabled] [value="1965"] [ref=',
      '- combobox "Author" [collapsed] [value="Frank Herbert"] [ref=',
      '- button [kind=autocomplete-dropdown] [collapsed] [ref=',
      '- combobox "Shelf" [collapsed] [value="Top shelf"] [ref=',
      '- checkbox "Available" [checked] [ref=',
      '- combobox "Genre" [value="fantasy"] [ref=',
      '- button "Details" [collapsed] [ref=',
      '- button "Save" [disabled] [ref=',
      '- dialog "Delete book?" [ref=',
      'Form errors:',
      '- Title: Title is required',
    ]) {
      expect(text).toContain(line)
    }
    expect(text).not.toContain('Ilium')
    expect(text).not.toContain('Hidden text')
    expect(text).not.toContain('Pause')
    expect(controller.activity.entries.at(-1).tool).toBe('page_snapshot')
  })

  it('inputs with no ARIA role are listed, with their type: a password never shows its value (#2291)', async () => {
    const { broker } = await connected()
    document.body.innerHTML = `
      <form>
        <label for="user">Username</label><input id="user" value="admin" />
        <label for="pass">Password</label><input id="pass" type="password" value="secret" required />
        <label for="due">Due</label><input id="due" type="date" value="2026-09-11" />
        <label for="tint">Tint</label><input id="tint" type="color" value="#ff0000" />
        <label for="cover">Cover</label><input id="cover" type="file" />
        <input type="hidden" name="csrf" value="t0k3n" />
        <button>Sign In</button>
      </form>`
    const { text } = await broker.ask('pageSnapshot', {})

    for (const line of [
      '- textbox "Username" [value="admin"] [ref=',
      '- textbox "Password" [type=password] [required] [value="••••••"] [ref=',
      '- textbox "Due" [type=date] [value="2026-09-11"] [ref=',
      '- textbox "Tint" [type=color] [value="#ff0000"] [ref=',
      '- button "Cover" [type=file] [ref=',
    ]) {
      expect(text).toContain(line)
    }
    expect(text).not.toContain('secret')
    expect(text).not.toContain('t0k3n')
    expect((await broker.ask('find', { role: 'textbox', text: 'password' })).text).toMatch(/^- textbox "Password" \[type=password\]/)
  })

  it('refs are stable across reads; "interactive" lists only what can be acted on; a ref reads one part', async () => {
    const { broker } = await connected()
    const tree = (await broker.ask('pageSnapshot', {})).text
    const interactive = (await broker.ask('pageSnapshot', { filter: 'interactive' })).text

    expect(refIn(interactive, 'button "Save"')).toBe(refIn(tree, 'button "Save"'))
    expect(interactive).not.toContain('heading')
    expect(interactive).not.toContain('- text:')

    const dialog = (await broker.ask('pageSnapshot', { ref: refIn(tree, 'dialog "Delete book?"') })).text
    expect(dialog).toContain('- button "Cancel"')
    expect(dialog).not.toContain('Add Book')
  })

  it('a ref whose element is gone fails loudly and says to take a new snapshot', async () => {
    const { broker } = await connected()
    const ref = refIn((await broker.ask('pageSnapshot', {})).text, 'dialog "Delete book?"')
    document.querySelector('[role=dialog]').remove()
    await expect(broker.ask('pageSnapshot', { ref })).rejects.toThrow(/no longer in the page .* take a new page_snapshot/)
  })

  it('find: by role and text, with where each match sits', async () => {
    const { broker } = await connected()
    const { text } = await broker.ask('find', { text: 'dan simmons' })
    expect(text.split('\n')).toHaveLength(2)
    expect(text).toContain(' — in row "Hyperion Dan Simmons"')

    expect((await broker.ask('find', { role: 'button', text: 'cancel' })).text).toMatch(/^- button "Cancel" \[ref=e\d+\] — in dialog "Delete book\?"$/)
    expect((await broker.ask('find', { role: 'slider' })).text).toBe('Nothing visible matches role "slider".')
  })

  it('page_text: what the user reads, debug bar left out', async () => {
    const { broker } = await connected()
    const { text } = await broker.ask('pageText', {})
    expect(text).toContain('Frank Herbert')
    expect(text).not.toContain('Pause')
    expect(document.querySelector('.qd-debug').style.display).toBe('contents')
  })
})

describe('relay connector — screenshot (#2247)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    delete window.__qdadmRelayAuto
    vi.unstubAllGlobals()
  })

  it('renders the page body without the debug bar; a real capture needs the user to share the tab first', async () => {
    const { snapdom } = await import('@zumer/snapdom')
    document.body.innerHTML = '<main><h1>Books</h1></main><div class="qd-debug"></div>'
    window.__qdadmRelayAuto = '/__qdadm/relay.json'
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({ port: 47761, token: 'dev-token' }) }))
    const broker = new RelayBroker({ token: 'dev-token', identity: identity(47761) })
    const { controller } = install({ 47761: broker })
    await vi.waitFor(() => expect(controller.state.status).toBe('connected'))

    expect(await broker.ask('screenshot', {})).toEqual({ data: 'QUJD', mimeType: 'image/jpeg', width: 1200, height: 800, source: 'dom' })
    expect(snapdom.toCanvas).toHaveBeenLastCalledWith(document.body, expect.objectContaining({ exclude: ['.qd-debug'] }))

    expect((await broker.ask('screenshot', { format: 'png', fullPage: true, withDebugBar: true })).mimeType).toBe('image/png')
    expect(snapdom.toCanvas).toHaveBeenLastCalledWith(document.body, expect.objectContaining({ exclude: [] }))

    await expect(broker.ask('screenshot', { source: 'tab' })).rejects.toThrow(/Allow real screenshots/)
    expect(controller.capture.active).toBe(false)
    expect(controller.activity.entries.at(-1).tool).toBe('screenshot')
  })

  const connectedForShots = async () => {
    document.body.innerHTML = '<main><h1>Books</h1></main>'
    window.__qdadmRelayAuto = '/__qdadm/relay.json'
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({ port: 47761, token: 'dev-token' }) }))
    const broker = new RelayBroker({ token: 'dev-token', identity: identity(47761) })
    const { controller } = install({ 47761: broker })
    await vi.waitFor(() => expect(controller.state.status).toBe('connected'))
    return { broker, controller }
  }

  it('an agent picture rendered from the page, with no capture running, offers real screenshots to the debug bar (#2318)', async () => {
    // A tab the browser lets the user share, and a <video>/<canvas> jsdom cannot draw: stubbed.
    const track = { readyState: 'live', addEventListener: () => {}, stop: vi.fn() }
    const stream = { getVideoTracks: () => [track], getTracks: () => [track] }
    Object.defineProperty(navigator, 'mediaDevices', { value: { getDisplayMedia: vi.fn(async () => stream) }, configurable: true })
    const spies = [
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined),
      vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}),
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: () => {} }),
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,QUJD'),
    ]
    vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(cb, 0))
    try {
      const { broker, controller } = await connectedForShots()
      const suggested = vi.fn()
      controller.capture.onSuggest(suggested)
      expect(controller.capture.supported).toBe(true)

      expect((await broker.ask('screenshot', {})).source).toBe('dom')
      expect(suggested).toHaveBeenCalledTimes(1)

      // The agent asked for the rendering on purpose: nothing to offer.
      await broker.ask('screenshot', { source: 'dom' })
      expect(suggested).toHaveBeenCalledTimes(1)

      // A real capture runs: the picture is the tab's, and nothing is offered.
      await controller.capture.start()
      expect((await broker.ask('screenshot', {})).source).toBe('tab')
      expect(suggested).toHaveBeenCalledTimes(1)
      controller.capture.stop()
    } finally {
      for (const spy of spies) spy.mockRestore()
      delete navigator.mediaDevices
    }
  })

  it('a browser that cannot capture a tab offers nothing', async () => {
    const { broker, controller } = await connectedForShots()
    const suggested = vi.fn()
    const stop = controller.capture.onSuggest(suggested)

    expect(controller.capture.supported).toBe(false)
    await broker.ask('screenshot', {})
    expect(suggested).not.toHaveBeenCalled()
    stop()
  })
})

describe('relay connector — acting in the page, console and network (#2247)', () => {
  let saved = 0

  afterEach(() => {
    document.body.innerHTML = ''
    delete window.__qdadmRelayAuto
    vi.unstubAllGlobals()
  })

  const connected = async (answer = async () => ({ ok: true, status: 200 })) => {
    document.body.innerHTML = '<main><h1>Books</h1><label for="title">Title</label><input id="title" /><button id="save">Save</button></main>'
    saved = 0
    document.querySelector('#save').addEventListener('click', () => saved++)
    window.__qdadmRelayAuto = '/__qdadm/relay.json'
    vi.stubGlobal('fetch', async (url, init) =>
      String(url).includes('relay.json')
        ? { ok: true, status: 200, json: async () => ({ port: 47761, token: 'dev-token' }) }
        : answer(url, init)
    )
    const broker = new RelayBroker({ token: 'dev-token', identity: identity(47761) })
    const { controller } = install({ 47761: broker })
    await vi.waitFor(() => expect(controller.state.status).toBe('connected'))
    return { broker, controller }
  }
  const refIn = (text, line) => text.split('\n').find((l) => l.includes(line))?.match(/\[ref=(e\d+)\]/)?.[1]

  it('type_text and click act on the refs of a snapshot, say what has focus, and log without what was typed', async () => {
    const { broker, controller } = await connected()
    const tree = (await broker.ask('pageSnapshot', {})).text
    const title = refIn(tree, 'textbox "Title"')
    const save = refIn(tree, 'button "Save"')

    const typed = await broker.ask('typeText', { ref: title, text: 'Dune' })
    expect(typed).toEqual({ done: 'typed into textbox "Title"', focused: `textbox "Title" [ref=${title}]`, route: '/' })
    expect(document.querySelector('#title').value).toBe('Dune')

    expect((await broker.ask('click', { ref: save })).done).toBe('clicked button "Save"')
    expect(saved).toBe(1)
    expect(controller.activity.entries.slice(-2).map(({ tool, detail }) => ({ tool, detail }))).toEqual([
      { tool: 'type_text', detail: `${title} (4 characters)` },
      { tool: 'click', detail: save },
    ])
    await expect(broker.ask('click', {})).rejects.toThrow(/needs a ref/)
  })

  it('force (#2274): the answer lists what was overruled; a ref whose element is gone stays refused', async () => {
    const { broker, controller } = await connected()
    const button = document.querySelector('#save')
    button.setAttribute('aria-disabled', 'true')
    const save = refIn((await broker.ask('pageSnapshot', {})).text, 'button "Save"')

    await expect(broker.ask('click', { ref: save })).rejects.toThrow('button "Save" is disabled (force: true acts anyway)')
    const res = await broker.ask('click', { ref: save, force: true })
    expect(res).toMatchObject({ done: 'clicked button "Save"', forced: ['disabled'] })
    expect(saved).toBe(1)
    expect(controller.activity.entries.at(-1)).toMatchObject({ tool: 'click', detail: `${save} force` })

    button.remove()
    await expect(broker.ask('click', { ref: save, force: true })).rejects.toThrow(/no longer in the page/)
  })

  it('an action that opens a dialog says so, with its ref; the one that closes it says that too', async () => {
    const { broker } = await connected()
    document.querySelector('#save').addEventListener('click', () => {
      const dialog = document.createElement('div')
      dialog.setAttribute('role', 'dialog')
      dialog.setAttribute('aria-label', 'Unsaved changes')
      dialog.innerHTML = '<button id="stay">Stay</button>'
      dialog.querySelector('#stay').addEventListener('click', () => dialog.remove())
      document.body.appendChild(dialog)
    })
    const tree = (await broker.ask('pageSnapshot', {})).text

    const opening = await broker.ask('click', { ref: refIn(tree, 'button "Save"') })
    expect(opening.dialogOpened).toEqual([expect.stringMatching(/^dialog "Unsaved changes" \[ref=e\d+\]$/)])

    const dialog = opening.dialogOpened[0].match(/ref=(e\d+)/)[1]
    const stay = refIn((await broker.ask('pageSnapshot', { ref: dialog })).text, 'button "Stay"')
    const closing = await broker.ask('click', { ref: stay })
    expect(closing.dialogClosed).toEqual(['dialog "Unsaved changes"'])
    expect(closing.dialogOpened).toBeUndefined()
  })

  it('console_messages: failures since the tab connected, logs from the first call; level, pattern, clear', async () => {
    const { broker } = await connected()
    console.error('boom early')
    console.log('before anyone asked')

    const first = await broker.ask('consoleMessages', {})
    expect(first.messages.map((m) => [m.level, m.text])).toEqual([['error', 'boom early']])
    expect(first.note).toMatch(/from now on/)

    console.log('saved book 7')
    console.warn('slow list')
    expect((await broker.ask('consoleMessages', { level: 'errors', pattern: 'BOOM' })).messages.map((m) => m.text)).toEqual(['boom early'])
    expect((await broker.ask('consoleMessages', { clear: true })).messages.map((m) => m.text)).toEqual(['boom early', 'saved book 7', 'slow list'])
    console.info('after the clear')
    expect((await broker.ask('consoleMessages', {})).messages.map((m) => m.text)).toEqual(['after the clear'])
  })

  it('network_requests: fetch calls with their status; a failed one joins the feedback of an action', async () => {
    const { broker } = await connected(async (url) => ({ ok: !String(url).includes('missing'), status: String(url).includes('missing') ? 404 : 200 }))
    await window.fetch('/api/books')
    const mark = await broker.ask('feedbackMark')
    await window.fetch('/api/missing', { method: 'post' })

    expect((await broker.ask('feedbackSince', { mark })).failedRequests).toEqual([{ method: 'POST', url: '/api/missing', status: 404 }])
    const { requests } = await broker.ask('networkRequests', {})
    expect(requests.map(({ kind, method, url, status }) => ({ kind, method, url, status }))).toEqual([
      { kind: 'fetch', method: 'GET', url: '/api/books', status: 200 },
      { kind: 'fetch', method: 'POST', url: '/api/missing', status: 404 },
    ])
    expect((await broker.ask('networkRequests', { failedOnly: true })).requests).toHaveLength(1)
  })

  it('page_eval: an expression, statements, $ref, and elements handed back with their ref', async () => {
    const { broker } = await connected()
    const save = refIn((await broker.ask('pageSnapshot', {})).text, 'button "Save"')

    expect((await broker.ask('pageEval', { code: 'document.querySelector("h1").textContent' })).value).toBe('Books')
    expect((await broker.ask('pageEval', { code: 'const n = 21; return n * 2' })).value).toBe(42)
    expect((await broker.ask('pageEval', { code: `$ref("${save}").textContent` })).value).toBe('Save')
    expect((await broker.ask('pageEval', { code: 'document.querySelector("#save")' })).value).toBe(`(element button "Save" [ref=${save}])`)
    await expect(broker.ask('pageEval', { code: 'throw new Error("nope")' })).rejects.toThrow('nope')
  })

  it('navigate history: back goes back; with nowhere to go, it says so', async () => {
    const { broker } = await connected()
    window.history.pushState({}, '', '/books')
    window.history.pushState({}, '', '/books/7')
    await broker.ask('navigate', { history: 'back' })
    expect(window.location.pathname).toBe('/books')
    await expect(broker.ask('navigate', { history: 'sideways' })).rejects.toThrow(/back.*forward.*reload/)
  })
})

describe('relay connector — the relay knows where the tab is (#2317)', () => {
  afterEach(() => {
    delete window.__qdadm
    delete window.__qdadmRelayAuto
    vi.unstubAllGlobals()
    window.history.replaceState({}, '', '/')
  })

  const connectedAt = async (app) => {
    window.history.replaceState({}, '', '/')
    window.__qdadm = app
    window.__qdadmRelayAuto = '/__qdadm/relay.json'
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({ port: 47761, token: 'dev-token' }) }))
    const broker = new RelayBroker({ token: 'dev-token', identity: identity(47761) })
    const { controller } = install({ 47761: broker })
    await vi.waitFor(() => expect(controller.state.status).toBe('connected'))
    return broker
  }
  const locationOf = (broker) => broker.listSessions()[0].location

  /** A router like vue-router's: it writes the URL, then runs the afterEach hooks. */
  const withRouter = () => {
    const hooks = []
    const app = {
      router: {
        currentRoute: { value: { name: 'home', fullPath: '/', params: {} } },
        getRoutes: () => [],
        afterEach: (hook) => {
          hooks.push(hook)
          return () => {}
        },
      },
    }
    const go = (url) => {
      window.history.pushState({}, '', url)
      for (const hook of hooks) hook()
    }
    return { app, hooks, go }
  }

  // Connectors installed by earlier tests may hook the router too: `go` runs every hook, as the router would.
  it('an in-app navigation tells the relay the new page', async () => {
    const { app, hooks, go } = withRouter()
    const broker = await connectedAt(app)
    expect(hooks.length).toBeGreaterThan(0)
    expect(locationOf(broker)).toBe('/')

    go('/books/12/edit')

    await vi.waitFor(() => expect(locationOf(broker)).toBe('/books/12/edit'))
  })

  it('under hash routing the page is the route in the hash, not "/"', async () => {
    const { app, hooks, go } = withRouter()
    const broker = await connectedAt(app)
    expect(hooks.length).toBeGreaterThan(0)

    go('/#/books')

    await vi.waitFor(() => expect(locationOf(broker)).toBe('/#/books'))
  })

  it('without a router, back and forward still tell the relay', async () => {
    const broker = await connectedAt({})
    window.history.pushState({}, '', '/books')
    window.history.pushState({}, '', '/books/7')

    window.history.back()

    await vi.waitFor(() => expect(locationOf(broker)).toBe('/books'))
  })
})

describe('relay connector — page_snapshot says what the page is made of (#2342)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    delete window.__qdadm
    delete window.__qdadmRelayAuto
    vi.unstubAllGlobals()
  })

  /** A qdadm app on its books list: MainLayout wraps AppLayout, BookList is the page, two blocks in the header zone. */
  const booksApp = ({ levels = [] } = {}) => ({
    router: {
      currentRoute: {
        value: {
          name: 'book',
          fullPath: '/books',
          params: {},
          meta: { entity: 'books' },
          matched: [
            {
              instances: {
                default: {
                  $: {
                    type: { __name: 'MainLayout', __file: '/home/dev/demo/src/pages/MainLayout.vue' },
                    subTree: {
                      component: {
                        type: { __name: 'AppLayout', __file: '/home/dev/node_modules/@quazardous/qdadm/src/components/layout/AppLayout.vue' },
                        subTree: {},
                      },
                    },
                  },
                },
              },
            },
            { components: { default: { __name: 'BookList', __file: '/home/dev/demo/src/modules/books/pages/BookList.vue' } }, instances: {} },
          ],
        },
      },
      getRoutes: () => [],
    },
    orchestrator: {
      isRegistered: (name) => name === 'books',
      getRegisteredNames: () => ['books'],
      get: () => ({
        canList: () => true,
        canCreate: () => true,
        canUpdate: () => true,
        canDelete: () => false,
        _hasSecurityChecker: () => true,
        _getPermissionString: (action) => `entity:books:${action}`,
      }),
    },
    zones: {
      inspect: (zone) =>
        zone === 'books-list-header'
          ? { name: zone, blocks: [{ id: 'filter-genre', weight: 0, component: 'GenreFilter' }, { id: 'export-btn', weight: 10, component: 'ExportButton' }], default: null }
          : { name: zone, blocks: [], default: null },
    },
    activeStack: { getLevels: () => levels },
  })

  const PAGE = `
    <main>
      <h1>Books</h1>
      <div data-zone="books-list-header" class="qdadm-zone">
        <select aria-label="Genre"><option>sci-fi</option></select>
        <button>Export</button>
      </div>
      <div data-zone="books-list-empty" class="qdadm-zone"></div>
      <button>Add Book</button>
    </main>`

  const connectedTo = async (app, html = PAGE) => {
    document.body.innerHTML = html
    window.__qdadm = app
    window.__qdadmRelayAuto = '/__qdadm/relay.json'
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({ port: 47761, token: 'dev-token' }) }))
    const broker = new RelayBroker({ token: 'dev-token', identity: identity(47761) })
    const { controller } = install({ 47761: broker })
    await vi.waitFor(() => expect(controller.state.status).toBe('connected'))
    return broker
  }

  it('opens with the layout, the page component and its file, and what the user may do with the entity', async () => {
    const broker = await connectedTo(booksApp())
    const { text } = await broker.ask('pageSnapshot', {})
    const head = text.split('\n\n')[0].split('\n')

    expect(head[0]).toMatch(/^Page: .* — route book \(\/books\)$/)
    expect(head).toContain('Layout: MainLayout → AppLayout')
    expect(head).toContain('Component: BookList (src/modules/books/pages/BookList.vue)')
    expect(head).toContain('Entity: books — list ✓, create ✓, update ✓, delete ✗ (checks entity:books:<action>)')
  })

  it('a zone on screen is a line naming its blocks, with what it renders below it; an empty zone says nothing', async () => {
    const broker = await connectedTo(booksApp())
    const lines = (await broker.ask('pageSnapshot', {})).text.split('\n')
    const at = lines.findIndex((l) =>
      /^\s*- zone "books-list-header" \[blocks: filter-genre GenreFilter, export-btn ExportButton\] \[ref=e\d+\]:$/.test(l)
    )

    expect(at).toBeGreaterThan(-1)
    // What the zone renders sits one level below it; what follows the zone, at its level.
    const pad = lines[at].indexOf('-')
    expect(lines[at + 1]).toMatch(new RegExp(`^ {${pad + 2}}- combobox "Genre"`))
    expect(lines[at + 2]).toMatch(new RegExp(`^ {${pad + 2}}- button "Export"`))
    expect(lines.join('\n')).not.toContain('books-list-empty')
    expect(lines.find((l) => l.includes('button "Add Book"'))).toMatch(new RegExp(`^ {${pad}}- button "Add Book"`))
  })

  it('"interactive" and find say which zone an element sits in', async () => {
    const broker = await connectedTo(booksApp())
    const interactive = (await broker.ask('pageSnapshot', { filter: 'interactive' })).text

    expect(interactive).toMatch(/^- button "Export" \[ref=e\d+\] — in zone "books-list-header"$/m)
    expect(interactive).toMatch(/^- button "Add Book" \[ref=e\d+\]$/m)
    expect((await broker.ask('find', { text: 'Export' })).text).toContain('— in zone "books-list-header"')
  })

  it('meta: false gives the tree as before: no header, no zone lines', async () => {
    const broker = await connectedTo(booksApp())
    const { text } = await broker.ask('pageSnapshot', { meta: false })

    expect(text).toMatch(/^Page: /)
    expect(text).not.toContain('Layout:')
    expect(text).not.toContain('zone "')
    expect(text).toMatch(/^\s*- button "Export" \[ref=e\d+\]$/m)
  })

  it('an item page shows the active stack; an app without router, entity or zones still snapshots', async () => {
    const broker = await connectedTo(booksApp({ levels: [{ entity: 'books', id: '7' }, { entity: 'loans', id: 'l1' }] }))
    expect((await broker.ask('pageSnapshot', {})).text).toContain('Stack: books #7 › loans #l1')

    document.body.innerHTML = PAGE
    window.__qdadm = {}
    const bare = (await broker.ask('pageSnapshot', {})).text
    expect(bare.split('\n\n')[0]).toMatch(/^Page: [^\n]*$/)
    expect(bare).toContain('- button "Export"')
    expect(bare).toContain('zone "books-list-header" [ref=')
  })

  it('a zone that marks its blocks shows each block and the component behind it (#2363)', async () => {
    const app = booksApp()
    app.zones.getBlocks = (zone) =>
      zone === 'books-list-header'
        ? [
            { id: 'filter-genre', component: { __name: 'GenreFilter', __file: '/home/dev/demo/src/modules/books/components/GenreFilter.vue' } },
            // An async block, once loaded.
            { id: 'export-btn', component: { name: 'AsyncComponentWrapper', __asyncResolved: { __name: 'ExportButton', __file: '/home/dev/demo/src/modules/books/components/ExportButton.vue' } } },
          ]
        : []
    const broker = await connectedTo(
      app,
      `<main>
        <div data-zone="books-list-header" class="qdadm-zone">
          <div data-zone-block="filter-genre" style="display: contents"><select aria-label="Genre"><option>sci-fi</option></select></div>
          <div data-zone-block="export-btn" style="display: contents"><button>Export</button><span>CSV</span></div>
        </div>
      </main>`
    )
    const lines = (await broker.ask('pageSnapshot', {})).text.split('\n')
    const zoneAt = lines.findIndex((l) => /^\s*- zone "books-list-header" \[ref=e\d+\]:$/.test(l))
    const pad = lines[zoneAt]?.indexOf('-') ?? -1

    // The zone line drops its [blocks: …] summary: each block says what it is.
    expect(zoneAt).toBeGreaterThan(-1)
    expect(lines[zoneAt + 1]).toMatch(new RegExp(`^ {${pad + 2}}- block "filter-genre" \\[GenreFilter \\(src/modules/books/components/GenreFilter\\.vue\\)\\] \\[ref=e\\d+\\]`))
    expect(lines[zoneAt + 2]).toMatch(new RegExp(`^ {${pad + 4}}- combobox "Genre"`))
    expect(lines.join('\n')).toMatch(/- block "export-btn" \[ExportButton \(src\/modules\/books\/components\/ExportButton\.vue\)\] \[ref=e\d+\]:/)

    const interactive = (await broker.ask('pageSnapshot', { filter: 'interactive' })).text
    expect(interactive).toMatch(/^- button "Export" \[ref=e\d+\] — in zone "books-list-header", block "export-btn"$/m)
  })
})
