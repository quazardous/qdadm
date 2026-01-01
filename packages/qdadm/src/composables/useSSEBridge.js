/**
 * useSSEBridge - Composable for SSE connection status
 *
 * Provides reactive connection status for SSEBridge.
 * Components use this instead of managing their own EventSource.
 *
 * Usage:
 * ```js
 * const { connected, reconnecting, error, onEvent } = useSSEBridge()
 *
 * // Reactive connection status
 * watchEffect(() => {
 *   if (connected.value) {
 *     console.log('SSE connected')
 *   }
 * })
 *
 * // Subscribe to specific event (auto-cleanup on unmount)
 * onEvent('task:completed', (payload) => {
 *   console.log('Task completed:', payload.data)
 * })
 * ```
 */

import { ref, inject, onUnmounted, onMounted } from 'vue'
import { SSE_SIGNALS } from '../kernel/SSEBridge.js'

/**
 * @typedef {object} UseSSEBridgeReturn
 * @property {import('vue').Ref<boolean>} connected - Connection status
 * @property {import('vue').Ref<boolean>} reconnecting - Reconnection in progress
 * @property {import('vue').Ref<string|null>} error - Last error message
 * @property {function} onEvent - Subscribe to SSE event (auto-cleanup)
 * @property {function} onAnyEvent - Subscribe to all SSE events (wildcard)
 */

/**
 * Composable for SSEBridge connection status
 * @returns {UseSSEBridgeReturn}
 */
export function useSSEBridge() {
  const signals = inject('qdadmSignals')
  const sseBridge = inject('qdadmSSEBridge', null)

  const connected = ref(sseBridge?.isConnected() ?? false)
  const reconnecting = ref(sseBridge?.isReconnecting() ?? false)
  const error = ref(null)

  const unbinders = []

  // Track connection status via signals
  if (signals) {
    const unbindConnected = signals.on(SSE_SIGNALS.CONNECTED, () => {
      connected.value = true
      reconnecting.value = false
      error.value = null
    })
    unbinders.push(unbindConnected)

    const unbindDisconnected = signals.on(SSE_SIGNALS.DISCONNECTED, () => {
      connected.value = false
    })
    unbinders.push(unbindDisconnected)

    const unbindError = signals.on(SSE_SIGNALS.ERROR, (payload) => {
      error.value = payload.error
      reconnecting.value = true
    })
    unbinders.push(unbindError)
  }

  /**
   * Subscribe to a specific SSE event
   * Automatically cleans up on component unmount.
   *
   * @param {string} eventName - SSE event name (without 'sse:' prefix)
   * @param {function} handler - Event handler (payload) => void
   * @returns {function} Unbind function
   */
  const onEvent = (eventName, handler) => {
    if (!signals) return () => {}

    const signal = `sse:${eventName}`
    const unbind = signals.on(signal, handler)
    unbinders.push(unbind)

    return unbind
  }

  /**
   * Subscribe to all SSE events (wildcard)
   * Automatically cleans up on component unmount.
   *
   * @param {function} handler - Event handler (payload) => void
   * @returns {function} Unbind function
   */
  const onAnyEvent = (handler) => {
    if (!signals) return () => {}

    const unbind = signals.on('sse:*', handler)
    unbinders.push(unbind)

    return unbind
  }

  // Cleanup on unmount
  onUnmounted(() => {
    unbinders.forEach(unbind => unbind())
  })

  return {
    connected,
    reconnecting,
    error,
    onEvent,
    onAnyEvent
  }
}
