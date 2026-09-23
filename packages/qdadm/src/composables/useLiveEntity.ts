/**
 * useLiveEntity — reload a mounted screen when its entity changed elsewhere
 * (#1888 lot D, reported in #1887).
 *
 * Invalidating marks a cache stale; it does not repaint anything. A list that
 * is *already on screen* keeps its rows until the user navigates away and back
 * — which is precisely the case a pushing backend exists for: someone is
 * looking at the screen right now.
 *
 * There is no page-level opt-in, deliberately. The gate is upstream: only an
 * entity the app declared in `sse.entities` ever produces a remote event, so an
 * app with no live backend sees no behaviour change and has no flag to forget.
 * What the entity does about it is its own policy (`live` on the manager) —
 * which may differ per screen and per change kind (#2971); the page builders
 * only say which screen they are.
 *
 * @experimental Shape may change in a minor release — see docs/API_STABILITY.md.
 */

import { inject, onUnmounted, watch } from 'vue'
import type { SignalBus } from '../kernel/SignalBus'
import { useApiClient } from '../api/apiClient'
import type { HttpClient } from '../entity/storage/ApiStorage'
import { SSE_SUBSCRIPTIONS_KEY, type SseSubscriptions } from '../kernel/sseSubscriptions'

export interface UseLiveEntityOptions {
  /**
   * Only react to events carrying this record id. Detail screens pass their
   * own id: without it, changing one record reloads every open detail page.
   */
  id?: () => string | number | null | undefined
  /**
   * Called at once for every event that concerns this screen, before the
   * reload is coalesced (#2679) — for a cue that must not wait, like the
   * notification badge's flash.
   */
  onEvent?: () => void
  /**
   * Which screen this is, to pick its rule when the entity's `live.refresh`
   * is set per screen (#2971). Without it, a per-screen policy means `'mounted'`.
   */
  screen?: 'list' | 'show'
}

type RefreshRule = 'mounted' | false | string[]

interface LivePolicy {
  refresh?: RefreshRule | { list?: RefreshRule; show?: RefreshRule }
  coalesceMs?: number
}


/**
 * Subscribe the calling component to remote changes of `entityName`.
 *
 * @param entityName - entity to watch
 * @param manager - its manager, read for the `live` policy (may be null)
 * @param reload - what to run; coalesced, and never called while a previous
 *   call's promise is still pending — changes arriving meanwhile cause one more call
 * @returns unsubscribe function (also called automatically on unmount)
 */
export function useLiveEntity(
  entityName: string,
  // Taken as unknown and read defensively: the page composables carry
  // structural manager views (EntityManagerRead) that predate this policy.
  manager: unknown,
  reload: () => void | Promise<void>,
  options: UseLiveEntityOptions = {}
): () => void {
  const signals = inject<SignalBus | null>('qdadmSignals', null)
  if (!signals || !entityName) return () => {}

  const policy = (manager as { live?: LivePolicy } | null | undefined)?.live ?? {}
  const refresh = policy.refresh
  const rule: RefreshRule = refresh !== null && typeof refresh === 'object' && !Array.isArray(refresh)
    ? (options.screen ? refresh[options.screen] : undefined) ?? 'mounted'
    : refresh ?? 'mounted'
  // `false` — invalidation still happened upstream, the screen just does not
  // chase it. Subscribing would only burn a listener.
  if (rule === false) return () => {}
  // An array names the change kinds worth a reload (#2971).
  const kinds = Array.isArray(rule) ? new Set(rule) : null

  const coalesceMs = policy.coalesceMs ?? 300
  let timer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  // Never two reloads at once (#2666), as this composable promises: an event
  // arriving while one is in flight marks it dirty, and exactly one more runs
  // when it settles — no overlapping requests, and the last state lands.
  let inFlight = false
  let dirty = false

  const settle = (): void => {
    inFlight = false
    if (dirty && !disposed) {
      dirty = false
      run()
    }
  }

  // Only a reload that returns a promise is in flight: a synchronous one is done
  // when it returns. A failure — thrown or rejected — must not stop the next one;
  // the page reports its own load errors.
  const run = (): void => {
    let result: void | Promise<void>
    try {
      result = reload()
    } catch {
      return
    }
    if (result && typeof (result as Promise<void>).then === 'function') {
      inFlight = true
      ;(result as Promise<void>).then(settle, settle)
    }
  }

  const fire = (): void => {
    timer = null
    if (disposed) return
    if (inFlight) {
      dirty = true
      return
    }
    run()
  }

  const off = signals.on('entity:data-invalidate', (event: { name: string; data: unknown }) => {
    const payload = (event.data || {}) as {
      entity?: string
      id?: string | number
      action?: string
      source?: string
    }

    // Local writes are the manager's own echo: it has already repaired its
    // cache and the page that triggered the write reloads on its own path.
    if (payload.source !== 'remote') return
    if (payload.entity !== entityName) return

    if (options.id) {
      const watched = options.id()
      // An event carrying no id concerns the whole entity, so it always
      // applies; one carrying a different id is somebody else's record.
      if (
        watched != null &&
        payload.id !== undefined &&
        String(payload.id) !== String(watched)
      ) {
        return
      }
    }

    // A kind this screen ignores is not news to it: no cue, no reload. An event
    // carrying no kind is an update, as the live router reports it by default.
    if (kinds && !kinds.has(payload.action ?? 'updated')) return

    options.onEvent?.()

    // Coalesce: a backend replaying fifty rows must cost one reload, not fifty.
    if (coalesceMs <= 0) {
      fire()
      return
    }
    if (timer) return
    timer = setTimeout(fire, coalesceMs)
  })

  // Per-record subscription (#2664): a detail page asks the backend to send
  // this record's changes to this tab, for as long as it shows the record.
  const subscriptions = inject<SseSubscriptions | null>(SSE_SUBSCRIPTIONS_KEY, null)
  const apiClient = subscriptions && options.id ? useApiClient() : null
  const stopSubscription =
    subscriptions && apiClient && options.id
      ? followRecord(subscriptions, apiClient, entityName, options.id, inject<boolean>('qdadmDebug', false))
      : () => {}

  const stop = (): void => {
    disposed = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    off()
    stopSubscription()
  }

  onUnmounted(stop)

  return stop
}

