/**
 * The debug bar suspends itself rather than take the app down (#1900 lot C.2).
 *
 * These pin the sliding window: it must not cry loop over a busy-but-sane bar,
 * and it must catch a real one quickly.
 */
import { describe, it, expect } from 'vitest'
import {
  createRenderLoopDetector,
  DEFAULT_MAX_UPDATES,
  DEFAULT_WINDOW_MS,
} from './renderLoopDetector'

describe('render loop detector', () => {
  it('stays quiet for a single update', () => {
    const d = createRenderLoopDetector()

    expect(d.record(0)).toBe(false)
  })

  it('stays quiet at exactly the threshold', () => {
    const d = createRenderLoopDetector(10, 1000)
    let tripped = false

    for (let i = 0; i < 10; i++) tripped = d.record(i)

    expect(tripped).toBe(false)
    expect(d.count).toBe(10)
  })

  it('trips one update past the threshold', () => {
    const d = createRenderLoopDetector(10, 1000)
    for (let i = 0; i < 10; i++) d.record(i)

    expect(d.record(11)).toBe(true)
  })

  it('does not trip when the same count is spread beyond the window', () => {
    // The whole point of a sliding window: a bar that updates steadily for
    // minutes is not looping, however many updates it accumulates.
    const d = createRenderLoopDetector(10, 1000)
    let tripped = false

    // One update every 200ms for 20 seconds — 100 updates, never 5 in a window.
    for (let i = 0; i < 100; i++) tripped = d.record(i * 200)

    expect(tripped).toBe(false)
    expect(d.count).toBeLessThanOrEqual(10)
  })

  it('forgets what left the window', () => {
    const d = createRenderLoopDetector(10, 1000)
    for (let i = 0; i < 10; i++) d.record(i)
    expect(d.count).toBe(10)

    d.record(5000)

    expect(d.count).toBe(1)
  })

  it('trips on a burst that arrives after a quiet spell', () => {
    const d = createRenderLoopDetector(10, 1000)
    for (let i = 0; i < 100; i++) d.record(i * 200)

    let tripped = false
    for (let i = 0; i < 12; i++) tripped = d.record(20000 + i)

    expect(tripped).toBe(true)
  })

  it('does not trip a plausible bar at the shipped defaults', () => {
    // 20 updates per second on a noisy signal bus: busy, not looping.
    const d = createRenderLoopDetector()
    let tripped = false

    for (let i = 0; i < 200; i++) tripped = d.record(i * 50)

    expect(tripped).toBe(false)
  })

  it('trips a real loop at the shipped defaults, fast', () => {
    // The reported failure ran many renders per frame.
    const d = createRenderLoopDetector()
    let updates = 0

    while (!d.record(Math.floor(updates / 14) * 16)) {
      updates++
      if (updates > 5000) break
    }

    expect(updates).toBeLessThan(DEFAULT_MAX_UPDATES * 3)
    expect(DEFAULT_WINDOW_MS).toBe(1000)
  })
})
