/**
 * useSSEBridge - Composable for SSE connection status
 *
 * Provides reactive connection status for SSEBridge.
 * Components use this instead of managing their own EventSource.
 *
 * Usage:
 * ```ts
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

import { ref, inject, onUnmounted, type Ref } from 'vue'
import { SSE_SIGNALS } from '../kernel/SSEBridge'
import type { SignalBus } from '../kernel/SignalBus'

/**
 * SSE Bridge interface
 */
interface SSEBridgeInstance {
  isConnected: () => boolean
  isReconnecting: () => boolean
}

/**
 * Signal payload with error
 */
interface SSEErrorPayload {
  error: string
}

/**
 * Return type for useSSEBridge
 */
export interface UseSSEBridgeReturn {
  /** Connection status */
  connected: Ref<boolean>
  /** Reconnection in progress */
  reconnecting: Ref<boolean>
  /** Last error message */
  error: Ref<string | null>
  /** Subscribe to SSE event (auto-cleanup) */
  onEvent: (eventName: string, handler: (payload: unknown) => void) => () => void
  /** Subscribe to all SSE events (wildcard) */
  onAnyEvent: (handler: (payload: unknown) => void) => () => void
}

/**
 * Composable for SSEBridge connection status
 * @returns SSE bridge state and methods
 */
export function useSSEBridge(): UseSSEBridgeReturn {
  const signals = inject<SignalBus | null>('qdadmSignals', null)
  const sseBridge = inject<SSEBridgeInstance | null>('qdadmSSEBridge', null)

  const connected = ref(sseBridge?.isConnected() ?? false)
  const reconnecting = ref(sseBridge?.isReconnecting() ?? false)
  const error = ref<string | null>(null)

  const unbinders: Array<() => void> = []

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

    const unbindError = signals.on(SSE_SIGNALS.ERROR, (payload: unknown) => {
      const errorPayload = payload as SSEErrorPayload
      error.value = errorPayload.error
      reconnecting.value = true
    })
    unbinders.push(unbindError)
  }

  /**
   * Subscribe to a specific SSE event
   * Automatically cleans up on component unmount.
   *
   * @param eventName - SSE event name (without 'sse:' prefix)
   * @param handler - Event handler (payload) => void
   * @returns Unbind function
   */
  const onEvent = (eventName: string, handler: (payload: unknown) => void): (() => void) => {
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
   * @param handler - Event handler (payload) => void
   * @returns Unbind function
   */
  const onAnyEvent = (handler: (payload: unknown) => void): (() => void) => {
    if (!signals) return () => {}

    const unbind = signals.on('sse:*', handler)
    unbinders.push(unbind)

    return unbind
  }

  // Cleanup on unmount
  onUnmounted(() => {
    unbinders.forEach((unbind) => unbind())
  })

  return {
    connected,
    reconnecting,
    error,
    onEvent,
    onAnyEvent,
  }
}
