/**
 * DebugBridge — qdadm re-export.
 *
 * The actual implementation now lives in `@quazardous/qddebug` so it can be
 * shared with qdcms.
 */

export {
  DebugBridge,
  createDebugBridge,
  type DebugBridgeOptions,
  type BridgeManifest,
  type BridgeSnapshot,
} from '@quazardous/qddebug'
