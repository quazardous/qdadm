/**
 * useSSE - Server-Sent Events composable
 *
 * Manages EventSource connection with automatic reconnection and cleanup.
 * Uses authAdapter.getToken() for authentication if available.
 *
 * Usage:
 *   const { connected, error, reconnect, close } = useSSE('/api/events', {
 *     eventHandlers: {
 *       'bot:status': (data) => console.log('Bot status:', data),
 *       'task:complete': (data) => handleTaskComplete(data)
 *     }
 *   })
 *
 * Options:
 *   - eventHandlers: Object mapping event names to handler functions
 *   - reconnectDelay: Delay in ms before reconnecting (default: 5000)
 *   - autoConnect: Start connection immediately (default: true)
 *   - withCredentials: Include credentials in request (default: false)
 *   - tokenParam: Query param name for token (default: 'token')
 *   - getToken: Custom token getter function (default: uses authAdapter)
 */

import { ref, inject, onUnmounted, onMounted } from 'vue'

export function useSSE(url, options = {}) {
  const {
    eventHandlers = {},
    reconnectDelay = 5000,
    autoConnect = true,
    withCredentials = false,
    tokenParam = 'token',
    getToken: customGetToken = null
  } = options

  const authAdapter = inject('authAdapter', null)

  const connected = ref(false)
  const error = ref(null)
  const reconnecting = ref(false)

  let eventSource = null
  let reconnectTimer = null

  /**
   * Get authentication token
   */
  const getToken = () => {
    // Custom getter takes precedence
    if (customGetToken) {
      return customGetToken()
    }
    // Try authAdapter
    if (authAdapter?.getToken) {
      return authAdapter.getToken()
    }
    // Fallback to localStorage
    return localStorage.getItem('auth_token')
  }

  /**
   * Build SSE URL with token
   */
  const buildUrl = () => {
    const token = getToken()
    const sseUrl = new URL(url, window.location.origin)

    if (token && tokenParam) {
      sseUrl.searchParams.set(tokenParam, token)
    }

    return sseUrl.toString()
  }

  /**
   * Connect to SSE endpoint
   */
  const connect = () => {
    // Clean up existing connection
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }

    // Clear any pending reconnect
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    try {
      const sseUrl = buildUrl()

      eventSource = new EventSource(sseUrl, {
        withCredentials
      })

      eventSource.onopen = () => {
        connected.value = true
        error.value = null
        reconnecting.value = false
      }

      eventSource.onerror = (err) => {
        connected.value = false
        error.value = 'Connection error'

        // Close broken connection
        if (eventSource) {
          eventSource.close()
          eventSource = null
        }

        // Schedule reconnect
        if (reconnectDelay > 0) {
          reconnecting.value = true
          reconnectTimer = setTimeout(() => {
            if (!connected.value) {
              connect()
            }
          }, reconnectDelay)
        }
      }

      // Register custom event handlers
      for (const [eventName, handler] of Object.entries(eventHandlers)) {
        if (eventName === 'message') continue // Handle below

        eventSource.addEventListener(eventName, (event) => {
          try {
            const data = JSON.parse(event.data)
            handler(data, event)
          } catch (err) {
            console.error(`[useSSE] Error parsing event "${eventName}":`, err)
            // Call handler with raw data on parse error
            handler(event.data, event)
          }
        })
      }

      // Handle generic message events
      eventSource.onmessage = (event) => {
        if (!eventHandlers.message) return

        try {
          const data = JSON.parse(event.data)
          eventHandlers.message(data, event)
        } catch (err) {
          console.error('[useSSE] Error parsing message:', err)
          eventHandlers.message(event.data, event)
        }
      }

    } catch (err) {
      error.value = err.message
      connected.value = false
    }
  }

  /**
   * Close connection
   */
  const close = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    if (eventSource) {
      eventSource.close()
      eventSource = null
    }

    connected.value = false
    reconnecting.value = false
  }

  /**
   * Reconnect (close and connect)
   */
  const reconnect = () => {
    close()
    connect()
  }

  // Auto-connect on mount if enabled
  onMounted(() => {
    if (autoConnect) {
      connect()
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    close()
  })

  return {
    /** Reactive connection state */
    connected,
    /** Reactive error message */
    error,
    /** Reactive reconnecting state */
    reconnecting,
    /** Manually connect */
    connect,
    /** Close connection */
    close,
    /** Reconnect (close + connect) */
    reconnect
  }
}
