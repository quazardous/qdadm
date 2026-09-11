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

describe('qdadm-mcp toolset — relay pairing (#2231)', () => {
  const withPairing = (overrides = {}) => ({
    ...makeApi(overrides),
    pairing: {
      status: vi.fn(() => ({ paired: { instanceId: 's1', origin: 'http://localhost:5174' }, waiting: [] })),
      accept: vi.fn((code) => ({ paired: { instanceId: 's1' }, code })),
    },
  })

  it('pairing tools exist on the relay only', () => {
    expect(buildToolset(makeApi()).map((t) => t.name)).not.toContain('pair_accept')
    const names = buildToolset(withPairing(), { readOnly: true }).map((t) => t.name)
    expect(names).toContain('pairing_status')
    expect(names).toContain('pair_accept')
  })

  it('pair_accept passes the code through; its description sends the agent to the human', async () => {
    const api = withPairing()
    const tool = byName(buildToolset(api), 'pair_accept')
    expect(tool.args.code.required).toBe(true)
    expect(tool.description).toMatch(/never guess/)
    await tool.handler({ code: '424 242' })
    expect(api.pairing.accept).toHaveBeenCalledWith('424 242')
  })

  it('session_info reports the pairing', async () => {
    const res = await byName(buildToolset(withPairing()), 'session_info').handler({})
    expect(res.pairing.paired.origin).toBe('http://localhost:5174')
    expect(res.session.id).toBe('s1')
  })

  it('no paired tab → the hint points at the MCP tab, not "open a browser"', async () => {
    const api = withPairing({ session: null })
    await expect(byName(buildToolset(api), 'routes').handler({})).rejects.toThrow(/MCP tab of the app's debug bar, click Pair/)
  })
})
