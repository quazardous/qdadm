// @vitest-environment jsdom
/**
 * The page side of pairing (#2231), driven against a REAL RelayBroker over an
 * in-memory socket pair: scan → code in the tab → pair_accept → requests
 * answered; reload → the same instance re-pairs; restarted relay → refused.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
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
    await vi.waitFor(() => expect(broker.pairing.status().paired.connected).toBe(false))
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
    await vi.waitFor(() => expect(broker.pairing.status().paired).toBeNull())
  })

  it('pairing another tab tells this one it was replaced', async () => {
    const broker = makeBroker()
    const { controller } = install({ 47761: broker })
    await pairWith(controller, broker)

    const intruder = new EventEmitter()
    intruder.send = (data) => {
      const msg = JSON.parse(data)
      if (msg.kind === 'pair-pending') setTimeout(() => broker.pairing.accept(msg.code), 0)
    }
    intruder.close = () => {}
    broker.attach(intruder, { origin: ORIGIN })
    intruder.emit('message', JSON.stringify({ kind: 'pair', instanceId: 'tab-2', meta: {} }))

    await vi.waitFor(() =>
      expect(controller.state).toMatchObject({ status: 'error', message: expect.stringMatching(/Another tab was paired/) })
    )
    expect(store.getItem('qdadm-relay:pairing')).toBeNull()
  })
})
