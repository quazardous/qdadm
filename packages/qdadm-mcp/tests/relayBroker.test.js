// @vitest-environment node
/**
 * RelayBroker contract (#1400, #2231): many instances on one relay, targeted
 * by id or implicitly when alone; the token and pairing ways in; the reload
 * grace; codes that never reach the agent.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { RelayBroker } from '../src/relay/broker.ts'
import { buildToolset } from '../src/tools.ts'

const ORIGIN = 'http://localhost:5174'
const identity = { name: 'qdadm-mcp-relay', protocol: 2, project: 'demo', cwd: '/x/demo', port: 47761, pid: 1, startedAt: 0 }

class Tab extends EventEmitter {
  sent = []
  closed = false
  send(data) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    if (this.closed) return
    this.closed = true
    this.emit('close')
  }
  hello(token, sessionId, meta = {}) {
    this.emit('message', JSON.stringify({ kind: 'hello', token, sessionId, meta }))
  }
  pair(instanceId, pairingKey) {
    this.emit('message', JSON.stringify({ kind: 'pair', instanceId, pairingKey, meta: { location: '/books' } }))
  }
  replyTo(id, data) {
    this.emit('message', JSON.stringify({ kind: 'reply', id, ok: true, data }))
  }
  last(kind) {
    return [...this.sent].reverse().find((m) => m.kind === kind)
  }
}

const makeBroker = (options = {}) => {
  let n = 0
  let k = 0
  return new RelayBroker({
    token: 't1',
    identity,
    generateCode: () => ['424242', '515151', '606060'][n++ % 3],
    generateKey: () => `key-${++k}`,
    ...options,
  })
}

const connect = (broker, id, meta = {}, origin = ORIGIN) => {
  const tab = new Tab()
  broker.attach(tab, { origin })
  tab.hello('t1', id, meta)
  return tab
}

const pairTab = (broker, id) => {
  const tab = new Tab()
  broker.attach(tab, { origin: ORIGIN })
  tab.pair(id)
  const result = broker.pairing.accept(tab.last('pair-pending').code)
  return { tab, result }
}

const ids = (broker) => broker.listSessions().map((s) => s.instance).sort()

afterEach(() => vi.useRealTimers())

describe('RelayBroker — instances (#2231)', () => {
  it('announces itself first, so a tab can tell a qdadm relay from anything else on the port', () => {
    const tab = new Tab()
    makeBroker().attach(tab, { origin: ORIGIN })
    expect(tab.sent[0]).toEqual({ kind: 'relay-hello', ...identity })
  })

  it('rejects a bad token and registers nothing', () => {
    const broker = makeBroker()
    const tab = new Tab()
    broker.attach(tab, { origin: ORIGIN })
    tab.hello('WRONG', 'tab-A')

    expect(tab.last('error')).toEqual({ kind: 'error', error: 'bad token' })
    expect(broker.listSessions()).toEqual([])
  })

  it('a tab with the token is an instance; alone, tools target it without naming it', async () => {
    const broker = makeBroker()
    const tab = connect(broker, 'tab-A', { app: 'Book Manager', location: '/books' })

    expect(tab.last('welcome')).toEqual({ kind: 'welcome', sessionId: 'tab-A' })
    expect(broker.listSessions()).toEqual([
      expect.objectContaining({ instance: 'tab-A', app: 'Book Manager', origin: ORIGIN, via: 'token', connected: true }),
    ])
    expect(broker.pickSession(null).id).toBe('tab-A')

    const pending = broker.ask('routes')
    tab.replyTo(tab.last('request').id, ['ok'])
    await expect(pending).resolves.toEqual(['ok'])
  })

  it('several instances: an unnamed call lists them instead of guessing', async () => {
    const broker = makeBroker()
    connect(broker, 'tab-A', { app: 'Book Manager' })
    connect(broker, 'tab-B', { app: 'BMS' })

    expect(() => broker.pickSession(null)).toThrow(/2 instances are connected — pass instance.*tab-A.*Book Manager.*tab-B.*BMS/)
    await expect(broker.ask('routes')).rejects.toThrow(/2 instances are connected/)
  })

  it('an instance is named by its id, or a unique prefix of it', () => {
    const broker = makeBroker()
    connect(broker, 'aaaa1111-first')
    connect(broker, 'aaaa2222-second')
    connect(broker, 'bbbb3333-third')

    expect(broker.pickSession('bbbb3333-third').id).toBe('bbbb3333-third')
    expect(broker.pickSession('aaaa2222').id).toBe('aaaa2222-second')
    expect(() => broker.pickSession('aaaa')).toThrow(/no instance "aaaa" \(ambiguous prefix\)/)
    expect(() => broker.pickSession('cccc')).toThrow(/no instance "cccc"\. Instances: aaaa1111/)
  })

  it('the app name arrives once the app has booted', () => {
    const broker = makeBroker()
    const tab = connect(broker, 'tab-A')
    tab.emit('message', JSON.stringify({ kind: 'meta', meta: { app: 'Book Manager' } }))
    expect(broker.listSessions()[0].app).toBe('Book Manager')
  })

  it('a reload is a blip: tools say "reloading", then the same id comes back', async () => {
    const broker = makeBroker()
    connect(broker, 'tab-A').close()

    expect(broker.listSessions()[0].connected).toBe(false)
    await expect(broker.ask('routes')).rejects.toThrow(/most likely reloading; retry/)

    connect(broker, 'tab-A')
    expect(broker.listSessions()).toEqual([expect.objectContaining({ instance: 'tab-A', connected: true })])
  })

  it('a tab that does not come back is forgotten after the grace window', async () => {
    vi.useFakeTimers()
    const broker = makeBroker({ reloadGraceMs: 1000 })
    connect(broker, 'tab-A').close()

    await vi.advanceTimersByTimeAsync(1100)

    expect(broker.listSessions()).toEqual([])
    await expect(broker.ask('routes')).rejects.toThrow(/no app instance is connected/)
  })

  it('a connected instance wins over one still reloading', () => {
    const broker = makeBroker()
    connect(broker, 'tab-A')
    connect(broker, 'tab-B').close()
    expect(broker.pickSession(null).id).toBe('tab-A')
  })

  it('nothing connected: the error points at the dev server and the MCP tab', async () => {
    await expect(makeBroker().ask('routes')).rejects.toThrow(/dev server.*MCP tab of the app's debug bar/)
  })

  it('satisfies buildToolset end-to-end (session_info through the ws leg)', async () => {
    const broker = makeBroker()
    const tab = connect(broker, 'tab-C')

    const tool = buildToolset(broker).find((t) => t.name === 'session_info')
    const resP = tool.handler({})
    const req = tab.sent.find((m) => m.kind === 'request' && m.type === 'sessionInfo')
    tab.replyTo(req.id, { sessionId: 'tab-C', app: { name: 'X' } })

    const res = await resP
    expect(res.session.id).toBe('tab-C')
    expect(res.data.app.name).toBe('X')
  })

  it('timeout rejects and cleans the pending slot', async () => {
    vi.useFakeTimers()
    const broker = makeBroker({ timeoutMs: 50 })
    connect(broker, 'tab-D')
    const p = broker.ask('routes')
    const assertion = expect(p).rejects.toThrow(/timeout/)
    await vi.advanceTimersByTimeAsync(60)
    await assertion
  })
})

describe('RelayBroker — pairing (#2231)', () => {
  it('gives the code to the tab only — the agent cannot read it back', () => {
    const broker = makeBroker()
    const tab = new Tab()
    broker.attach(tab, { origin: ORIGIN })
    tab.pair('tab-1')

    expect(tab.last('pair-pending').code).toBe('424242')
    const status = broker.pairing.status()
    expect(status.waiting).toEqual([expect.objectContaining({ instance: 'tab-1', origin: ORIGIN, location: '/books' })])
    expect(JSON.stringify(status)).not.toContain('424242')
    expect(JSON.stringify(broker.listSessions())).not.toContain('424242')
  })

  it('a wrong code pairs nothing and says where codes come from', () => {
    const broker = makeBroker()
    const tab = new Tab()
    broker.attach(tab, { origin: ORIGIN })
    tab.pair('tab-1')

    expect(() => broker.pairing.accept('999999')).toThrow(/MCP tab of the app's debug bar, click Pair.*never guess one/)
    expect(broker.listSessions()).toEqual([])
    expect(tab.last('paired')).toBeUndefined()
  })

  it('the right code adds the tab as an instance, next to those already there', () => {
    const broker = makeBroker()
    const devTab = connect(broker, 'tab-A')
    const { tab, result } = pairTab(broker, 'tab-B')

    expect(tab.last('paired')).toEqual({ kind: 'paired', pairingKey: 'key-1', relay: identity })
    expect(ids(broker)).toEqual(['tab-A', 'tab-B'])
    expect(devTab.last('unpaired')).toBeUndefined()
    expect(result.next).toMatch(/pass instance: "tab-B"/)
  })

  it('accepts the code as read out loud — spaces and dashes are ignored', () => {
    const broker = makeBroker()
    const tab = new Tab()
    broker.attach(tab, { origin: ORIGIN })
    tab.pair('tab-1')
    broker.pairing.accept('424 242')
    expect(broker.listSessions()).toEqual([expect.objectContaining({ instance: 'tab-1', via: 'pairing' })])
  })

  it('a reload re-presents the pairing key and is the same instance again', () => {
    const broker = makeBroker()
    const { tab } = pairTab(broker, 'tab-1')
    const key = tab.last('paired').pairingKey
    tab.close()
    expect(broker.listSessions()[0].connected).toBe(false)

    const reloaded = new Tab()
    broker.attach(reloaded, { origin: ORIGIN })
    reloaded.pair('tab-1', key)

    expect(reloaded.last('paired').pairingKey).toBe(key)
    expect(broker.listSessions()).toEqual([expect.objectContaining({ instance: 'tab-1', connected: true })])
  })

  it('refuses a key it does not know — a restarted relay, or a forged one', () => {
    const tab = new Tab()
    makeBroker().attach(tab, { origin: ORIGIN })
    tab.pair('tab-1', 'key-from-another-life')
    expect(tab.last('pair-refused')).toMatchObject({ reason: 'unknown-pairing' })
  })

  it('refuses the right key from another origin', () => {
    const broker = makeBroker()
    const key = pairTab(broker, 'tab-1').tab.last('paired').pairingKey
    const impostor = new Tab()
    broker.attach(impostor, { origin: 'http://evil.localhost' })
    impostor.pair('tab-1', key)
    expect(impostor.last('pair-refused')).toMatchObject({ reason: 'unknown-pairing' })
  })

  it('unpair forgets the tab, and its key stops working', () => {
    const broker = makeBroker()
    const { tab } = pairTab(broker, 'tab-1')
    const key = tab.last('paired').pairingKey
    tab.emit('message', JSON.stringify({ kind: 'unpair' }))

    expect(broker.listSessions()).toEqual([])
    const later = new Tab()
    broker.attach(later, { origin: ORIGIN })
    later.pair('tab-1', key)
    expect(later.last('pair-refused')).toMatchObject({ reason: 'unknown-pairing' })
  })

  it('pairing needs a browser Origin, and honours --origin', () => {
    const noOrigin = new Tab()
    makeBroker().attach(noOrigin, {})
    noOrigin.pair('tab-1')
    expect(noOrigin.last('pair-refused')).toMatchObject({ reason: 'no-origin' })

    const other = new Tab()
    makeBroker({ allowedOrigins: ['https://app.example'] }).attach(other, { origin: ORIGIN })
    other.pair('tab-1')
    expect(other.last('pair-refused')).toMatchObject({ reason: 'origin-not-allowed' })
  })

  it('an unused code expires, and the tab is told', async () => {
    vi.useFakeTimers()
    const broker = makeBroker({ codeTtlMs: 1000 })
    const tab = new Tab()
    broker.attach(tab, { origin: ORIGIN })
    tab.pair('tab-1')
    await vi.advanceTimersByTimeAsync(1100)
    expect(tab.last('pair-refused')).toMatchObject({ reason: 'expired' })
    expect(() => broker.pairing.accept('424242')).toThrow(/No tab is waiting/)
  })
})
