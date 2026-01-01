/**
 * SSEBridge - Server-Sent Events to SignalBus bridge
 *
 * Manages a single SSE connection and emits all events to SignalBus.
 * Components subscribe via signals.on('sse:eventName', handler) instead of
 * managing their own EventSource connections.
 *
 * Benefits:
 * - Single SSE connection per app (vs. one per component)
 * - Decoupled event handling via SignalBus
 * - Automatic reconnection with configurable delay
 * - Connection status available via signals
 *
 * Signal naming:
 * - `sse:connected` - Emitted when connection established
 * - `sse:disconnected` - Emitted when connection lost
 * - `sse:error` - Emitted on connection error
 * - `sse:{eventName}` - SSE event forwarded (e.g., sse:task:completed)
 *
 * Usage in Kernel:
 * ```js
 * new Kernel({
 *   sse: {
 *     url: '/api/events',
 *     reconnectDelay: 5000,
 *     signalPrefix: 'sse',
 *     autoConnect: true
 *   }
 * })
 * ```
 *
 * Usage in components:
 * ```js
 * const signals = inject('qdadmSignals')
 *
 * // Subscribe to specific SSE events
 * signals.on('sse:task:completed', ({ data }) => {
 *   console.log('Task completed:', data)
 * })
 *
 * // Subscribe to all SSE events via wildcard
 * signals.on('sse:*', ({ event, data }) => {
 *   console.log(`SSE event ${event}:`, data)
 * })
 * ```
 */

export const SSE_SIGNALS = {
  CONNECTED: 'sse:connected',
  DISCONNECTED: 'sse:disconnected',
  ERROR: 'sse:error',
  MESSAGE: 'sse:message'
}

export class SSEBridge {
  /**
   * @param {object} options
   * @param {SignalBus} options.signals - SignalBus instance
   * @param {string} options.url - SSE endpoint URL
   * @param {number} options.reconnectDelay - Delay before reconnect (ms), 0 to disable
   * @param {string} options.signalPrefix - Prefix for emitted signals (default: 'sse')
   * @param {boolean} options.autoConnect - Connect immediately (default: false, waits for auth:login)
   * @param {boolean} options.withCredentials - Include credentials in request
   * @param {string} options.tokenParam - Query param name for auth token
   * @param {function} options.getToken - Function to get auth token
   * @param {boolean} options.debug - Enable debug logging
   */
  constructor(options) {
    const {
      signals,
      url,
      reconnectDelay = 5000,
      signalPrefix = 'sse',
      autoConnect = false,
      withCredentials = false,
      tokenParam = 'token',
      getToken = null,
      debug = false
    } = options

    if (!signals) {
      throw new Error('[SSEBridge] signals (SignalBus) is required')
    }
    if (!url) {
      throw new Error('[SSEBridge] url is required')
    }

    this._signals = signals
    this._url = url
    this._reconnectDelay = reconnectDelay
    this._signalPrefix = signalPrefix
    this._withCredentials = withCredentials
    this._tokenParam = tokenParam
    this._getToken = getToken
    this._debug = debug

    this._eventSource = null
    this._reconnectTimer = null
    this._connected = false
    this._reconnecting = false

    // Auto-connect or wait for auth:login
    if (autoConnect) {
      this.connect()
    } else {
      // Wait for auth:login signal to connect
      this._signals.once('auth:login').then(() => {
        this._log('Received auth:login, connecting SSE')
        this.connect()
      })
    }

    // Disconnect on auth:logout
    this._signals.on('auth:logout', () => {
      this._log('Received auth:logout, disconnecting SSE')
      this.disconnect()
    })
  }

  /**
   * Build signal name with prefix
   * @param {string} eventName - Event name
   * @returns {string} Full signal name
   */
  _buildSignal(eventName) {
    return `${this._signalPrefix}:${eventName}`
  }

  /**
   * Debug logging
   */
  _log(...args) {
    if (this._debug) {
      console.debug('[SSEBridge]', ...args)
    }
  }

  /**
   * Build SSE URL with auth token
   * @returns {string}
   */
  _buildUrl() {
    const token = this._getToken?.()
    const sseUrl = new URL(this._url, window.location.origin)

    if (token && this._tokenParam) {
      sseUrl.searchParams.set(this._tokenParam, token)
    }

    return sseUrl.toString()
  }

