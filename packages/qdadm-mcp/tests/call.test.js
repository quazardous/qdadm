// @vitest-environment node
/**
 * `qdadm-mcp-relay --call` (#2263): one tool call from a shell, the answer printed, an exit code that says how it went.
 *
 * Run: npm test
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createQdadmMcpServer } from '../src/server.ts'
import { runCall } from '../src/relay/call.ts'

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64')
const AT = new Date(2026, 8, 11, 11, 22, 33)

const dirs = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const linked = async (server, name) => {
  const client = new Client({ name, version: '1' })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  return client
}

/** The relay's MCP server with one tab: it answers a snapshot and a screenshot, and fails what `failing` names. */
const relayServer = (failing = null) =>
  createQdadmMcpServer(
    {
      ask: async (type) => {
        if (type === failing) throw new Error('no tab answered')
        if (type === 'pageSnapshot') return { text: '- button "Save" [ref=e3]' }
        if (type === 'screenshot') return { data: PNG, mimeType: 'image/png', width: 10, height: 5, source: 'dom' }
        return {}
      },
      pickSession: () => ({ id: '34fcb409-1bfb-461c-963d-54014e8800e1', lastSeenAt: Date.now(), meta: { location: '/books' } }),
      listSessions: () => [],
      prefix: '/relay',
      pairing: { status: () => ({ waiting: [] }), accept: async () => ({}) },
    },
    { name: 'qdadm-relay' }
  )

async function call(tool, args, { failing } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'qdadm-call-'))
  dirs.push(cwd)
  const out = []
  const errs = []
  const code = await runCall(tool, args, {
    connectUpstream: () => linked(relayServer(failing), 'front'),
    cwd,
    now: () => AT,
    write: (text) => out.push(text),
    log: (message) => errs.push(message),
  })
  return { code, out: out.join('\n'), errs: errs.join('\n'), cwd }
}

describe('qdadm-mcp-relay --call (#2263)', () => {
  it('prints the tool\'s text answer and exits 0', async () => {
    const { code, out } = await call('page_snapshot', '{"filter":"interactive"}')

    expect(code).toBe(0)
    expect(out).toContain('- button "Save" [ref=e3]')
  })

  it('keeps a screenshot in the project like the agent\'s front, and says where', async () => {
    const { code, out, cwd } = await call('screenshot')

    expect(code).toBe(0)
    expect(out).toMatch(/Saved to \.aiball\/screenshots\/20260911-112233-34fcb409-books\.png/)
    expect(readdirSync(join(cwd, '.aiball', 'screenshots'))).toEqual(['20260911-112233-34fcb409-books.png'])
  })

  it('a tool that answers with an error exits 1, with the error printed', async () => {
    const { code, out } = await call('page_snapshot', '{}', { failing: 'pageSnapshot' })

    expect(code).toBe(1)
    expect(out).toContain('no tab answered')
  })

  it('arguments that are not a JSON object exit 2 before any call', async () => {
    for (const args of ['{filter: interactive}', '[1, 2]']) {
      const { code, errs } = await call('page_snapshot', args)
      expect(code).toBe(2)
      expect(errs).toMatch(/must be a JSON object/)
    }
  })

  it('closes its line to the relay once the call is done, so the process can exit', async () => {
    let upstream = null
    const cwd = mkdtempSync(join(tmpdir(), 'qdadm-call-'))
    dirs.push(cwd)

    const code = await runCall('instances', undefined, {
      connectUpstream: async () => {
        upstream = await linked(relayServer(), 'front')
        upstream.close = vi.fn(upstream.close.bind(upstream))
        return upstream
      },
      cwd,
      write: () => {},
      log: () => {},
    })

    expect(code).toBe(0)
    expect(upstream.close).toHaveBeenCalled()
  })

  it('an unknown tool exits 2 and lists the known ones', async () => {
    const { code, errs } = await call('snapshot_page')

    expect(code).toBe(2)
    expect(errs).toMatch(/unknown tool "snapshot_page" \(known: .*page_snapshot/)
  })
})
