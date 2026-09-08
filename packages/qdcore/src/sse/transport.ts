/**
 * The seam between "a stream of frames" and how the browser gets them (#2138).
 *
 * `SSEBridge` used to hold an `EventSource` directly, which quietly made three
 * of that API's limitations into qdadm's:
 *
 *   - it cannot send headers, so a credential had to travel in the URL, and
 *     from there into access logs (#1898);
 *   - it owns the read loop, so a stream can die while `readyState` still says
 *     OPEN and no `error` ever fires — measured on a proxy bench in #1899;
 *   - it reconnects on its own, and with a single-use ticket that reconnection
 *     replays a spent URL, so it can neither be relied on nor prevented.
 *
 * Everything above this interface — signals, named events, the reconnect
 * policy, entity routing — is transport-agnostic, as
 * [ADR 0009](../../../qdadm/docs/adr/0009-live-entities.md) point 6 required
 * before any of this was written.
 */

/** One frame off the wire, before qdadm decides what it means. */
export interface StreamFrame {
  /** The `event:` field, or `message` when the server sent none. */
  event: string
  /** The `data:` payload, still a string — parsing belongs to the caller. */
  data: string
  /** The `id:` field, when the server sent one. */
  lastEventId?: string
}

/** What a transport reports back. Exactly three things happen to a stream. */
export interface StreamHandlers {
  onOpen(): void
  onFrame(frame: StreamFrame): void
  /**
   * The stream is over and will not resume by itself.
   *
   * A transport must NOT call this for a hiccup it is going to recover from
   * silently: the caller treats it as "this connection is finished", and
   * reconnecting is the caller's decision.
   */
  onError(reason?: unknown): void
}

export interface StreamOpenOptions {
  withCredentials: boolean
  /**
   * Treat silence longer than this as a dead stream (ms, 0 disables).
   *
   * The reason it lives in the TRANSPORT and not in `SSEBridge`: only the
   * transport knows what counts as a sign of life. A server's heartbeat is an
   * SSE comment, which carries no data and therefore never becomes a frame —
   * a watchdog placed above this line would never see it and would kill a
   * quiet but healthy stream.
   *
   * What each transport can actually watch differs, and the difference
   * matters (see each implementation).
   */
  idleTimeout?: number
  /**
   * Event names the caller wants delivered.
   *
   * A transport that receives every frame regardless — anything parsing the
   * wire format itself — may ignore this. `EventSource` cannot: it only
   * delivers a named event to a listener registered for that exact name, which
   * is why `addEventName` exists at all.
   */
  eventNames: Iterable<string>
}

export interface StreamTransport {
  open(url: string, options: StreamOpenOptions, handlers: StreamHandlers): void
  /** Deliver this name too, on the connection that is already open. */
  addEventName(name: string): void
  close(): void
  readonly name: string
}

/**
 * The browser's own `EventSource`. The default, and the behaviour qdadm has
 * always had — extracted here unchanged rather than improved, so that
 * swapping the transport is measurable against something that did not move.
 */
export class EventSourceTransport implements StreamTransport {
  readonly name = 'EventSource'

  private _source: EventSource | null = null
  private _handlers: StreamHandlers | null = null
  private _bound = new Set<string>()
  private _idleTimeout = 0
  private _idleTimer: ReturnType<typeof setTimeout> | null = null

  open(url: string, options: StreamOpenOptions, handlers: StreamHandlers): void {
    this._handlers = handlers
    this._bound.clear()
    this._idleTimeout = options.idleTimeout ?? 0

    const source = new EventSource(url, { withCredentials: options.withCredentials })
    this._source = source

    source.onopen = (): void => {
      this._bumpIdle()
      handlers.onOpen()
    }
    source.onerror = (): void => {
      this._clearIdle()
      handlers.onError()
    }
    source.onmessage = (event: MessageEvent): void => {
      this._bumpIdle()
      handlers.onFrame({
        event: 'message',
        data: event.data as string,
        lastEventId: event.lastEventId,
      })
    }

    for (const name of options.eventNames) this.addEventName(name)
  }

  addEventName(name: string): void {
    const source = this._source
    const handlers = this._handlers
    if (!source || !handlers) return
    // Binding twice would deliver each event several times, and read as a
    // burst from the server.
    if (this._bound.has(name)) return
    this._bound.add(name)

    source.addEventListener(name, (event) => {
      const message = event as MessageEvent
      this._bumpIdle()
      handlers.onFrame({
        event: name,
        data: message.data as string,
        lastEventId: message.lastEventId,
      })
    })
  }

  close(): void {
    this._clearIdle()
    this._source?.close()
    this._source = null
    this._handlers = null
    this._bound.clear()
  }

  /**
   * The watchdog, and its honest limit.
   *
   * A proxy that kills the socket can leave `readyState` at OPEN with no
   * `error` ever firing — measured in #1899 — so the only remaining evidence
   * is that nothing arrives. But `EventSource` never surfaces the server's
   * heartbeat: a comment line is consumed by the browser and produces no
   * event. This watchdog therefore counts DATA frames only, and on a stream
   * that is legitimately quiet between real events it would fire wrongly.
   *
   * So it is off unless asked for, and the budget must be chosen against how
   * often the server actually sends DATA — not against its heartbeat
   * interval. A transport that reads the wire itself (`FetchTransport`) sees
   * the heartbeats and does not have this limitation.
   */
  private _bumpIdle(): void {
    if (this._idleTimeout <= 0) return
    this._clearIdle()
    this._idleTimer = setTimeout(() => {
      const handlers = this._handlers
      if (!handlers) return
      this._clearIdle()
      this._source?.close()
      this._source = null
      handlers.onError(new Error(`No frame for ${this._idleTimeout}ms`))
    }, this._idleTimeout)
  }

  private _clearIdle(): void {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer)
      this._idleTimer = null
    }
  }
}
