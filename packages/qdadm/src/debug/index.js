/**
 * Debug Module Exports
 *
 * Provides base classes and utilities for debug collectors
 * used by the debug panel UI.
 */

export { Collector } from './Collector.js'
export { SignalCollector } from './SignalCollector.js'
export { DebugBridge, createDebugBridge } from './DebugBridge.js'
export { ErrorCollector } from './ErrorCollector.js'
export { ToastCollector } from './ToastCollector.js'
export { ZonesCollector } from './ZonesCollector.js'
export { AuthCollector } from './AuthCollector.js'
export { EntitiesCollector } from './EntitiesCollector.js'
export { RouterCollector } from './RouterCollector.js'
export { LocalStorageAdapter, createLocalStorageAdapter } from './LocalStorageAdapter.js'

// Module System v2 integration
export { DebugModule, DEBUG_BRIDGE_KEY, DEBUG_ZONE, QdadmDebugBar } from './DebugModule.js'

// Components
export { DebugBar } from './components/index.js'

// Convenience export for Kernel debugBar option
// Usage: import { debugBar } from '@qdadm/core/debug'
//        new Kernel({ debugBar })
import { DebugModule as _DebugModule, QdadmDebugBar as _QdadmDebugBar } from './DebugModule.js'
export const debugBar = {
  module: _DebugModule,
  component: _QdadmDebugBar
}
