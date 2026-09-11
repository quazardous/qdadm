/**
 * The MCP tab's collector (#2231): it follows the relay connector's
 * controller, and never lets the pairing code out through the bridge.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { RelayCollector, findRelayController } from './RelayCollector'

function fakeController(initial = { status: 'idle' }) {
  let state = initial
  const listeners = new Set()
  return {
    get state() {
      return state
    },
    subscribe(listener) {
      listeners.add(listener)
      listener(state)
      return () => listeners.delete(listener)
    },
    pair: vi.fn(async () => {}),
    unpair: vi.fn(),
    emit(next) {
      state = next
      for (const listener of listeners) listener(next)
    },
    listeners,
  }
}

const awaitingCode = { status: 'awaiting-code', code: '424242', relay: { project: 'demo', port: 47761 } }

afterEach(() => {
  delete globalThis.__qdadmRelay
})

describe('RelayCollector — the MCP tab (#2231)', () => {
  it('follows the controller, and asks for attention while a code waits', () => {
    const controller = fakeController()
    globalThis.__qdadmRelay = controller
    const collector = new RelayCollector()
    const notified = vi.fn()
    collector.onNotify(notified)
    collector.install({})

    expect(collector.state.status).toBe('idle')
    expect(collector.getBadge()).toBe(0)

    controller.emit(awaitingCode)

    expect(collector.state.code).toBe('424242') // the panel shows it
    expect(collector.getBadge()).toBe(1)
    expect(notified).toHaveBeenCalled()
  })

  it('never lets the code out through the bridge: snapshot and the state action redact it', async () => {
    const controller = fakeController(awaitingCode)
    globalThis.__qdadmRelay = controller
    const collector = new RelayCollector()
    collector.install({})

    expect(JSON.stringify(collector.snapshot())).not.toContain('424242')
    expect(JSON.stringify(await collector.call('state'))).not.toContain('424242')
    expect(JSON.stringify(await collector.call('pair'))).not.toContain('424242')
    expect(collector.snapshot().state.status).toBe('awaiting-code')
  })

  it('pair and unpair drive the controller', async () => {
    const controller = fakeController()
    globalThis.__qdadmRelay = controller
    const collector = new RelayCollector()
    collector.install({})

    await collector.call('pair', { port: 47762 })
    expect(controller.pair).toHaveBeenCalledWith(47762)
    await collector.call('unpair')
    expect(controller.unpair).toHaveBeenCalled()
  })

  it('without the connector: no controller, and the tab says so', async () => {
    expect(findRelayController()).toBeNull()
    const collector = new RelayCollector()
    collector.install({})

    expect(collector.state.status).toBe('unavailable')
    await expect(collector.pair()).resolves.toBeUndefined()
  })

  it('stops listening when uninstalled', () => {
    const controller = fakeController()
    globalThis.__qdadmRelay = controller
    const collector = new RelayCollector()
    collector.install({})
    expect(controller.listeners.size).toBe(1)

    collector.uninstall()

    expect(controller.listeners.size).toBe(0)
  })
})
