/**
 * Per-record SSE subscriptions (#2664) — the tab's identity, shared by the
 * stream and the subscription calls.
 *
 * A detail page tells the backend which record it shows, so the stream carries
 * that record's changes to this tab only. The backend has to know which stream
 * a subscription belongs to, and the only thing both sides can name is the
 * tab: qdadm mints one id per browser tab, appends it to the stream URL, and
 * sends the same id with every subscription. One owner, so the two cannot
 * disagree.
 */

/** What the kernel hands to `useLiveEntity`: where to subscribe, and as which tab. */
export interface SseSubscriptions {
  url: string
  session: string
}

/** Injection key under which the kernel provides `SseSubscriptions` (or null). */
export const SSE_SUBSCRIPTIONS_KEY = 'qdadmSSESubscriptions'

const TAB_SESSION_KEY = 'qdadm:sse-session'

function mintId(): string {
  // randomUUID only exists in secure contexts; a plain-http deployment still needs an id.
  const c = typeof crypto !== 'undefined' ? crypto : null
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * This tab's id: kept in sessionStorage, so a reload is the same tab and a new
 * tab is a new one. Storage that throws (blocked site data) still yields an id,
 * valid for this page load.
 */
export function sseTabSession(): string {
  try {
    const existing = window.sessionStorage.getItem(TAB_SESSION_KEY)
    if (existing) return existing
    const id = mintId()
    window.sessionStorage.setItem(TAB_SESSION_KEY, id)
    return id
  } catch {
    return mintId()
  }
}

/** `url` with `name=value` added to its query string, before any fragment. */
export function withQueryParam(url: string, name: string, value: string): string {
  const [base, fragment] = url.split('#', 2)
  const param = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
  const joined = `${base}${base!.includes('?') ? '&' : '?'}${param}`
  return fragment === undefined ? joined : `${joined}#${fragment}`
}