/**
 * Keep a subscription to the record `id()` points at: POST when it is shown,
 * renew at half of `expires_in`, DELETE when it changes or the page leaves.
 *
 * Never throws into the page — without a subscription the page still works, it
 * just does not hear about changes. Failures are said in debug mode only.
 */
function followRecord(
  subscriptions: SseSubscriptions,
  api: HttpClient,
  entity: string,
  id: () => string | number | null | undefined,
  debug: boolean
): () => void {
  let current: string | null = null
  let renewTimer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const body = (recordId: string) => ({ session: subscriptions.session, entity, id: recordId })

  const report = (what: string, recordId: string, error: unknown): void => {
    if (!debug) return
    const status = (error as { response?: { status?: number } })?.response?.status
    const reason = status ?? (error as { message?: string })?.message ?? String(error)
    console.warn(`[qdadm] live subscription ${what} failed for ${entity} #${recordId} (${reason}) — the page will not update on its own`)
  }

  const clearRenewal = (): void => {
    if (renewTimer) clearTimeout(renewTimer)
    renewTimer = null
  }

  const subscribe = async (recordId: string, retryAfterMs: number | null = null): Promise<void> => {
    try {
      const { data } = await api.post<{ expires_in?: number }>(subscriptions.url, body(recordId))
      if (stopped || current !== recordId) return
      const seconds = Number(data?.expires_in)
      if (seconds > 0) renewTimer = setTimeout(() => void subscribe(recordId, (seconds * 1000) / 2), (seconds * 1000) / 2)
    } catch (error) {
      report('subscribe', recordId, error)
      // A renewal that fails is tried again at the same pace: the subscription is about to lapse.
      if (!stopped && current === recordId && retryAfterMs) {
        renewTimer = setTimeout(() => void subscribe(recordId, retryAfterMs), retryAfterMs)
      }
    }
  }

  const unsubscribe = (recordId: string): void => {
    api
      .request({ method: 'DELETE', url: subscriptions.url, data: body(recordId) })
      .catch((error: unknown) => report('unsubscribe', recordId, error))
  }

  const follow = (raw: string | number | null | undefined): void => {
    const next = raw == null || raw === '' ? null : String(raw)
    if (next === current) return
    clearRenewal()
    if (current) unsubscribe(current)
    current = next
    if (next) void subscribe(next)
  }

  const stopWatch = watch(id, follow, { immediate: true })

  return () => {
    if (stopped) return
    stopped = true
    stopWatch()
    clearRenewal()
    if (current) unsubscribe(current)
    current = null
  }
}
