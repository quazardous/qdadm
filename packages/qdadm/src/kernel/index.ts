/**
 * Kernel Module
 *
 * Simplified bootstrap for qdadm applications.
 */

export { Kernel } from './Kernel.js'
export { SignalBus, createSignalBus, SIGNALS, SIGNAL_ACTIONS, buildSignal } from './SignalBus'
export type { SignalBusOptions, SignalAction, EntitySignalPayload } from './SignalBus'
export { EventRouter, createEventRouter } from './EventRouter.js'
export { SSEBridge, createSSEBridge, SSE_SIGNALS } from './SSEBridge.js'
export { Module } from './Module.js'
export { KernelContext, createKernelContext } from './KernelContext.js'
export {
  ModuleLoader,
  createModuleLoader,
  ModuleNotFoundError,
  CircularDependencyError,
  ModuleLoadError,
} from './ModuleLoader.js'
