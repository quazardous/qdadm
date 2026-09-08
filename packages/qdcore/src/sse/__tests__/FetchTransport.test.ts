/**
 * Reading the SSE wire format ourselves (#2138).
 *
 * The point of this transport is not speed, it is that the end of a stream
 * becomes a FACT. `EventSource` can leave `readyState` at OPEN forever after
 * a proxy cut, with no `error` ever firing — measured on the bench in #1899 —
 * and a bridge that only listens to `onerror` then waits for a signal that
 * never comes.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { FetchTransport, parseFrame } from '../FetchTransport'
import type { StreamFrame } from '../transport'

/** A body that yields the chunks it is given, then ends. */
function bodyOf(chunks: string[], { hang = false } = {}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream({
    async pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++] as string))
        return
      }
      if (hang) return new Promise(() => {}) // never resolves: a live, silent stream
      controller.close()
    },
  })
}

function harness(chunks: string[], opts: { hang?: boolean; status?: number } = {}) {
  const frames: StreamFrame[] = []
  const errors: unknown[] = []
  let opened = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: (opts.status ?? 200) < 400,
      status: opts.status ?? 200,
      body: bodyOf(chunks, { hang: opts.hang }),
    }))
  )
  return {
    frames,
    errors,
    opened: () => opened,
    handlers: {
      onOpen: () => { opened++ },
      onFrame: (f: StreamFrame) => frames.push(f),
      onError: (e: unknown) => errors.push(e),
    },
  }
}

const settle = () => new Promise((r) => setTimeout(r, 20))

afterEach(() => vi.unstubAllGlobals())

describe('parsing the wire format', () => {
  it('reads a plain message', () => {
    expect(parseFrame('data: hello')).toEqual({ event: 'message', data: 'hello' })
  })

  it('reads a named event with an id', () => {
    expect(parseFrame('event: entity:updated\nid: 7\ndata: {"a":1}')).toEqual({
      event: 'entity:updated',
      data: '{"a":1}',
      lastEventId: '7',
    })
  })

  it('joins multi-line data with newlines, as the format says', () => {
    expect(parseFrame('data: one\ndata: two')?.data).toBe('one\ntwo')
  })

  it('strips exactly one space after the colon, not more', () => {
    expect(parseFrame('data:  padded')?.data).toBe(' padded')
  })

  it('returns nothing for a heartbeat comment', () => {
    // The frame that keeps proxies from timing out carries no data and must
    // not reach the bridge — but it DOES prove the stream is alive.
    expect(parseFrame(': heartbeat')).toBeNull()
  })

  it('returns nothing for a frame with no data field', () => {
    expect(parseFrame('event: ping')).toBeNull()
  })

  it('ignores retry, which is advice to a reconnection we do not use', () => {
    expect(parseFrame('retry: 5000\ndata: x')).toEqual({ event: 'message', data: 'x' })
  })
})

describe('the stream', () => {
  it('opens and delivers frames', async () => {
    const h = harness(['data: one\n\n', 'event: named\ndata: two\n\n'], { hang: true })
    new FetchTransport().open('/events', { withCredentials: false, eventNames: [] }, h.handlers)
    await settle()

    expect(h.opened()).toBe(1)
    expect(h.frames).toEqual([
      { event: 'message', data: 'one' },
      { event: 'named', data: 'two' },
    ])
  })

  it('delivers a named event without anyone registering the name', async () => {
    // EventSource needs addEventListener(name) or the event is lost. Parsing
    // the format ourselves removes that trap entirely.
    const h = harness(['event: entity:updated\ndata: {}\n\n'], { hang: true })
    const t = new FetchTransport()
    t.open('/events', { withCredentials: false, eventNames: [] }, h.handlers)
    await settle()

    expect(h.frames[0]?.event).toBe('entity:updated')
  })

  it('REPORTS THE END OF THE STREAM — the thing EventSource cannot', async () => {
    const h = harness(['data: last\n\n'])
    new FetchTransport().open('/events', { withCredentials: false, eventNames: [] }, h.handlers)
    await settle()

    expect(h.frames).toHaveLength(1)
    expect(h.errors).toHaveLength(1)
    expect(String(h.errors[0])).toContain('Stream ended')
  })

  it('reports a refused stream instead of pretending to be open', async () => {
    const h = harness([], { status: 401 })
    new FetchTransport().open('/events', { withCredentials: false, eventNames: [] }, h.handlers)
    await settle()

    expect(h.opened()).toBe(0)
    expect(String(h.errors[0])).toContain('401')
  })

  it('sends the headers this transport exists for', async () => {
    const h = harness([], { hang: true })
    const t = new FetchTransport({ headers: () => ({ Authorization: 'Bearer secret' }) })
    t.open('/events', { withCredentials: false, eventNames: [] }, h.handlers)
    await settle()

    const [, init] = (globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret')
    // And the URL stays clean — no credential in a query string, no access log.
    expect((globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]![0]).toBe('/events')
    t.close()
  })

  it('calls a silent stream dead once the idle budget passes', async () => {
    // The #1899 failure, caught: a socket cut with no error and no data. Time
    // since the last frame is the only signal that did not lie.
    const h = harness(['data: one\n\n'], { hang: true })
    const t = new FetchTransport({ idleTimeout: 40 })
    t.open('/events', { withCredentials: false, eventNames: [] }, h.handlers)
    await new Promise((r) => setTimeout(r, 90))

    expect(h.frames).toHaveLength(1)
    expect(String(h.errors[0])).toContain('No frame for 40ms')
  })

  it('a heartbeat keeps a quiet stream alive', async () => {
    const h = harness(['data: one\n\n', ': heartbeat\n\n'], { hang: true })
    const t = new FetchTransport({ idleTimeout: 60 })
    t.open('/events', { withCredentials: false, eventNames: [] }, h.handlers)
    await new Promise((r) => setTimeout(r, 40))

    // The comment delivered nothing, and still proved the stream was alive.
    expect(h.frames).toHaveLength(1)
    expect(h.errors).toHaveLength(0)
    t.close()
  })

  it('closing is not a failure', async () => {
    const h = harness(['data: one\n\n'], { hang: true })
    const t = new FetchTransport()
    t.open('/events', { withCredentials: false, eventNames: [] }, h.handlers)
    await settle()
    t.close()
    await settle()

    expect(h.errors).toHaveLength(0)
  })
})
