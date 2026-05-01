/**
 * Collector — qdadm re-export.
 *
 * The actual implementation now lives in `@quazardous/qddebug` so it can be
 * shared with qdcms. Existing internal imports (`from './Collector'`)
 * continue to work via this shim.
 */

export {
  Collector,
  type CollectorEntry,
  type CollectorContext,
  type CollectorOptions,
  type CollectorManifest,
  type CollectorSnapshot,
  type CollectorAction,
  type CollectorActionManifest,
  type DebugBridgeInterface,
  type NotifyCallback,
} from '@quazardous/qddebug'
