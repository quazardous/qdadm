// @vitest-environment node
/**
 * `~/.qdadm_relay.run` (#2231): how the vite plugin and the agent's front find
 * the machine's relay — and why a file alone is never trusted.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  acquireRelayLock,
  findRunningRelay,
  readRunFile,
  releaseRelayLock,
  removeRunFile,
  runFilePath,
  writeRunFile,
} from '../src/relay/runfile.ts'

// Above Linux's pid_max: no process can have it.
const DEAD_PID = 2 ** 22 + 12345

let dir
const file = () => join(dir, '.qdadm_relay.run')
const info = (over = {}) => ({ pid: process.pid, port: 1, token: 't', startedAt: 0, cwd: '/x', log: null, ...over })

const serveIdentity = (identity) =>
  new Promise((resolve) => {
    const server = createServer((req, res) => res.end(JSON.stringify(identity)))
    server.listen(0, '127.0.0.1', () => resolve(server))
  })

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'qdadm-relay-runfile-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('relay run file (#2231)', () => {
  it('is readable by this user only — it carries the page token', () => {
    writeRunFile(info(), file())
    expect(readRunFile(file())).toEqual(info())
    expect(statSync(file()).mode & 0o777).toBe(0o600)
  })

  it('is removed only by the relay it describes', () => {
    writeRunFile(info({ pid: DEAD_PID }), file())
    removeRunFile(process.pid, file())
    expect(existsSync(file())).toBe(true)
    removeRunFile(DEAD_PID, file())
    expect(existsSync(file())).toBe(false)
  })

  it('a file whose process is dead is not a running relay', async () => {
    writeRunFile(info({ pid: DEAD_PID }), file())
    expect(await findRunningRelay(file())).toBeNull()
  })

  it('nor is a live process whose port answers as someone else', async () => {
    const stranger = await serveIdentity({ name: 'something-else' })
    const otherRelay = await serveIdentity({ name: 'qdadm-mcp-relay', pid: DEAD_PID })
    const itself = await serveIdentity({ name: 'qdadm-mcp-relay', pid: process.pid })
    try {
      writeRunFile(info({ port: stranger.address().port }), file())
      expect(await findRunningRelay(file())).toBeNull()

      writeRunFile(info({ port: otherRelay.address().port }), file())
      expect(await findRunningRelay(file())).toBeNull()

      writeRunFile(info({ port: itself.address().port }), file())
      expect(await findRunningRelay(file())).toMatchObject({ pid: process.pid })
    } finally {
      for (const s of [stranger, otherRelay, itself]) s.close()
    }
  })

  it('the lock keeps one relay; a dead holder does not block the next', () => {
    expect(acquireRelayLock(file())).toBe(true)

    writeFileSync(`${file()}.lock`, String(process.ppid)) // a live process holds it
    expect(acquireRelayLock(file())).toBe(false)

    writeFileSync(`${file()}.lock`, String(DEAD_PID)) // its holder died
    expect(acquireRelayLock(file())).toBe(true)

    releaseRelayLock(file())
    expect(existsSync(`${file()}.lock`)).toBe(false)
  })
})

describe('runFilePath — a relay on its own port is a relay of its own', () => {
  it('is the machine default when nothing is set', () => {
    expect(runFilePath({})).toBe(join(homedir(), '.qdadm_relay.run'))
  })

  it('is named after QDADM_RELAY_PORT, so two relays never share a file or a lock', () => {
    expect(runFilePath({ QDADM_RELAY_PORT: '50000' })).toBe(join(homedir(), '.qdadm_relay.50000.run'))
    expect(runFilePath({ QDADM_RELAY_PORT: '50001' })).not.toBe(runFilePath({ QDADM_RELAY_PORT: '50000' }))
  })

  it('lets QDADM_RELAY_RUN name the file outright', () => {
    expect(runFilePath({ QDADM_RELAY_RUN: '/tmp/here.run', QDADM_RELAY_PORT: '50000' })).toBe('/tmp/here.run')
  })

  it('refuses a port that is not one, rather than building a path out of it', () => {
    expect(() => runFilePath({ QDADM_RELAY_PORT: '../../evil' })).toThrow(/not a port number/)
  })
})
