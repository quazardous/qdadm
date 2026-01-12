/**
 * Debug Module Exports
 *
 * Provides base classes and utilities for debug collectors
 * used by the debug panel UI.
 */

export { Collector, type CollectorEntry, type CollectorContext, type CollectorOptions } from './Collector'
export { SignalCollector, type SignalEntry } from './SignalCollector'
export { DebugBridge, createDebugBridge, type DebugBridgeOptions } from './DebugBridge'
export { ErrorCollector, type ErrorEntry } from './ErrorCollector'
export { ToastCollector, type ToastEntry } from './ToastCollector'
export { ZonesCollector, type ZoneEntry } from './ZonesCollector'
export {
  AuthCollector,
  type AuthEntry,
  type AuthEvent,
  type AuthEventType,
  type AuthCollectorOptions
} from './AuthCollector'
export {
  EntitiesCollector,
  type EntityEntry,
  type StorageInfo,
  type CacheInfo,
  type PermissionsInfo,
  type StatsInfo
} from './EntitiesCollector'
export { RouterCollector, type NavigationEntry, type RouterCollectorOptions } from './RouterCollector'
export { LocalStorageAdapter, createLocalStorageAdapter } from './LocalStorageAdapter'

// Module System v2 integration
export { DebugModule, DEBUG_BRIDGE_KEY, DEBUG_ZONE, QdadmDebugBar, type DebugModuleOptions } from './DebugModule'

// Components
export { DebugBar } from './components/index'

// Convenience export for Kernel debugBar option
import { DebugModule as _DebugModule, QdadmDebugBar as _QdadmDebugBar } from './DebugModule'
export const debugBar = {
  module: _DebugModule,
  component: _QdadmDebugBar
}
