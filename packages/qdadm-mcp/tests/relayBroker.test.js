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
