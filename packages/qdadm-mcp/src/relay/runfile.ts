/**
 * The relay's run file (#2231) — how everyone finds THE relay of this machine.
 *
 * One relay serves every app and every tab of the user, so its whereabouts
 * live in one well-known place: `~/.qdadm_relay.run` (override with
 * `QDADM_RELAY_RUN`, or run a relay of your own with `QDADM_RELAY_PORT`). The
 * daemon writes it once listening and removes it on exit; the vite plugin and
 * the stdio front read it, and start a daemon when it is missing or stale.
 *
 * Mode 0600: it carries the page token that lets a dev tab join without a
 * pairing code, so only this user may read it.
 */
import { spawn } from 'node:child_process'
import { closeSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RelayIdentity } from '../protocol.ts'
import { relayPorts } from './ports.ts'

export interface RelayRunInfo {
  pid: number
  port: number
  /** Lets a dev-server tab join without a code. Never sent to a browser except by the dev server. */
  token: string
  startedAt: number
  cwd: string
  log: string | null
}

/** The relay CLI, resolved from this file — the same depth under src/ and dist/. */
export const RELAY_BIN = fileURLToPath(new URL('../../bin/qdadm-mcp-relay.mjs', import.meta.url))

/**
 * The file that says where the relay is.
 *
 * `QDADM_RELAY_RUN` names it outright. Otherwise a forced `QDADM_RELAY_PORT`
 * gets a file of its own, `~/.qdadm_relay.<port>.run`: a relay on its own
 * port is a relay of its own, so two projects can each run one — each with
 * its own run file, its own lock, and the tabs and agents that share its
 * variables — while `~/.qdadm_relay.run` stays the machine's default relay.
 */
export function runFilePath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.QDADM_RELAY_RUN) return env.QDADM_RELAY_RUN
  const forced = env.QDADM_RELAY_PORT?.trim()
  return join(homedir(), forced ? `.qdadm_relay.${relayPorts(env)[0]}.run` : '.qdadm_relay.run')
}

export function readRunFile(path = runFilePath()): RelayRunInfo | null {
  try {
    const v = JSON.parse(readFileSync(path, 'utf8'))
    return typeof v?.pid === 'number' && typeof v?.port === 'number' && typeof v?.token === 'string' ? v : null
  } catch {
    return null
  }
}

export function writeRunFile(info: RelayRunInfo, path = runFilePath()): void {
  writeFileSync(path, JSON.stringify(info, null, 2) + '\n', { mode: 0o600 })
}

/** Remove the run file — only if it still describes `pid` (a successor may have replaced it). */
export function removeRunFile(pid: number, path = runFilePath()): void {
  if (readRunFile(path)?.pid === pid) rmSync(path, { force: true })
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** Ask whatever listens on `port` whether it is a qdadm relay. */
export async function probeRelay(port: number, timeoutMs = 800): Promise<RelayIdentity | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/identity`, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const identity = (await res.json()) as RelayIdentity
    return identity?.name === 'qdadm-mcp-relay' ? identity : null
  } catch {
    return null
  }
}

/**
 * The running relay, verified three ways: the run file exists, its process
 * is alive, and the process answering on its port IS that relay. A crashed
 * relay leaves its file behind, and its port can be reused by anything.
 */
export async function findRunningRelay(path = runFilePath()): Promise<RelayRunInfo | null> {
  const info = readRunFile(path)
  if (!info || !isAlive(info.pid)) return null
  const identity = await probeRelay(info.port)
  return identity && identity.pid === info.pid ? info : null
}

export interface EnsureRelayOptions {
  /** The CLI to spawn (default: this package's bin). */
  bin?: string
  runFile?: string
  timeoutMs?: number
}

/**
 * Find the relay, or start one DETACHED: it outlives whoever started it — a
 * vite restart or an agent session ending leaves it serving the others.
 * Two callers racing both spawn; the daemon's own lock keeps one.
 */
export async function ensureRelay(options: EnsureRelayOptions = {}): Promise<{ info: RelayRunInfo; started: boolean }> {
  const path = options.runFile ?? runFilePath()
  const running = await findRunningRelay(path)
  if (running) return { info: running, started: false }

  const log = join(tmpdir(), 'qdadm-mcp-relay.log')
  // 0600 like the run file: other users of the machine have no business reading it.
  const out = openSync(log, 'a', 0o600)
  try {
    const child = spawn(process.execPath, [options.bin ?? RELAY_BIN, '--background'], {
      detached: true,
      stdio: ['ignore', out, out],
      env: { ...process.env, QDADM_RELAY_RUN: path, QDADM_RELAY_LOG: log },
    })
    child.unref()
  } finally {
    closeSync(out)
  }

  const timeoutMs = options.timeoutMs ?? 8000
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 150))
    const info = await findRunningRelay(path)
    if (info) return { info, started: true }
  }
  throw new Error(`qdadm-mcp-relay did not come up within ${timeoutMs} ms — see ${log}`)
}

/**
 * Hold the relay's singleton lock for this process's lifetime.
 * Returns false when another live relay holds it.
 */
export function acquireRelayLock(path = runFilePath()): boolean {
  const lock = `${path}.lock`
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(lock, 'wx', 0o600)
      writeFileSync(fd, String(process.pid))
      closeSync(fd)
      return true
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
      const holder = Number(readFileSync(lock, 'utf8').trim())
      if (holder && holder !== process.pid && isAlive(holder)) return false
      rmSync(lock, { force: true }) // stale: its holder died without cleaning up
    }
  }
  return false
}

export function releaseRelayLock(path = runFilePath()): void {
  const lock = `${path}.lock`
  try {
    if (Number(readFileSync(lock, 'utf8').trim()) === process.pid) rmSync(lock, { force: true })
  } catch {
    /* already gone */
  }
}
