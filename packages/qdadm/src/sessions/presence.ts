/**
 * The tab's heartbeat (#4336): every `interval` seconds while the tab is
 * visible and someone is signed in, with a tab id kept for the tab's life.
 * The others the server returns feed the "Also signed in" banner.
 */
import { ref, type Ref } from 'vue'
import type { SessionPresence, SessionsAdapter } from './sessionsAdapter'

const TAB_KEY = 'qdadm.sessions.tab'

/** One id per tab, kept across reloads of that tab (sessionStorage) */
export function tabId(): string {
  try {
    const known = sessionStorage.getItem(TAB_KEY)
    if (known) return known
  } catch {
    // No session storage: a fresh id per page
  }
  const id = globalThis.crypto?.randomUUID?.() ?? `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  try {
    sessionStorage.setItem(TAB_KEY, id)
  } catch {
    // Same
  }
  return id
}

export interface PresenceOptions {
  adapter: SessionsAdapter
  /** Seconds between beats */
  interval: number
  onOthers: (others: SessionPresence[]) => void
  /** A beat failed; logged once until one succeeds */
  onError?: (error: unknown) => void
}

export interface Presence {
  others: Ref<SessionPresence[]>
  running: Ref<boolean>
  start(): void
  stop(): void
  /** Beat now (the tab came back, a test) */
  beat(): Promise<void>
}

export function createPresence(options: PresenceOptions): Presence {
  const others = ref<SessionPresence[]>([])
  const running = ref(false)
  const tab = tabId()
  let timer: ReturnType<typeof setInterval> | null = null
  let failing = false

  const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'

  async function beat(): Promise<void> {
    if (!running.value || !visible()) return
    try {
      const res = await options.adapter.heartbeat(tab)
      failing = false
      if (!running.value) return // stopped while the beat was in flight
      others.value = res.others
      options.onOthers(res.others)
    } catch (err) {
      if (!failing) (options.onError ?? ((e) => console.warn('[qdadm] sessions heartbeat failed:', e)))(err)
      failing = true // the next tick retries
    }
  }

  function arm(): void {
    disarm()
    if (running.value && visible()) timer = setInterval(() => void beat(), options.interval * 1000)
  }

  function disarm(): void {
    if (timer) clearInterval(timer)
    timer = null
  }

  // Hidden: no beats; back: one at once, then the interval again
  function onVisibility(): void {
    if (!running.value) return
    if (visible()) {
      void beat()
      arm()
    } else {
      disarm()
    }
  }

  return {
    others,
    running,
    start() {
      if (running.value) return
      running.value = true
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
      void beat()
      arm()
    },
    stop() {
      running.value = false
      disarm()
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
      others.value = []
      options.onOthers([])
    },
    beat,
  }
}
