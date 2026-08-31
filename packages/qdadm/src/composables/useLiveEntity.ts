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
 * What the entity does about it is its own policy (`live` on the manager).
 *
 * @experimental Shape may change in a minor release — see docs/API_STABILITY.md.
 */

import { inject, onUnmounted } from 'vue'
import type { SignalBus } from '../kernel/SignalBus'

export interface UseLiveEntityOptions {
  /**
   * Only react to events carrying this record id. Detail screens pass their
   * own id: without it, changing one record reloads every open detail page.
   */
  id?: () => string | number | null | undefined
}

interface LivePolicy {
  refresh?: 'mounted' | false
  coalesceMs?: number
}


/**
 * Subscribe the calling component to remote changes of `entityName`.
 *
 * @param entityName - entity to watch
 * @param manager - its manager, read for the `live` policy (may be null)
 * @param reload - what to run; coalesced, never called concurrently by us
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
  // `refresh: false` — invalidation still happened upstream, the screen just
  // does not chase it. Subscribing would only burn a listener.
  if (policy.refresh === false) return () => {}

  const coalesceMs = policy.coalesceMs ?? 300
  let timer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  const fire = (): void => {
    timer = null
    if (disposed) return
    void reload()
  }

  const off = signals.on('entity:data-invalidate', (event: { name: string; data: unknown }) => {
    const payload = (event.data || {}) as {
      entity?: string
      id?: string | number
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

    // Coalesce: a backend replaying fifty rows must cost one reload, not fifty.
    if (coalesceMs <= 0) {
      fire()
      return
    }
    if (timer) return
    timer = setTimeout(fire, coalesceMs)
  })

  const stop = (): void => {
    disposed = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    off()
  }

  onUnmounted(stop)

  return stop
}
