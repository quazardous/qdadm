/**
 * The emergency switch for the debug bar (#1900 lot C.3).
 *
 * A consumer whose debug bar took down the application it was observing had
 * no way to turn it off: they had to rebuild and redeploy. A diagnostic tool
 * that can only be disabled by a deploy fails exactly when it is needed.
 *
 * So the bar answers to a switch that needs no rebuild and no code change:
 *
 *   ?qddebug=off   turn it off, and REMEMBER that across navigations
 *   ?qddebug=on    turn it back on (clears the memory)
 *
 * The query parameter is the way in — it is the only thing reachable when the
 * app is unusable — and localStorage is what makes it stick, so the next page
 * load is survivable too. Without persistence the switch would be lost by the
 * first redirect, which is the moment a broken app is most likely to hit.
 *
 * This is a KILL switch, deliberately one-directional in effect: it can only
 * take the bar away, never conjure one that `enabled: false` refused. See
 * [[docs/adr/0011]] — the point of the switch is that it does something
 * observable, and `?qddebug=on` on an app with no bar configured stays a
 * no-op because there is nothing to turn on.
 */

/** localStorage key, under qddebug's existing `qddebug:` namespace (ADR 0008). */
const KILL_KEY = 'qddebug:off'

/** Read a key without letting a hostile storage throw into the boot path. */
function readFlag(): boolean {
  try {
    return localStorage.getItem(KILL_KEY) === '1'
  } catch {
    // Private mode, disabled cookies, quota. Absent, not fatal.
    return false
  }
}

function writeFlag(on: boolean): void {
  try {
    if (on) localStorage.setItem(KILL_KEY, '1')
    else localStorage.removeItem(KILL_KEY)
  } catch {
    // The switch still holds for THIS page load — the caller uses our return
    // value, not the storage. It just will not survive a reload.
  }
}

/**
 * Whether the debug bar has been killed for this browser.
 *
 * Reads the query parameter first (it is an explicit act, and it updates the
 * remembered state), then falls back to what was remembered.
 *
 * Safe to call before anything is mounted, and outside a browser.
 */
export function isDebugBarKilled(): boolean {
  if (typeof window === 'undefined') return false

  let param: string | null = null
  try {
    param = new URLSearchParams(window.location.search).get('qddebug')
  } catch {
    // Nothing readable in the URL; fall through to the remembered flag.
  }

  if (param === 'off') {
    writeFlag(true)
    return true
  }
  if (param === 'on') {
    writeFlag(false)
    return false
  }

  return readFlag()
}

/** Exported for tests and for an app that wants to offer its own switch. */
export const DEBUG_BAR_KILL_KEY = KILL_KEY
