/**
 * Sliding-window render-loop detector (#1900 lot C.2).
 *
 * A runaway render loop throws nothing, so qdadm's error boundary cannot see
 * it: the app just stops responding while the bar re-renders forever. That is
 * what a consumer lived through, and their only exit was to rebuild without
 * the bar.
 *
 * This counts updates over a sliding window and says when the rate stops being
 * plausible. It is deliberately a plain object, not a composable: it holds no
 * reactive state, so counting can never itself schedule a render — which would
 * be a fine way to cause the loop it is meant to catch.
 *
 * The default of 60 updates per second is not a busy app. A bar following a
 * noisy signal bus settles well under it; sustained 60/s is a loop.
 */

/** How many updates in the window before we call it a loop. */
export const DEFAULT_MAX_UPDATES = 60
/** The window, in milliseconds. */
export const DEFAULT_WINDOW_MS = 1000

export interface RenderLoopDetector {
  /**
   * Record one update.
   * @returns true when the window is over budget — i.e. stop rendering.
   */
  record(now: number): boolean
  /** Updates currently inside the window. Exposed for the diagnostic message. */
  readonly count: number
}

export function createRenderLoopDetector(
  maxUpdates: number = DEFAULT_MAX_UPDATES,
  windowMs: number = DEFAULT_WINDOW_MS
): RenderLoopDetector {
  // Plain array on purpose: see the note above about reactive state.
  let stamps: number[] = []

  return {
    record(now: number): boolean {
      stamps.push(now)

      // Drop what left the window. Bounded by maxUpdates, so this stays cheap
      // even under the loop it is detecting.
      const cutoff = now - windowMs
      if (stamps.length > 0 && (stamps[0] as number) < cutoff) {
        stamps = stamps.filter((t) => t >= cutoff)
      }

      return stamps.length > maxUpdates
    },
    get count(): number {
      return stamps.length
    },
  }
}
