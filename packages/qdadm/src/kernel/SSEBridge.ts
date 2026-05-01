/**
 * SSEBridge — qdadm re-export.
 *
 * The actual implementation now lives in `@quazardous/qdcore` so it can be
 * shared with qdcms. The auth-aware connect/disconnect behaviour is now
 * configurable via `connectOnSignal` / `disconnectOnSignal` options; defaults
 * remain `'auth:login'` / `'auth:logout'` for backwards compatibility.
 */

export { SSEBridge, createSSEBridge, SSE_SIGNALS } from '@quazardous/qdcore'
export type { SSEBridgeOptions } from '@quazardous/qdcore'
