/**
 * MCP registration layer contract (#1497) — exercised through a real MCP
 * client over an in-memory transport, so what we assert is exactly what an
 * agent sees: advertised JSON Schema (required declared), one-sentence
 * actionable validation errors (no raw zod dumps), entity-name enrichment,
 * and the boot_errors no-session guidance.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createQdadmMcpServer } from '../src/server.ts'

function makeApi({ session = { id: 's1', lastSeenAt: Date.now(), meta: {} } } = {}) {
  return {
    ask: vi.fn(async (type) =>
      type === 'entityState' ? { entities: ['books', 'genres'] } : { ok: true, type }
    ),
    pickSession: vi.fn(() => session),
    listSessions: vi.fn(() => (session ? [{ id: session.id }] : [])),
    prefix: '/__qdadm',
  }
}

async function connect(api, options = {}) {
  const server = createQdadmMcpServer(api, options)
  const client = new Client({ name: 'test', version: '0.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return client
}

describe('createQdadmMcpServer', () => {
  it('advertises the 13 tools with JSON Schema, required fields declared', async () => {
    const client = await connect(makeApi())
    const { tools } = await client.listTools()

    expect(tools).toHaveLength(13)
    const entityList = tools.find((t) => t.name === 'entity_list')
    expect(entityList.inputSchema.type).toBe('object')
    expect(entityList.inputSchema.required).toEqual(['entity'])
    expect(entityList.inputSchema.properties.entity.type).toBe('string')
    expect(entityList.inputSchema.properties.session.description).toMatch(/latest/)

    const entityGet = tools.find((t) => t.name === 'entity_get')
    expect(entityGet.inputSchema.required).toEqual(['entity', 'id'])
    expect(entityGet.inputSchema.properties.id.type).toEqual(['string', 'number'])
  })

  it('readOnly server does not advertise the write tools', async () => {
    const client = await connect(makeApi(), { readOnly: true })
    const names = (await client.listTools()).tools.map((t) => t.name)
    expect(names).toHaveLength(10)
    expect(names).not.toContain('entity_create')
  })

  it('missing required arg → one actionable sentence + registered entities', async () => {
    const client = await connect(makeApi())
    const res = await client.callTool({ name: 'entity_list', arguments: {} })

    expect(res.isError).toBe(true)
    const text = res.content[0].text
    expect(text).toBe(
      "Missing required argument 'entity': Entity name, as registered in the app. " +
        'Registered entities: books, genres.'
    )
    // no raw zod artifacts
    expect(text).not.toMatch(/invalid_type|"path"|"code"/)
  })

  it('missing entity with no session → falls back to pointing at entity_state', async () => {
    const client = await connect(makeApi({ session: null }))
    const res = await client.callTool({ name: 'entity_list', arguments: {} })

    expect(res.isError).toBe(true)
    expect(res.content[0].text).toMatch(/Call entity_state \(no arguments\)/)
  })

  it('wrong arg type → one actionable sentence', async () => {
    const client = await connect(makeApi())
    const res = await client.callTool({
      name: 'entity_get',
      arguments: { entity: 'books', id: true },
    })

    expect(res.isError).toBe(true)
    expect(res.content[0].text).toBe(
      "Invalid argument 'id': expected a string or number, got boolean."
    )
  })

  it('boot_errors with no session → blank-page guidance, not the generic advice', async () => {
    const client = await connect(makeApi({ session: null }))
    const res = await client.callTool({ name: 'boot_errors', arguments: {} })

    expect(res.isError).toBe(true)
    expect(res.content[0].text).toMatch(/even if it renders a blank page/)
    expect(res.content[0].text).toMatch(/Known sessions: \[\]/)
  })

  it('valid call flows through to the broker and returns the stamped payload', async () => {
    const api = makeApi()
    const client = await connect(api)
    const res = await client.callTool({
      name: 'entity_list',
      arguments: { entity: 'books', params: { page: 2 } },
    })

    expect(res.isError).toBeFalsy()
    const payload = JSON.parse(res.content[0].text)
    expect(payload.session.id).toBe('s1')
    expect(api.ask).toHaveBeenLastCalledWith(
      'entityCall',
      { entity: 'books', op: 'list', params: { page: 2 } },
      's1'
    )
  })

  it('unknown tool → actionable error listing available tools', async () => {
    const client = await connect(makeApi())
    const res = await client.callTool({ name: 'nope', arguments: {} })
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toMatch(/Unknown tool 'nope'\. Available tools: session_info/)
  })
})