  /**
   * Connect to SSE endpoint
   */
  connect() {
    // Clean up existing
    if (this._eventSource) {
      this._eventSource.close()
      this._eventSource = null
    }

    // Clear pending reconnect
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }

    try {
      const url = this._buildUrl()
      this._log('Connecting to', url)

      this._eventSource = new EventSource(url, {
        withCredentials: this._withCredentials
      })

      this._eventSource.onopen = () => {
        this._connected = true
        this._reconnecting = false
        this._log('Connected')

        this._signals.emit(SSE_SIGNALS.CONNECTED, {
          url: this._url,
          timestamp: new Date()
        })
      }

      this._eventSource.onerror = (err) => {
        this._connected = false
        this._log('Connection error')

        this._signals.emit(SSE_SIGNALS.ERROR, {
          error: 'Connection error',
          timestamp: new Date()
        })

        // Close broken connection
        if (this._eventSource) {
          this._eventSource.close()
          this._eventSource = null
        }

        this._signals.emit(SSE_SIGNALS.DISCONNECTED, {
          timestamp: new Date()
        })

        // Schedule reconnect
        this._scheduleReconnect()
      }

      // Handle generic message events (event: message)
      this._eventSource.onmessage = (event) => {
        this._handleEvent('message', event)
      }

      // For named events, we need to add listeners dynamically
      // Since EventSource doesn't expose event names, we use a wrapper approach:
      // The server should send events with `event:` field, we handle them generically

      // Note: Named events require explicit addEventListener.
      // To support arbitrary event names, the app should either:
      // 1. Use `message` event type and include event name in data
      // 2. Pre-register known event names via registerEvents()

    } catch (err) {
      this._log('Connect error:', err.message)
      this._signals.emit(SSE_SIGNALS.ERROR, {
        error: err.message,
        timestamp: new Date()
      })
      this._scheduleReconnect()
    }
  }

  /**
   * Register listeners for specific SSE event types
   * Required because EventSource requires explicit addEventListener for named events.
   *
   * @param {string[]} eventNames - Event names to listen for
   */
  registerEvents(eventNames) {
    if (!this._eventSource) {
      this._log('Cannot register events: not connected')
      return
    }

    for (const eventName of eventNames) {
      this._eventSource.addEventListener(eventName, (event) => {
        this._handleEvent(eventName, event)
      })
      this._log('Registered event:', eventName)
    }
  }

  /**
   * Handle incoming SSE event
   * @param {string} eventName - Event name
   * @param {MessageEvent} event - SSE event
   */
  _handleEvent(eventName, event) {
    let data
    try {
      data = JSON.parse(event.data)
    } catch {
      data = event.data
    }

    const signal = this._buildSignal(eventName)
    this._log(`Emitting ${signal}:`, data)

    this._signals.emit(signal, {
      event: eventName,
      data,
      timestamp: new Date(),
      lastEventId: event.lastEventId
    })
  }

  /**
   * Schedule reconnection
   */
  _scheduleReconnect() {
    if (this._reconnectDelay <= 0) return
    if (this._reconnectTimer) return

    this._reconnecting = true
    this._log(`Reconnecting in ${this._reconnectDelay}ms`)

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null
      if (!this._connected) {
        this.connect()
      }
    }, this._reconnectDelay)
  }

  /**
   * Disconnect from SSE endpoint
   */
  disconnect() {
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
      this._signals.emit(SSE_SIGNALS.DISCONNECTED, {
        timestamp: new Date()
      })
    }

    this._reconnecting = false
    this._log('Disconnected')
  }

  /**
   * Reconnect (disconnect + connect)
   */
  reconnect() {
    this.disconnect()
    this.connect()
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    return this._connected
  }

  /**
   * Check if reconnecting
   * @returns {boolean}
   */
  isReconnecting() {
    return this._reconnecting
  }
}

/**
 * Factory function to create SSEBridge
 * @param {object} options - SSEBridge options
 * @returns {SSEBridge}
 */
export function createSSEBridge(options) {
  return new SSEBridge(options)
}
