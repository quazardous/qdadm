/**
 * Debug Module Exports
 *
 * Provides base classes and utilities for debug collectors
 * used by the debug panel UI.
 */

export { Collector } from './Collector'
export { SignalCollector } from './SignalCollector'
export { DebugBridge, createDebugBridge } from './DebugBridge'
export { ErrorCollector } from './ErrorCollector'
export { ToastCollector } from './ToastCollector'
export { ZonesCollector } from './ZonesCollector'
export { AuthCollector } from './AuthCollector'
export { EntitiesCollector } from './EntitiesCollector'
export { RouterCollector } from './RouterCollector'
export { LocalStorageAdapter, createLocalStorageAdapter } from './LocalStorageAdapter'

// Module System v2 integration
export { DebugModule, DEBUG_BRIDGE_KEY, DEBUG_ZONE, QdadmDebugBar } from './DebugModule'

// Components
export { DebugBar } from './components/index'

// Convenience export for Kernel debugBar option
// Usage: import { debugBar } from '@qdadm/core/debug'
//        new Kernel({ debugBar })
import { DebugModule as _DebugModule, QdadmDebugBar as _QdadmDebugBar } from './DebugModule'
export const debugBar = {
  module: _DebugModule,
  component: _QdadmDebugBar
}
