/**
 * The vite debug bridge keeps a tab's identity across reloads (#2231).
 *
 * Measured before: every load minted a new session id, and a tab that said
 * bye vanished at once — an agent's target changed on every F5, and a request
 * sent mid-reload waited out its timeout to report "no session".
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { qdadmDebugPlugin } from '../../src/vite/qdadmDebugPlugin'

function boot(options = {}) {
  const plugin = qdadmDebugPlugin({ timeoutMs: 10, ...options })
  const handlers = {}
  const server = {
    ws: { on: (event, cb) => { handlers[event] = cb }, send: vi.fn() },
    middlewares: { use: vi.fn() },
  }
  plugin.configureServer(server)
  return { api: plugin.api, server, push: (msg) => handlers['qdadm:debug:push'](msg) }
}

afterEach(() => vi.useRealTimers())

describe('qdadmDebugPlugin — a reload is the same session (#2231)', () => {
  it('the injected client keeps its session id in sessionStorage', () => {
    const [tag] = qdadmDebugPlugin().transformIndexHtml.handler()
    expect(tag.children).toContain("sessionStorage.getItem('qdadm-debug:session')")
  })

  it('a tab that said bye stays known, and a request to it answers "reloading" at once', async () => {
    const { api, server, push } = boot()
    push({ type: 'hello', sessionId: 'tab-1', meta: {} })
    push({ type: 'bye', sessionId: 'tab-1' })

    expect(api.pickSession('latest').id).toBe('tab-1')
    expect(api.listSessions()).toEqual([expect.objectContaining({ id: 'tab-1', connected: false })])
    await expect(api.ask('sessionInfo', undefined, 'tab-1')).rejects.toThrow(/most likely reloading/)
    expect(server.ws.send).not.toHaveBeenCalled()
  })

  it('the reloaded tab comes back under the same id and is served', () => {
    const { api, server, push } = boot()
    push({ type: 'hello', sessionId: 'tab-1', meta: {} })
    push({ type: 'bye', sessionId: 'tab-1' })
    push({ type: 'hello', sessionId: 'tab-1', meta: {} })

    expect(api.listSessions()).toEqual([expect.objectContaining({ id: 'tab-1', connected: true })])
    api.ask('sessionInfo', undefined, 'tab-1').catch(() => {})
    expect(server.ws.send).toHaveBeenCalledWith('qdadm:debug:request', expect.objectContaining({ sessionId: 'tab-1' }))
  })

  it('a connected tab is preferred over one still reloading, even an older one', () => {
    const { api, push } = boot()
    push({ type: 'hello', sessionId: 'tab-2', meta: {} })
    push({ type: 'hello', sessionId: 'tab-1', meta: {} })
    push({ type: 'bye', sessionId: 'tab-1' })

    expect(api.pickSession('latest').id).toBe('tab-2')
  })

  it('past the grace window a gone tab is forgotten', () => {
    vi.useFakeTimers()
    const { api, push } = boot({ reloadGraceMs: 1000 })
    push({ type: 'hello', sessionId: 'tab-1', meta: {} })
    push({ type: 'bye', sessionId: 'tab-1' })

    vi.advanceTimersByTime(1500)

    expect(api.pickSession('latest')).toBeNull()
  })
})
