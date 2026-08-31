/**
 * SSEBridge - Server-Sent Events to SignalBus bridge.
 *
 * Manages a single SSE connection and emits all events to a SignalBus.
 * Components subscribe via `signals.on('sse:eventName', handler)` instead of
 * managing their own EventSource connections.
 *
 * Framework-agnostic: only depends on SignalBus and the browser EventSource API.
 *
 * Auth coupling is configurable via `connectOnSignal` / `disconnectOnSignal`
 * (defaults: `'auth:login'` / `'auth:logout'`). Set them to `null` to disable
 * the automatic connect-on-auth behaviour.
 *
 * Signal naming:
 * - `sse:connected` — connection established
 * - `sse:disconnected` — connection lost
 * - `sse:error` — connection error
 * - `sse:{eventName}` — SSE event forwarded
 */

import type { SignalBus } from '../signal/SignalBus'

export const SSE_SIGNALS = {
  CONNECTED: 'sse:connected',
  DISCONNECTED: 'sse:disconnected',
  ERROR: 'sse:error',
  MESSAGE: 'sse:message',
} as const

export interface SSEBridgeOptions {
  /** SignalBus instance */
  signals: SignalBus
  /** SSE endpoint URL */
  url: string
  /** Delay before reconnect (ms), 0 to disable */
  reconnectDelay?: number
  /** Prefix for emitted signals (default: 'sse') */
  signalPrefix?: string
  /** Connect immediately (default: false, waits for `connectOnSignal`) */
  autoConnect?: boolean
  /**
   * Signal that triggers a connect when received.
   * Default: `'auth:login'`. Set to `null` to disable.
   */
  connectOnSignal?: string | null
  /**
   * Signal that triggers a disconnect when received.
   * Default: `'auth:logout'`. Set to `null` to disable.
   */
  disconnectOnSignal?: string | null
  /** Include credentials in request */
  withCredentials?: boolean
  /** Query param name for auth token */
  tokenParam?: string
  /**
   * Function to get the auth token appended to the SSE URL.
   *
   * May be async: `EventSource` accepts no headers, so the token travels as a
   * query parameter and ends up in access logs. Returning a promise lets an
   * app fetch a short-lived, single-use ticket before each connect instead of
   * leaking a durable credential into files that live for months (#1888 lot A).
   */
  getToken?: (() => string | null | Promise<string | null>) | null
  /** Enable debug logging */
  debug?: boolean
}

export class SSEBridge {
  private _signals: SignalBus
  private _url: string
  private _reconnectDelay: number
  private _signalPrefix: string
  private _withCredentials: boolean
  private _tokenParam: string
  private _getToken: (() => string | null | Promise<string | null>) | null
  private _debug: boolean

  /**
   * Event names to (re)attach on every connection (#1898 lot F).
   *
   * Listeners live on an EventSource instance, and every reconnect builds a
   * new one. Remembering the names here is what keeps named events working
   * across reconnects — the caller registers once, the bridge honours it for
   * the life of the bridge. Leaving that to the caller is how the named
   * channel silently died after the first drop while the stream still looked
   * alive, because `onmessage` is re-attached and unnamed events kept flowing.
   */
  private _registeredEvents = new Set<string>()

  private _eventSource: EventSource | null = null
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _connected = false
  private _reconnecting = false
  /**
   * Bumped by every connect() and disconnect(). A connect that awaited an async
   * token checks it before opening the EventSource: if something superseded it
   * while the token resolved, the attempt is discarded instead of resurrecting
   * a connection the caller already tore down.
   */
  private _generation = 0

  constructor(options: SSEBridgeOptions) {
    const {
      signals,
      url,
      reconnectDelay = 5000,
      signalPrefix = 'sse',
      autoConnect = false,
      connectOnSignal = 'auth:login',
      disconnectOnSignal = 'auth:logout',
      withCredentials = false,
      tokenParam = 'token',
      getToken = null,
      debug = false,
    } = options

    if (!signals) throw new Error('[SSEBridge] signals (SignalBus) is required')
    if (!url) throw new Error('[SSEBridge] url is required')

    this._signals = signals
    this._url = url
    this._reconnectDelay = reconnectDelay
    this._signalPrefix = signalPrefix
    this._withCredentials = withCredentials
    this._tokenParam = tokenParam
    this._getToken = getToken
    this._debug = debug

    if (autoConnect) {
      void this.connect()
    } else if (connectOnSignal) {
      this._signals.once(connectOnSignal, () => {
        this._log(`Received ${connectOnSignal}, connecting SSE`)
        void this.connect()
      })
    }

    if (disconnectOnSignal) {
      this._signals.on(disconnectOnSignal, () => {
        this._log(`Received ${disconnectOnSignal}, disconnecting SSE`)
        this.disconnect()
      })
    }
  }

  private _buildSignal(eventName: string): string {
    return `${this._signalPrefix}:${eventName}`
  }

