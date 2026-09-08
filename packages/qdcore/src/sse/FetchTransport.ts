/**
 * The SSE wire format, read by us instead of by the browser (#2138).
 *
 * Same frames, same server — `data:`, `event:`, `id:`, `retry:`, comments as
 * heartbeats. What changes is who owns the read loop, and that ownership is
 * the whole point:
 *
 *   - headers are possible again, so a credential need not travel in the URL
 *     and from there into access logs (#1898);
 *   - the end of the stream is OBSERVABLE. `read()` resolving with
 *     `done: true` is a fact, where `EventSource` can leave `readyState` at
 *     OPEN forever with no `error` — measured on the proxy bench in #1899;
 *   - nothing reconnects behind our back, so a single-use token is never
 *     replayed.
 *
 * Deliberately NOT implemented here: reconnection. `SSEBridge` already owns
 * that policy, and duplicating it in the transport is how two half-policies
 * start disagreeing. This reports the end of a stream and stops.
 */
import type { StreamFrame, StreamHandlers, StreamOpenOptions, StreamTransport } from './transport'

export interface FetchTransportOptions {
  /**
   * Headers for the stream request — the reason this transport exists.
   * Called per connection, so a token can be refreshed without rebuilding it.
   */
  headers?: () => Record<string, string> | Promise<Record<string, string>>
  /**
   * Treat silence longer than this as a dead stream (ms, 0 disables).
   *
   * A cut connection does not always surface as an error: on the #1899 bench
   * a proxy killed the socket and the browser reported nothing at all. A
   * server that sends heartbeats gives us the only reliable liveness signal
   * there is — time since the last byte — so use it.
   */
  idleTimeout?: number
}

export class FetchTransport implements StreamTransport {
  readonly name = 'fetch'

  private _controller: AbortController | null = null
  private _idleTimer: ReturnType<typeof setTimeout> | null = null
  private _closed = false
  private readonly _headers: FetchTransportOptions['headers']
  private readonly _defaultIdleTimeout: number
  private _idleTimeout: number

  constructor(options: FetchTransportOptions = {}) {
    this._headers = options.headers
    this._defaultIdleTimeout = options.idleTimeout ?? 0
    this._idleTimeout = this._defaultIdleTimeout
  }

  open(url: string, options: StreamOpenOptions, handlers: StreamHandlers): void {
    this._closed = false
    // The bridge's budget wins; the constructor's is a default for direct use.
    this._idleTimeout = options.idleTimeout ?? this._defaultIdleTimeout
    const controller = new AbortController()
    this._controller = controller

    void this._run(url, options, handlers, controller)
  }

  /** Named events need no binding here: we parse `event:` and deliver it. */
  addEventName(): void {}

  close(): void {
    this._closed = true
    this._clearIdle()
    this._controller?.abort()
    this._controller = null
  }

  private _clearIdle(): void {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer)
      this._idleTimer = null
    }
  }

  private _bumpIdle(handlers: StreamHandlers): void {
    if (this._idleTimeout <= 0) return
    this._clearIdle()
    this._idleTimer = setTimeout(() => {
      if (this._closed) return
      // Not a guess: nothing has arrived for longer than the server's own
      // heartbeat interval allows, so the stream is gone whatever the socket
      // claims.
      this._fail(handlers, new Error(`No frame for ${this._idleTimeout}ms`))
    }, this._idleTimeout)
  }

  private _fail(handlers: StreamHandlers, reason: unknown): void {
    if (this._closed) return
    this._closed = true
    this._clearIdle()
    this._controller?.abort()
    this._controller = null
    handlers.onError(reason)
  }

  private async _run(
    url: string,
    options: StreamOpenOptions,
    handlers: StreamHandlers,
    controller: AbortController
  ): Promise<void> {
    try {
      const extra = this._headers ? await this._headers() : {}
      if (this._closed) return

      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'text/event-stream', ...extra },
        credentials: options.withCredentials ? 'include' : 'same-origin',
        signal: controller.signal,
        cache: 'no-store',
      })

      if (!response.ok || !response.body) {
        this._fail(handlers, new Error(`Stream refused with ${response.status}`))
        return
      }

      handlers.onOpen()
      this._bumpIdle(handlers)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      for (;;) {
        const { done, value } = await reader.read()

        // The fact EventSource cannot give us: the stream ended.
        if (done) {
          this._fail(handlers, new Error('Stream ended'))
          return
        }

        this._bumpIdle(handlers)
        buffer += decoder.decode(value, { stream: true })

        // Frames are separated by a blank line; \r\n\r\n is legal too.
        let split: number
        while ((split = findFrameEnd(buffer)) !== -1) {
          const raw = buffer.slice(0, split)
          buffer = buffer.slice(split).replace(/^(\r\n\r\n|\n\n|\r\r)/, '')
          const frame = parseFrame(raw)
          // A heartbeat is a comment and carries no data: it must reset the
          // idle timer, which it just did, and go no further.
          if (frame) handlers.onFrame(frame)
        }
      }
    } catch (error) {
      // An abort is us closing, not a failure.
      if (this._closed || (error as Error)?.name === 'AbortError') return
      this._fail(handlers, error)
    }
  }
}

/** Index of the blank line ending the first frame, or -1. */
function findFrameEnd(buffer: string): number {
  const candidates = [buffer.indexOf('\n\n'), buffer.indexOf('\r\n\r\n'), buffer.indexOf('\r\r')].filter(
    (i) => i !== -1
  )
  return candidates.length ? Math.min(...candidates) : -1
}

/** One raw frame to a StreamFrame, or null when it carries nothing. */
export function parseFrame(raw: string): StreamFrame | null {
  let event = 'message'
  let id: string | undefined
  const data: string[] = []
  let sawData = false

  for (const line of raw.split(/\r\n|\n|\r/)) {
    // A comment — `: heartbeat`. Nothing to deliver.
    if (line.startsWith(':')) continue

    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    // Exactly one leading space after the colon is part of the syntax.
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)

    if (field === 'event') event = value
    else if (field === 'id') id = value
    else if (field === 'data') {
      data.push(value)
      sawData = true
    }
    // `retry:` is the server's advice to the browser's own reconnection,
    // which we do not use — SSEBridge owns that policy.
  }

  if (!sawData) return null
  return { event, data: data.join('\n'), ...(id === undefined ? {} : { lastEventId: id }) }
}
