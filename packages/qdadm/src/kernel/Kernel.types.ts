/**
 * Kernel - Type definitions
 *
 * Extracted from Kernel.ts for maintainability.
 */
import type { Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import type { SignalBus } from './SignalBus'
import type { RoutesConfig } from './EventRouter'
import type { EntityManager } from '../entity/EntityManager'
import type { EntityAuthAdapter } from '../entity/auth/EntityAuthAdapter'
import type { RoleProvider } from '../security/RolesProvider'
import type { I18nOptions } from '../i18n/types'

/**
 * Auth adapter interface (app-level authentication)
 */
export interface AuthAdapter {
  isAuthenticated(): boolean
  getToken?(): string | null
  logout?(): void
  connectSignals?(signals: SignalBus): () => void
  [key: string]: unknown
}

/**
 * Debug module interface
 */
export interface DebugModule {
  getBridge?(): unknown
  [key: string]: unknown
}

/**
 * App configuration
 */
export interface AppConfig {
  name?: string
  shortName?: string
  version?: string
  logo?: string
  theme?: string
}

/**
 * Feature toggles
 */
export interface Features {
  auth?: boolean
  poweredBy?: boolean
  [key: string]: unknown
}

/**
 * Page components
 */
export interface Pages {
  layout: Component
  shell?: Component
  login?: Component
  notFound?: Component
}

/**
 * Layout components
 */
export interface LayoutComponents {
  list?: Component | null
  form?: Component | null
  dashboard?: Component | null
  base?: Component | null
  ListLayout?: Component
  FormLayout?: Component
  DashboardLayout?: Component
  BaseLayout?: Component
}

/**
 * PrimeVue configuration
 */
export interface PrimeVueConfig {
  plugin: unknown
  theme?: unknown
  options?: Record<string, unknown>
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  role_hierarchy?: Record<string, string[]>
  role_permissions?: Record<string, string[]>
  role_labels?: Record<string, string>
  entity_permissions?: boolean | string[]
  rolesProvider?: RoleProvider
}

/**
 * SSE configuration
 */
export interface SSEConfig {
  url: string
  reconnectDelay?: number
  signalPrefix?: string
  autoConnect?: boolean
  withCredentials?: boolean
  tokenParam?: string
  events?: string[]
}

/**
 * Debug bar configuration
 */
export interface DebugBarConfig {
  module?: new (options: unknown) => unknown
  component?: Component
  enabled?: boolean
  _kernelManaged?: boolean
  /**
   * Optional shared `DebugBridge` to register qdadm collectors onto.
   * When provided, the host shell owns the bridge (collectors from
   * other frameworks like qcms can be added too) and is responsible
   * for calling `bridge.install(mergedCtx)` once everything is
   * registered. Without it, the DebugModule creates and installs its
   * own bridge as before.
   */
  bridge?: unknown
  [key: string]: unknown
}

/**
 * Notifications configuration
 */
export interface NotificationsConfig {
  enabled?: boolean
  maxNotifications?: number
}

/**
 * Home route configuration
 */
export type HomeRoute = string | { name?: string; component?: Component }

/**
 * Kernel options
 */
export interface KernelOptions {
  /**
   * Root component the Kernel should mount. Required UNLESS
   * `existingApp` is provided (host shell already created and owns
   * the Vue app). Validated at runtime in `_createVueApp`.
   */
  root?: Component
  modules?: Record<string, unknown>
  modulesOptions?: Record<string, unknown>
  moduleDefs?: unknown[]
  sectionOrder?: string[]
  managers?: Record<string, unknown>
  managerRegistry?: Record<string, new (options: unknown) => EntityManager>
  storageResolver?: (config: unknown, entityName: string) => unknown
  managerResolver?: (config: unknown, entityName: string, context: unknown) => EntityManager
  authAdapter?: AuthAdapter | null
  entityAuthAdapter?: EntityAuthAdapter | string | Record<string, unknown> | null
  authTypes?: Record<string, unknown>
  pages?: Pages
  homeRoute?: HomeRoute
  coreRoutes?: RouteRecordRaw[]
  basePath?: string
  hashMode?: boolean
  app?: AppConfig
  features?: Features
  primevue?: PrimeVueConfig
  layouts?: LayoutComponents
  security?: SecurityConfig
  warmup?: boolean
  /** Default entity cache TTL in milliseconds (0=disabled, -1=infinite, >0=TTL). Default: -1 (infinite). */
  defaultEntityCacheTtlMs?: number
  eventRouter?: RoutesConfig
  sse?: SSEConfig
  debugBar?: DebugBarConfig
  notifications?: NotificationsConfig
  toast?: Record<string, unknown>
  debug?: boolean
  onAuthExpired?: (payload: unknown) => void
  i18n?: I18nOptions
  /**
   * Existing Vue app to install qdadm onto. When provided, the Kernel
   * skips its own `createApp(WrappedRoot)` and reuses the supplied
   * instance — useful when a host shell (e.g. a CMS) already owns the
   * Vue app and wants qdadm as a guest. The host is responsible for
   * rendering qdadm's DOM extras (debug bar, toast root); see
   * `<QdadmRoot />` for a drop-in helper.
   *
   * Pinia / PrimeVue / vue-router are still installed by the Kernel
   * unless the host has already done so — re-install is idempotent for
   * the standard plugins.
   */
  existingApp?: import('vue').App
  /**
   * Existing vue-router to register Kernel routes onto. When provided,
   * the Kernel skips `createRouter()` and adds its computed routes via
   * `existingRouter.addRoute(...)` instead. Combine with `routePrefix`
   * to mount qdadm under a sub-path of the host (e.g. `/admin`).
   */
  existingRouter?: import('vue-router').Router
  /**
   * Existing SignalBus to use instead of creating one. Critical when
   * the host already runs a SignalBus that other frameworks (e.g.
   * qdcms) emit on / listen to — sharing the bus is what makes
   * cross-framework reactivity work.
   */
  existingSignals?: SignalBus
  /**
   * Prefix prepended to every route the Kernel registers. Use with
   * `existingRouter` to mount the whole admin tree under a sub-path
   * (e.g. `routePrefix: '/admin'` makes the layout-children land at
   * `/admin/home`, `/admin/users`, etc., and the catch-all becomes
   * `/admin/:pathMatch(.*)*`). Default: '' (no prefix — root mount).
   */
  routePrefix?: string
}

/**
 * Internal layout components type
 */
export interface InternalLayoutComponents {
  list: Component | null
  form: Component | null
  dashboard: Component | null
  base: Component | null
}

/**
 * Axios-like client interface
 */
export interface AxiosLikeClient {
  interceptors: {
    request: {
      use(
        onFulfilled: (config: AxiosRequestConfig) => AxiosRequestConfig,
        onRejected: (error: unknown) => Promise<unknown>
      ): void
    }
    response: {
      use(
        onFulfilled: (response: unknown) => unknown,
        onRejected: (error: unknown) => Promise<unknown>
      ): void
    }
  }
}

export interface AxiosRequestConfig {
  headers?: Record<string, string>
  url?: string
  [key: string]: unknown
}

export interface AxiosError {
  response?: { status: number }
  config?: { url?: string }
  message: string
}
