// @vitest-environment node
/**
 * The machine relay for real (#2231), as `npm run dev` and the agent's front
 * start it: run file, one port for tabs and agents, an MCP endpoint no web
 * page may drive, a singleton, and a stdio front that never fails because the
 * relay is gone.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { findRunningRelay, readRunFile } from '../src/relay/runfile.ts'
import { createStdioFront } from '../src/relay/front.ts'

const BIN = fileURLToPath(new URL('../bin/qdadm-mcp-relay.mjs', import.meta.url))

let dir
let runFile
let relay
let logs = ''

const startRelay = () => {
  const child = spawn(process.execPath, [BIN], {
    env: { ...process.env, QDADM_RELAY_RUN: runFile },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (d) => (logs += d))
  child.stderr.on('data', (d) => (logs += d))
  return child
}
const exited = (child) => new Promise((resolve) => child.once('exit', (code) => resolve(code)))
const until = async (probe, timeoutMs = 8000) => {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await probe()
    if (value) return value
    if (Date.now() > deadline) throw new Error(`timed out — relay log:\n${logs}`)
    await new Promise((r) => setTimeout(r, 100))
  }
}
const mcpClient = async (port) => {
  const client = new Client({ name: 'daemon-test', version: '1' })
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)))
  return client
}
const inMemory = async (server) => {
  const client = new Client({ name: 'front-test', version: '1' })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  return client
}
const postMcp = (port, headers) =>
  new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path: '/mcp',
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
      },
      (res) => {
        res.resume()
        resolve(res.statusCode)
      }
    )
    req.on('error', reject)
    req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }))
  })

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'qdadm-relay-daemon-'))
  runFile = join(dir, '.qdadm_relay.run')
  relay = startRelay()
  await until(() => findRunningRelay(runFile))
}, 15000)

afterAll(async () => {
  if (relay.exitCode === null) {
    relay.kill('SIGTERM')
    await exited(relay)
  }
  rmSync(dir, { recursive: true, force: true })
})

describe('the machine relay (#2231)', () => {
  it('writes its run file and says who it is on its port', async () => {
    const info = readRunFile(runFile)
    expect(info.pid).toBe(relay.pid)
    const identity = await (await fetch(`http://127.0.0.1:${info.port}/identity`)).json()
    expect(identity).toMatchObject({ name: 'qdadm-mcp-relay', pid: relay.pid, port: info.port })
  })

  it('refuses its MCP endpoint to web pages', async () => {
    const { port } = readRunFile(runFile)
    expect(await postMcp(port, { origin: 'https://evil.example' })).toBe(403)
  })

  it('answers agent hooks on /chat/pending, never web pages; the Stop hook stays silent with nothing pending (#2252)', async () => {
    const { port } = readRunFile(runFile)
    const pending = (headers = {}) =>
      fetch(`http://127.0.0.1:${port}/chat/pending`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: '{"mark":false}' })
    expect((await pending({ origin: 'https://evil.example' })).status).toBe(403)
    expect(await (await pending()).json()).toEqual({ instances: [] })

    const hook = spawn(process.execPath, [BIN, '--chat-hook', 'stop'], {
      env: { ...process.env, QDADM_RELAY_RUN: runFile },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let out = ''
    hook.stdout.on('data', (d) => (out += d))
    hook.stdin.end(JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: false }))
    expect(await exited(hook)).toBe(0)
    expect(out).toBe('')
  })

  it('a tab with the token becomes an instance agents target — without naming it while alone', async () => {
    const info = readRunFile(runFile)
    const ws = new WebSocket(`ws://127.0.0.1:${info.port}/`, { origin: 'http://localhost:5174' })
    ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw))
      if (msg.kind === 'request') {
        ws.send(JSON.stringify({ kind: 'reply', id: msg.id, ok: true, data: { sessionId: 'tab-X', app: { name: 'Demo' } } }))
      }
    })
    await new Promise((r) => ws.once('open', r))
    ws.send(JSON.stringify({ kind: 'hello', token: info.token, sessionId: 'tab-X', meta: { app: 'Demo' } }))

    const client = await mcpClient(info.port)
    try {
      const listed = await until(async () => {
        const res = await client.callTool({ name: 'instances', arguments: {} })
        const data = JSON.parse(res.content[0].text)
        return data.instances.length === 1 ? data : null
      })
      expect(listed.instances[0]).toMatchObject({ instance: 'tab-X', app: 'Demo', via: 'token', connected: true })

      const res = await client.callTool({ name: 'session_info', arguments: {} })
      expect(JSON.parse(res.content[0].text).session.id).toBe('tab-X')
    } finally {
      await client.close()
      ws.close()
    }
  })

  it('stays the only relay: one started meanwhile leaves it the run file', async () => {
    const second = startRelay()
    expect(await exited(second)).toBe(0)
    expect(readRunFile(runFile).pid).toBe(relay.pid)
  })

  it('the stdio front forwards to it', async () => {
    const { port } = readRunFile(runFile)
    const front = createStdioFront({ resolveEndpoint: async () => new URL(`http://127.0.0.1:${port}/mcp`), log: () => {} })
    const client = await inMemory(front)
    try {
      const names = (await client.listTools()).tools.map((t) => t.name)
      expect(names).toEqual(expect.arrayContaining(['instances', 'session_info', 'pair_accept']))
      const res = await client.callTool({ name: 'instances', arguments: {} })
      expect(res.isError).toBeFalsy()
    } finally {
      await client.close()
    }
  })

  it('without a reachable relay the front still lists its tools, and calls fail with something to act on', async () => {
    const front = createStdioFront({
      resolveEndpoint: async () => {
        throw new Error('nothing listening')
      },
      log: () => {},
    })
    const client = await inMemory(front)
    try {
      expect((await client.listTools()).tools.map((t) => t.name)).toContain('session_info')
      const res = await client.callTool({ name: 'session_info', arguments: {} })
      expect(res.isError).toBe(true)
      expect(res.content[0].text).toMatch(/could not be reached or started \(nothing listening\)/)
    } finally {
      await client.close()
    }
  })

  it('on SIGTERM it removes its run file', async () => {
    relay.kill('SIGTERM')
    await exited(relay)
    expect(existsSync(runFile)).toBe(false)
  })
})