  private _log(...args: unknown[]): void {
    if (this._debug) console.debug('[SSEBridge]', ...args)
  }

  private async _buildUrl(): Promise<string> {
    const token = await this._getToken?.()
    const sseUrl = new URL(this._url, window.location.origin)
    if (token && this._tokenParam) {
      sseUrl.searchParams.set(this._tokenParam, token)
    }
    return sseUrl.toString()
  }

  /**
   * Open the connection. Returns a promise because `getToken` may be async;
   * callers that don't care can ignore it — the reconnect loop does.
   */
  async connect(): Promise<void> {
    const generation = ++this._generation

    if (this._eventSource) {
      this._eventSource.close()
      this._eventSource = null
    }

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }

    try {
      const url = await this._buildUrl()

      // Someone called disconnect() or connect() again while the token
      // resolved: that newer intent wins, drop this one.
      if (generation !== this._generation) {
        this._log('Discarded a stale connect (superseded while resolving token)')
        return
      }

      this._log('Connecting to', url)

      this._eventSource = new EventSource(url, { withCredentials: this._withCredentials })

      this._eventSource.onopen = (): void => {
        this._connected = true
        this._reconnecting = false
        this._log('Connected')
        this._signals.emit(SSE_SIGNALS.CONNECTED, { url: this._url, timestamp: new Date() })
      }

      this._eventSource.onerror = (): void => {
        this._connected = false
        this._log('Connection error')
        this._signals.emit(SSE_SIGNALS.ERROR, { error: 'Connection error', timestamp: new Date() })

        if (this._eventSource) {
          this._eventSource.close()
          this._eventSource = null
        }

        this._signals.emit(SSE_SIGNALS.DISCONNECTED, { timestamp: new Date() })
        this._scheduleReconnect()
      }

      this._eventSource.onmessage = (event: MessageEvent): void => {
        this._handleEvent('message', event)
      }

      // Re-bind every remembered name: listeners belong to the instance we
      // just replaced, so without this the named channel dies on reconnect.
      this._attachEvents(this._registeredEvents)
    } catch (err) {
      const error = err as Error
      this._log('Connect error:', error.message)

      // A failed token fetch on a superseded attempt is not this bridge's
      // problem any more — stay quiet rather than fight the newer intent.
      if (generation !== this._generation) return

      this._signals.emit(SSE_SIGNALS.ERROR, { error: error.message, timestamp: new Date() })
      this._scheduleReconnect()
    }
  }

  /**
   * Subscribe to named SSE events, now and after every reconnect.
   *
   * Safe to call before connecting and safe to call twice: names are
   * remembered, and only the ones not yet bound to the current connection are
   * attached.
   */
  registerEvents(eventNames: string[]): void {
    const fresh = eventNames.filter((name) => !this._registeredEvents.has(name))
    for (const name of eventNames) this._registeredEvents.add(name)

    if (!this._eventSource) {
      // Not a failure: they will be attached when the connection opens.
      this._log('Registered for the next connection:', eventNames.join(', '))
      return
    }

    this._attachEvents(fresh)
  }

  /** Bind the given names to the current EventSource. */
  private _attachEvents(eventNames: Iterable<string>): void {
    if (!this._eventSource) return
    for (const eventName of eventNames) {
      this._eventSource.addEventListener(eventName, (event) => {
        this._handleEvent(eventName, event as MessageEvent)
      })
      this._log('Registered event:', eventName)
    }
  }

  private _handleEvent(eventName: string, event: MessageEvent): void {
    let data: unknown
    try {
      data = JSON.parse(event.data as string)
    } catch {
      data = event.data
    }

    const signal = this._buildSignal(eventName)
    this._log(`Emitting ${signal}:`, data)

    this._signals.emit(signal, {
      event: eventName,
      data,
      timestamp: new Date(),
      lastEventId: event.lastEventId,
    })
  }

  private _scheduleReconnect(): void {
    if (this._reconnectDelay <= 0) return
    if (this._reconnectTimer) return

    this._reconnecting = true
    this._log(`Reconnecting in ${this._reconnectDelay}ms`)

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null
      if (!this._connected) void this.connect()
    }, this._reconnectDelay)
  }

  disconnect(): void {
    // Invalidate any connect still waiting on an async token.
    this._generation++

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }

    if (this._eventSource) {
      this._eventSource.close()
      this._eventSource = null
    }

    if (this._connected) {
      this._connected = false
      this._signals.emit(SSE_SIGNALS.DISCONNECTED, { timestamp: new Date() })
    }

    this._reconnecting = false
    this._log('Disconnected')
  }

  reconnect(): Promise<void> {
    this.disconnect()
    return this.connect()
  }

  isConnected(): boolean {
    return this._connected
  }

  isReconnecting(): boolean {
    return this._reconnecting
  }
}

export function createSSEBridge(options: SSEBridgeOptions): SSEBridge {
  return new SSEBridge(options)
}
