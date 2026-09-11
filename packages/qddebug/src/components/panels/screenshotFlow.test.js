/**
 * The debug bar's 📷 (#2318): prompt for real screenshots first, then the annotator, then the chat.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { ScreenshotFlow } from './screenshotFlow'

const shot = { data: 'QUJD', mimeType: 'image/jpeg', width: 10, height: 5, source: 'dom' }

function source(overrides = {}) {
  return {
    canShoot: true,
    canCapture: true,
    captureActive: false,
    captureDeclined: false,
    shoot: vi.fn(async () => shot),
    startCapture: vi.fn(async () => {}),
    declineCapture: vi.fn(),
    sendChat: vi.fn(),
    ...overrides,
  }
}

function flowOf(src) {
  const events = { change: vi.fn(), sent: vi.fn() }
  return { flow: new ScreenshotFlow(src, events), events }
}

describe('ScreenshotFlow — the debug bar 📷 (#2318)', () => {
  it('is there only when the connector can take pictures', () => {
    expect(flowOf(source()).flow.available).toBe(true)
    expect(flowOf(source({ canShoot: false })).flow.available).toBe(false)
  })

  it('without a real capture, asks first, and takes no picture yet', async () => {
    const src = source()
    const { flow, events } = flowOf(src)

    await flow.start()

    expect(flow.step).toBe('prompt')
    expect(src.shoot).not.toHaveBeenCalled()
    expect(events.change).toHaveBeenCalled()
  })

  it('with a real capture running, opens the annotator at once', async () => {
    const src = source({ captureActive: true })
    const { flow } = flowOf(src)

    await flow.start()

    expect(src.shoot).toHaveBeenCalled()
    expect(flow.step).toBe('annotate')
    expect(flow.shot).toEqual(shot)
  })

  it('does not ask again once the user went on without, nor on a browser that cannot capture', async () => {
    for (const src of [source({ captureDeclined: true }), source({ canCapture: false })]) {
      const { flow } = flowOf(src)
      await flow.start()
      expect(flow.step).toBe('annotate')
    }
  })

  it('Allow starts the capture from the click, then takes the picture', async () => {
    const order = []
    const src = source({
      startCapture: vi.fn(async () => order.push('capture')),
      shoot: vi.fn(async () => (order.push('shoot'), shot)),
    })
    const { flow } = flowOf(src)
    await flow.start()

    await flow.allow()

    expect(order).toEqual(['capture', 'shoot'])
    expect(flow.step).toBe('annotate')
    expect(flow.error).toBeNull()
  })

  it('a refused share keeps the prompt open and says so: the user allows again, or continues without', async () => {
    const refused = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
    const src = source({ startCapture: vi.fn(async () => Promise.reject(refused)) })
    const { flow } = flowOf(src)
    await flow.start()

    await flow.allow()

    expect(flow.step).toBe('prompt')
    expect(flow.waiting).toBe(false)
    expect(flow.promptNote).toBe('Not shared. Allow again, or continue without.')
    expect(src.shoot).not.toHaveBeenCalled()

    await flow.continueWithout()
    expect(src.declineCapture).toHaveBeenCalled()
    expect(flow.step).toBe('annotate')
  })

  it('while the browser asks, the prompt stays open, and a second Allow does not ask twice', async () => {
    let grant
    const src = source({ startCapture: vi.fn(() => new Promise((resolve) => (grant = resolve))) })
    const { flow } = flowOf(src)
    await flow.start()

    const allowing = flow.allow()
    expect(flow.step).toBe('prompt')
    expect(flow.waiting).toBe(true)
    void flow.allow()
    expect(src.startCapture).toHaveBeenCalledTimes(1)

    grant()
    await allowing
    expect(flow.step).toBe('annotate')
  })

  it('Continue without while the browser still asks: that choice stands', async () => {
    let grant
    const src = source({ startCapture: vi.fn(() => new Promise((resolve) => (grant = resolve))) })
    const { flow } = flowOf(src)
    await flow.start()
    const allowing = flow.allow()

    await flow.continueWithout()
    expect(flow.step).toBe('annotate')

    grant()
    await allowing
    expect(flow.step).toBe('annotate')
    expect(src.shoot).toHaveBeenCalledTimes(1)
  })

  it('a capture started elsewhere while the prompt is open goes on with the real pixels', async () => {
    const src = source()
    const { flow } = flowOf(src)
    await flow.start()

    await flow.captureStarted()
    expect(flow.step).toBe('prompt')

    src.captureActive = true
    await flow.captureStarted()
    expect(flow.step).toBe('annotate')
  })

  it('Continue without remembers the choice and takes a rendered picture', async () => {
    const src = source()
    const { flow } = flowOf(src)
    await flow.start()

    await flow.continueWithout()

    expect(src.declineCapture).toHaveBeenCalled()
    expect(src.startCapture).not.toHaveBeenCalled()
    expect(flow.step).toBe('annotate')
  })

  it('Send posts the picture to the chat and tells the bar, which opens MCP → Chat', async () => {
    const src = source({ captureActive: true })
    const { flow, events } = flowOf(src)
    await flow.start()
    const image = { mimeType: 'image/jpeg', data: 'QUJD' }

    flow.send('circled', image)

    expect(src.sendChat).toHaveBeenCalledWith('circled', image)
    expect(events.sent).toHaveBeenCalledTimes(1)
    expect(flow.step).toBe('idle')
    expect(flow.shot).toBeNull()
  })

  it('Cancel closes the prompt or the annotator without sending anything', async () => {
    const src = source()
    const { flow, events } = flowOf(src)
    await flow.start()

    flow.cancel()

    expect(flow.step).toBe('idle')
    expect(src.sendChat).not.toHaveBeenCalled()
    expect(events.sent).not.toHaveBeenCalled()
  })

  it('a failed picture says why and goes back to idle', async () => {
    const src = source({ captureActive: true, shoot: vi.fn(async () => Promise.reject(new Error('snapdom failed'))) })
    const { flow } = flowOf(src)

    await flow.start()

    expect(flow.step).toBe('idle')
    expect(flow.error).toBe('No screenshot: snapdom failed')
  })

  it('a second click while one runs does nothing', async () => {
    const src = source()
    const { flow } = flowOf(src)
    await flow.start()

    await flow.start()

    expect(flow.step).toBe('prompt')
    expect(src.shoot).not.toHaveBeenCalled()
  })
})
