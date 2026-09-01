/**
 * The emergency switch for the debug bar (#1900 lot C.3).
 *
 * A consumer whose bar took down the app had to rebuild and redeploy to turn
 * it off. These tests pin the switch that removes that need.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isDebugBarKilled, DEBUG_BAR_KILL_KEY } from '../../src/kernel/debugBarKillSwitch'

function setSearch(search) {
  Object.defineProperty(window, 'location', {
    value: { search },
    writable: true,
    configurable: true,
  })
}

describe('debug bar kill switch', () => {
  beforeEach(() => {
    localStorage.clear()
    setSearch('')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is off by default — declaring nothing kills nothing', () => {
    expect(isDebugBarKilled()).toBe(false)
  })

  it('?qddebug=off kills the bar', () => {
    setSearch('?qddebug=off')

    expect(isDebugBarKilled()).toBe(true)
  })

  it('remembers the kill across loads, once the parameter is gone', () => {
    // This is the point of persisting: the first redirect must not undo the
    // switch, and a broken app is exactly where redirects happen.
    setSearch('?qddebug=off')
    isDebugBarKilled()

    setSearch('')
    expect(isDebugBarKilled()).toBe(true)
  })

  it('?qddebug=on lifts it, and the lift also sticks', () => {
    setSearch('?qddebug=off')
    isDebugBarKilled()

    setSearch('?qddebug=on')
    expect(isDebugBarKilled()).toBe(false)

    setSearch('')
    expect(isDebugBarKilled()).toBe(false)
  })

  it('ignores an unrelated value rather than guessing', () => {
    setSearch('?qddebug=maybe&other=1')

    expect(isDebugBarKilled()).toBe(false)
  })

  it('survives a localStorage that throws', () => {
    // Private mode, blocked cookies, quota. The switch must still hold for
    // this page load; only its memory is lost.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    setSearch('?qddebug=off')
    expect(isDebugBarKilled()).toBe(true)

    setSearch('')
    expect(isDebugBarKilled()).toBe(false)
  })

  it('uses a key under the qddebug namespace (ADR 0008)', () => {
    expect(DEBUG_BAR_KILL_KEY).toBe('qddebug:off')
  })
})
