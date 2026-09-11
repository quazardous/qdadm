/**
 * Curated toolset contract (#1398) — session resolution, stamping, payload
 * mapping, readOnly gating. The broker is mocked; the MCP protocol layer is
 * exercised separately (plugin smoke on the demo).
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { buildToolset } from '../src/tools.ts'

function makeApi({ session = { id: 's1', lastSeenAt: Date.now(), meta: {} } } = {}) {
  return {
    ask: vi.fn(async (type, payload) => ({ echo: { type, payload } })),
    pickSession: vi.fn(() => session),
    listSessions: vi.fn(() => (session ? [{ id: session.id }] : [])),
    prefix: '/__qdadm',
  }
}

const byName = (tools, name) => tools.find((t) => t.name === name)

describe('qdadm-mcp toolset', () => {
  it('exposes the curated set, writes included by default', () => {
    const names = buildToolset(makeApi()).map((t) => t.name)
    expect(names).toEqual([
      'session_info',
      'boot_errors',
      'routes',
      'entity_state',
      'entity_list',
      'entity_get',
      'storage_dump',
      'recent_signals',
      'describe',
      'bridge_call',
      'instances',
      'entity_create',
      'entity_update',
      'entity_delete',
    ])
  })

  it('readOnly drops the three write tools', () => {
    const names = buildToolset(makeApi(), { readOnly: true }).map((t) => t.name)
    expect(names).not.toContain('entity_create')
    expect(names).not.toContain('entity_update')
    expect(names).not.toContain('entity_delete')
    expect(names).toContain('entity_list')
  })

  it('every response carries the session stamp', async () => {
    const api = makeApi()
    const res = await byName(buildToolset(api), 'routes').handler({})
    expect(res.session.id).toBe('s1')
    expect(typeof res.session.ageMs).toBe('number')
    expect(res.data.echo.type).toBe('routes')
  })

  it('maps entity tools onto entityCall payloads', async () => {
    const api = makeApi()
    const tools = buildToolset(api)

    await byName(tools, 'entity_list').handler({ entity: 'books', params: { page: 2 } })
    expect(api.ask).toHaveBeenLastCalledWith(
      'entityCall',
      { entity: 'books', op: 'list', params: { page: 2 } },
      's1'
    )

    await byName(tools, 'entity_update').handler({ entity: 'books', id: 7, data: { title: 'X' } })
    expect(api.ask).toHaveBeenLastCalledWith(
      'entityCall',
      { entity: 'books', op: 'update', id: 7, data: { title: 'X' } },
      's1'
    )
  })

  it('bridge_call forwards collector/action/args', async () => {
    const api = makeApi()
    await byName(buildToolset(api), 'bridge_call').handler({
      collector: 'signals',
      action: 'clear',
    })
    expect(api.ask).toHaveBeenLastCalledWith(
      'call',
      { collector: 'signals', action: 'clear', args: {} },
      's1'
    )
  })

  it('no connected session → actionable error with the sessions hint', async () => {
    const api = makeApi({ session: null })
    await expect(byName(buildToolset(api), 'session_info').handler({})).rejects.toThrow(
      /No connected browser session/
    )
    expect(api.ask).not.toHaveBeenCalled()
  })

  it('session arg is forwarded to pickSession', async () => {
    const api = makeApi()
    await byName(buildToolset(api), 'boot_errors').handler({ session: 'abc' })
    expect(api.pickSession).toHaveBeenCalledWith('abc')
  })
})

describe('qdadm-mcp toolset — instances (#2231)', () => {
  const withPairing = (overrides = {}) => ({
    ...makeApi(overrides),
    pairing: {
      status: vi.fn(() => ({ waiting: [{ instance: 'w1', origin: 'http://localhost:5174' }] })),
      accept: vi.fn((code) => ({ paired: { instance: 's1' }, code })),
    },
  })

  it('instances exists everywhere; pair_accept on the relay only', () => {
    const plain = buildToolset(makeApi()).map((t) => t.name)
    expect(plain).toContain('instances')
    expect(plain).not.toContain('pair_accept')
    expect(buildToolset(withPairing(), { readOnly: true }).map((t) => t.name)).toContain('pair_accept')
  })

  it('`instance` picks the target; the pre-#2231 `session` name still works; omitted means the default', async () => {
    const api = makeApi()
    const routes = byName(buildToolset(api), 'routes')

    await routes.handler({ instance: 'abc' })
    expect(api.pickSession).toHaveBeenLastCalledWith('abc')
    await routes.handler({ session: 'def' })
    expect(api.pickSession).toHaveBeenLastCalledWith('def')
    await routes.handler({})
    expect(api.pickSession).toHaveBeenLastCalledWith('latest')
  })

  it('instances lists them — with the tabs waiting to pair, on the relay', async () => {
    const plain = await byName(buildToolset(makeApi()), 'instances').handler({})
    expect(plain).toEqual({ instances: [{ id: 's1' }] })

    const relay = await byName(buildToolset(withPairing()), 'instances').handler({})
    expect(relay.waitingToPair).toEqual([{ instance: 'w1', origin: 'http://localhost:5174' }])
  })

  it('an ambiguous target reaches the agent as the broker worded it', async () => {
    const api = makeApi()
    api.pickSession = vi.fn(() => {
      throw new Error('relay: 2 instances are connected — pass instance')
    })
    await expect(byName(buildToolset(api), 'routes').handler({})).rejects.toThrow(/2 instances are connected/)
  })

  it('pair_accept passes the code through; its description sends the agent to the human', async () => {
    const api = withPairing()
    const tool = byName(buildToolset(api), 'pair_accept')
    expect(tool.args.code.required).toBe(true)
    expect(tool.description).toMatch(/never guess/)
    await tool.handler({ code: '424 242' })
    expect(api.pairing.accept).toHaveBeenCalledWith('424 242')
  })

  it('nothing connected on the relay → the hint names the dev server and the MCP tab', async () => {
    const api = withPairing({ session: null })
    await expect(byName(buildToolset(api), 'routes').handler({})).rejects.toThrow(
      /dev server.*MCP tab of the app's debug bar, click Pair/
    )
  })
})

describe('qdadm-mcp toolset — chat (#2231)', () => {
  const relayApi = () => ({ ...makeApi(), pairing: { status: vi.fn(() => ({ waiting: [] })), accept: vi.fn() } })

  it('chat_send and chat_read exist on the relay only', () => {
    expect(buildToolset(makeApi()).map((t) => t.name)).not.toContain('chat_send')
    const names = buildToolset(relayApi(), { readOnly: true }).map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(['chat_send', 'chat_read']))
  })

  it('chat_send posts the message to the targeted instance', async () => {
    const api = relayApi()
    const tools = buildToolset(api)
    await byName(tools, 'chat_send').handler({ instance: 's1', message: 'hello' })
    expect(api.ask).toHaveBeenLastCalledWith('chatPost', { message: 'hello' }, 's1')
    await byName(tools, 'chat_read').handler({})
    expect(api.ask).toHaveBeenLastCalledWith('chatRead', undefined, 's1')
  })
})
