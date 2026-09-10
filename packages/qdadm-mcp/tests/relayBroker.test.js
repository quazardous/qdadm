// @vitest-environment node
/**
 * RelayBroker contract (#1400): token pairing, session registry, ask
 * round-trip over the ws leg, and the DebugBrokerApi shape buildToolset
 * relies on.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { RelayBroker } from '../src/relay/broker.ts'
import { buildToolset } from '../src/tools.ts'

class FakeSocket extends EventEmitter {
  sent = []
  send(data) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    this.emit('close')
  }
  // page-side helpers
  hello(token, sessionId = 'page-1') {
    this.emit('message', JSON.stringify({ kind: 'hello', token, sessionId, meta: { ua: 'test' } }))
  }
  replyTo(id, data) {
    this.emit('message', JSON.stringify({ kind: 'reply', id, ok: true, data }))
  }
}

describe('RelayBroker', () => {
  it('rejects a bad token and never registers the session', () => {
    const events = []
    const broker = new RelayBroker({ token: 'good', onSession: (e, id) => events.push([e, id]) })
    const sock = new FakeSocket()
    broker.attach(sock)
    sock.hello('WRONG')

    expect(sock.sent[0]).toEqual({ kind: 'error', error: 'bad token' })
    expect(broker.listSessions()).toHaveLength(0)
    expect(events[0][0]).toBe('rejected')
  })

  it('registers on valid hello and answers ask() via the page reply', async () => {
    const broker = new RelayBroker({ token: 't1' })
    const sock = new FakeSocket()
    broker.attach(sock)
    sock.hello('t1', 'page-A')

    expect(broker.pickSession('latest').id).toBe('page-A')

    const pending = broker.ask('routes', undefined, 'page-A')
    const req = sock.sent.find((m) => m.kind === 'request')
    expect(req.type).toBe('routes')
    sock.replyTo(req.id, [{ name: 'book', path: '/books' }])

    await expect(pending).resolves.toEqual([{ name: 'book', path: '/books' }])
  })

  it('ask() without any page fails with the actionable fragment hint', async () => {
    const broker = new RelayBroker({ token: 't1' })
    await expect(broker.ask('routes')).rejects.toThrow(/#qdadm-relay/)
  })

  it('socket close drops the session', () => {
    const broker = new RelayBroker({ token: 't1' })
    const sock = new FakeSocket()
    broker.attach(sock)
    sock.hello('t1', 'page-B')
    expect(broker.listSessions()).toHaveLength(1)
    sock.close()
    expect(broker.listSessions()).toHaveLength(0)
  })

  it('satisfies buildToolset end-to-end (session_info through the ws leg)', async () => {
    const broker = new RelayBroker({ token: 't1' })
    const sock = new FakeSocket()
    broker.attach(sock)
    sock.hello('t1', 'page-C')

    const tool = buildToolset(broker).find((t) => t.name === 'session_info')
    const resP = tool.handler({})
    const req = sock.sent.find((m) => m.kind === 'request' && m.type === 'sessionInfo')
    sock.replyTo(req.id, { sessionId: 'page-C', app: { name: 'X' } })

    const res = await resP
    expect(res.session.id).toBe('page-C')
    expect(res.data.app.name).toBe('X')
  })

  it('timeout rejects and cleans the pending slot', async () => {
    vi.useFakeTimers()
    const broker = new RelayBroker({ token: 't1', timeoutMs: 50 })
    const sock = new FakeSocket()
    broker.attach(sock)
    sock.hello('t1', 'page-D')
    const p = broker.ask('routes')
    const assertion = expect(p).rejects.toThrow(/timeout/)
    await vi.advanceTimersByTimeAsync(60)
    await assertion
    vi.useRealTimers()
  })
})

describe('RelayBroker — pairing (#2231)', () => {
  const ORIGIN = 'http://localhost:5174'
  const identity = { name: 'qdadm-mcp-relay', protocol: 2, project: 'demo', cwd: '/x/demo', port: 47761, pid: 1, startedAt: 0 }

  class Tab extends FakeSocket {
    pair(instanceId = 'tab-1', pairingKey) {
      this.emit('message', JSON.stringify({ kind: 'pair', instanceId, pairingKey, meta: { location: '/books' } }))
    }
    last(kind) {
      return [...this.sent].reverse().find((m) => m.kind === kind)
    }
  }

  const makeBroker = (options = {}) => {
    let n = 0
    return new RelayBroker({
      token: 't1',
      identity,
      generateCode: () => ['424242', '515151', '606060'][n++ % 3],
      generateKey: () => `key-${n}`,
      ...options,
    })
  }

  const pairTab = (broker, instanceId = 'tab-1') => {
    const tab = new Tab()
    broker.attach(tab, { origin: ORIGIN })
    tab.pair(instanceId)
    broker.pairing.accept(tab.last('pair-pending').code)
    return tab
  }

  it('announces itself first, so a scan can tell a qdadm relay from anything else on the port', () => {
    const tab = new Tab()
    makeBroker().attach(tab, { origin: ORIGIN })
    expect(tab.sent[0]).toEqual({ kind: 'relay-hello', ...identity })
  })

  it('gives the code to the tab only — the agent cannot read it back', () => {
    const broker = makeBroker()
    const tab = new Tab()
    broker.attach(tab, { origin: ORIGIN })
    tab.pair()

    expect(tab.last('pair-pending').code).toBe('424242')
    const status = broker.pairing.status()
    expect(status.waiting).toEqual([expect.objectContaining({ instanceId: 'tab-1', origin: ORIGIN, location: '/books' })])
    expect(JSON.stringify(status)).not.toContain('424242')
  })

  it('a wrong code pairs nothing and tells the agent where the code comes from', () => {
    const broker = makeBroker()
    const tab = new Tab()
    broker.attach(tab, { origin: ORIGIN })
    tab.pair()

    expect(() => broker.pairing.accept('999999')).toThrow(/click "Pair MCP".*never guess one/)
    expect(broker.pairing.status().paired).toBeNull()
    expect(tab.last('paired')).toBeUndefined()
  })

  it('the right code pairs the tab, which every tool then targets over a token session', async () => {
    const broker = makeBroker()
    const tokenPage = new FakeSocket()
    broker.attach(tokenPage)
    tokenPage.hello('t1', 'token-page')

    const tab = pairTab(broker)
    expect(tab.last('paired')).toEqual({ kind: 'paired', pairingKey: 'key-1', relay: identity })
    // the token page spoke last, but the paired tab is the target
    tokenPage.emit('message', JSON.stringify({ kind: 'reply', id: 'nope', ok: true }))
    expect(broker.pickSession('latest').id).toBe('tab-1')

    const pending = broker.ask('routes')
    const req = tab.last('request')
    tab.replyTo(req.id, ['ok'])
    await expect(pending).resolves.toEqual(['ok'])
  })

  it('accepts the code as read out loud — spaces and dashes are ignored', () => {
    const broker = makeBroker()
    const tab = new Tab()
    broker.attach(tab, { origin: ORIGIN })
    tab.pair()
    broker.pairing.accept('424 242')
    expect(broker.pairing.status().paired.instanceId).toBe('tab-1')
  })

  it('a reload is a blip: tools say "reloading", then the tab comes back with its key', async () => {
    const broker = makeBroker()
    const tab = pairTab(broker)
    const key = tab.last('paired').pairingKey
    tab.close()

    expect(broker.pairing.status().paired.connected).toBe(false)
    await expect(broker.ask('routes')).rejects.toThrow(/most likely reloading; retry/)

    const reloaded = new Tab()
    broker.attach(reloaded, { origin: ORIGIN })
    reloaded.pair('tab-1', key)
    expect(reloaded.last('paired').pairingKey).toBe(key)
    expect(broker.pairing.status().paired.connected).toBe(true)
    expect(broker.pickSession('latest').id).toBe('tab-1')
  })

  it('refuses a key it does not know — a restarted relay, or a forged one', () => {
    const tab = new Tab()
    makeBroker().attach(tab, { origin: ORIGIN })
    tab.pair('tab-1', 'key-from-another-life')
    expect(tab.last('pair-refused')).toMatchObject({ reason: 'unknown-pairing' })
  })

  it('refuses the right key from another origin', () => {
    const broker = makeBroker()
    const key = pairTab(broker).last('paired').pairingKey
    const impostor = new Tab()
    broker.attach(impostor, { origin: 'http://evil.localhost' })
    impostor.pair('tab-1', key)
    expect(impostor.last('pair-refused')).toMatchObject({ reason: 'unknown-pairing' })
  })

  it('one paired tab at a time: pairing another tells the first it is replaced', () => {
    const broker = makeBroker()
    const first = pairTab(broker, 'tab-1')
    pairTab(broker, 'tab-2')

    expect(first.last('unpaired')).toEqual({ kind: 'unpaired', reason: 'replaced' })
    expect(broker.pairing.status().paired.instanceId).toBe('tab-2')
    expect(broker.listSessions().map((s) => s.id)).toEqual(['tab-2'])
  })

  it('unpair from the tab forgets the pairing', async () => {
    const broker = makeBroker()
    const tab = pairTab(broker)
    tab.emit('message', JSON.stringify({ kind: 'unpair' }))
    expect(broker.pairing.status().paired).toBeNull()
    await expect(broker.ask('routes')).rejects.toThrow(/no tab is paired/)
  })

  it('pairing needs a browser Origin, and honours --origin', () => {
    const noOrigin = new Tab()
    makeBroker().attach(noOrigin, {})
    noOrigin.pair()
    expect(noOrigin.last('pair-refused')).toMatchObject({ reason: 'no-origin' })

    const other = new Tab()
    makeBroker({ allowedOrigins: ['https://app.example'] }).attach(other, { origin: ORIGIN })
    other.pair()
    expect(other.last('pair-refused')).toMatchObject({ reason: 'origin-not-allowed' })
  })

  it('an unused code expires, and the tab is told', async () => {
    vi.useFakeTimers()
    const broker = makeBroker({ codeTtlMs: 1000 })
    const tab = new Tab()
    broker.attach(tab, { origin: ORIGIN })
    tab.pair()
    await vi.advanceTimersByTimeAsync(1100)
    expect(tab.last('pair-refused')).toMatchObject({ reason: 'expired' })
    expect(() => broker.pairing.accept('424242')).toThrow(/No tab is waiting/)
    vi.useRealTimers()
  })
})
