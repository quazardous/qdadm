/**
 * Kernel Module
 *
 * Simplified bootstrap for qdadm applications.
 */

export { Kernel } from './Kernel'
export type {
  AuthAdapter,
  AppConfig,
  Features,
  Pages,
  LayoutComponents,
  PrimeVueConfig,
  SecurityConfig,
  SSEConfig,
  DebugBarConfig,
  NotificationsConfig,
  HomeRoute,
  KernelOptions,
} from './Kernel'
export { SignalBus, createSignalBus, SIGNALS, SIGNAL_ACTIONS, buildSignal } from './SignalBus'
export type { SignalBusOptions, SignalAction, EntitySignalPayload } from './SignalBus'
export { EventRouter, createEventRouter } from './EventRouter'
export type { SignalTarget, RouteContext, RouteCallback, RouteTarget, RoutesConfig, EventRouterOptions } from './EventRouter'
export { SSEBridge, createSSEBridge, SSE_SIGNALS } from './SSEBridge'
export type { SSEBridgeOptions } from './SSEBridge'
export { Module } from './Module'
export { KernelContext, createKernelContext } from './KernelContext'
export type {
  NavItem,
  ZoneOptions,
  BlockConfig,
  RouteOptions,
  CrudPages,
  CrudOptions,
  UserEntityOptions,
  PermissionMeta,
  PermissionOptions,
} from './KernelContext'
export {
  ModuleLoader,
  createModuleLoader,
  ModuleNotFoundError,
  CircularDependencyError,
  ModuleLoadError,
} from './ModuleLoader'
export type {
  ModuleContext,
  ModuleLike,
  ObjectModuleDefinition,
  ModuleClassConstructor,
  LegacyInitApi,
  LegacyInitFunction,
  ModuleDefinition,
} from './ModuleLoader'
