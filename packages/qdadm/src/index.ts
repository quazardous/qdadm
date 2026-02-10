/**
 * qdadm - Vue 3 Admin Dashboard Framework
 *
 * A framework for building admin dashboards with Vue 3, PrimeVue, and Vue Router.
 */

// Version (from package.json)
import pkg from '../package.json'
export const version: string = (pkg as { version: string }).version

// ════════════════════════════════════════════════════════════════════════════
// KERNEL (simplified bootstrap) - Module, Kernel, KernelContext, SignalBus, etc.
// ════════════════════════════════════════════════════════════════════════════
export { Kernel } from './kernel/Kernel'
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
  HomeRoute,
  KernelOptions,
} from './kernel/Kernel'
export { SignalBus, createSignalBus, SIGNALS, SIGNAL_ACTIONS, buildSignal } from './kernel/SignalBus'
export type { SignalBusOptions, SignalAction, EntitySignalPayload } from './kernel/SignalBus'
export { EventRouter, createEventRouter } from './kernel/EventRouter'
export type {
  SignalTarget,
  RouteContext,
  RouteCallback,
  RouteTarget,
  RoutesConfig,
  EventRouterOptions,
} from './kernel/EventRouter'
export { SSEBridge, createSSEBridge, SSE_SIGNALS } from './kernel/SSEBridge'
export type { SSEBridgeOptions } from './kernel/SSEBridge'
export { Module } from './kernel/Module'
export { KernelContext, createKernelContext } from './kernel/KernelContext'
export type {
  NavItem,
  ZoneOptions,
  BlockConfig,
  RouteOptions,
  CrudPages,
  CrudOptions,
  ChildPageOptions,
  UserEntityOptions,
  PermissionMeta,
  PermissionOptions,
} from './kernel/KernelContext'
export {
  ModuleLoader,
  createModuleLoader,
  ModuleNotFoundError,
  CircularDependencyError,
  ModuleLoadError,
} from './kernel/ModuleLoader'
export type {
  ModuleContext,
  ModuleLike,
  ObjectModuleDefinition,
  ModuleClassConstructor,
  LegacyInitApi,
  LegacyInitFunction,
  ModuleDefinition,
} from './kernel/ModuleLoader'

// ════════════════════════════════════════════════════════════════════════════
// PLUGIN (manual bootstrap)
// ════════════════════════════════════════════════════════════════════════════
export {
  createQdadm,
  type QdadmOptions,
  type QdadmPlugin,
  type ToastService,
  type AuthAdapter as PluginAuthAdapter,
  type AppConfig as PluginAppConfig,
  type FeaturesConfig,
  type ModulesConfig,
} from './plugin'

// ════════════════════════════════════════════════════════════════════════════
// ENTITY (EntityManager, storage adapters, auth adapters)
// ════════════════════════════════════════════════════════════════════════════
export {
  EntityManager,
  createEntityManager,
  type EntityManagerOptions,
  type EntityBadge,
  type RoutingContext,
  type PresaveContext,
  type PostsaveContext,
  type PredeleteContext,
  type QueryOptions,
  type WhitelistContext,
  type CacheInfo,
} from './entity/EntityManager'

// Re-export core entity types
export type {
  EntityRecord,
  ListParams,
  ListResult,
  FieldConfig,
  ChildConfig,
  ParentConfig,
  RelationConfig,
  NavConfig,
  StorageCapabilities,
} from './types'

// Manager Factory
export {
  managerFactory,
  defaultManagerResolver,
  createManagerFactory,
  createManagers,
  type ManagerConfig,
  type ManagerFactoryContext,
  type ManagerResolver,
} from './entity/factory'

// Storage adapters
export * from './entity/storage/index'

// Entity auth adapters
export * from './entity/auth'

// ════════════════════════════════════════════════════════════════════════════
// SESSION AUTH (user authentication)
// ════════════════════════════════════════════════════════════════════════════
export { LocalStorageSessionAuthAdapter } from './auth'
export type {
  LoginCredentials,
  SessionData,
  ISessionAuthAdapter,
  AuthUser as SessionAuthUser,
} from './auth'

// ════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR
// ════════════════════════════════════════════════════════════════════════════
export * from './orchestrator/index'

// ════════════════════════════════════════════════════════════════════════════
// COMPOSABLES (excluding types that conflict with other modules)
// ════════════════════════════════════════════════════════════════════════════
export { useBareForm, type UseBareFormOptions, type UseBareFormReturn } from './composables/useBareForm'
export {
  useBreadcrumb,
  type UseBreadcrumbOptions,
  type UseBreadcrumbReturn,
  type BreadcrumbDisplayItem,
} from './composables/useBreadcrumb'
export {
  useSemanticBreadcrumb,
  computeSemanticBreadcrumb,
  type SemanticBreadcrumbItem,
} from './composables/useSemanticBreadcrumb'
export { useDirtyState, type UseDirtyStateReturn } from './composables/useDirtyState'
export {
  useForm,
  type UseFormOptions,
  type UseFormReturn,
  type FormAlterConfig,
} from './composables/useForm'
export {
  useEntityItemFormPage,
  useEntityItemFormPage as useFormPageBuilder,
  type UseEntityItemFormPageOptions,
  type UseEntityItemFormPageReturn,
  type FieldDefinition,
  type ResolvedFieldConfig,
  type ActionConfig as FormActionConfig,
  type FormPageProps,
  type FormPageEvents,
} from './composables/useEntityItemFormPage'
export * from './composables/useJsonSyntax'
export {
  useListPage,
  PAGE_SIZE_OPTIONS,
  type UseListPageOptions,
  type UseListPageReturn,
  type ColumnConfig,
  type FilterConfig,
  type ActionConfig as ListActionConfig,
  type ResolvedAction,
  type HeaderActionConfig,
  type ResolvedHeaderAction,
  type CardConfig,
  type SearchConfig,
  type ListPageProps,
  type ListPageEvents,
  type BulkStatusActionReturn,
} from './composables/useListPage'
export {
  usePageTitle,
  type UsePageTitleReturn,
  type TitleParts,
  type TitleInput,
} from './composables/usePageTitle'
export { useApp, type UseAppReturn } from './composables/useApp'
export { useAuth, type UseAuthReturn } from './composables/useAuth'
export {
  useEntityItemPage,
  type UseEntityItemPageOptions,
  type UseEntityItemPageReturn,
  // ParentConfig already exported from types
} from './composables/useEntityItemPage'
export {
  useEntityItemShowPage,
  useEntityItemShowPage as useShowPageBuilder,
  type UseEntityItemShowPageOptions,
  type UseEntityItemShowPageReturn,
  type FieldDefinition as ShowFieldDefinition,
  type ResolvedFieldConfig as ShowResolvedFieldConfig,
  type ActionConfig as ShowActionConfig,
  type LazyActionConfig as ShowLazyActionConfig,
  type ShowPageProps,
  type ShowPageEvents,
} from './composables/useEntityItemShowPage'
export {
  useNavContext,
  type UseNavContextOptions,
  type UseNavContextReturn,
  type NavChainSegment,
  type NavChainType,
  type BreadcrumbItem,
  type NavLinkItem,
} from './composables/useNavContext'
export {
  useNavigation,
  type UseNavigationReturn,
  type NavSection,
  // NavItem already exported from kernel
} from './composables/useNavigation'
export {
  useUnsavedChangesGuard,
  type UseUnsavedChangesGuardOptions,
  type UseUnsavedChangesGuardReturn,
  type GuardDialogState,
} from './composables/useUnsavedChangesGuard'
export { useGuardDialog, type GuardDialog } from './composables/useGuardStore'
export { useSignals } from './composables/useSignals'
export {
  useZoneRegistry,
  type UseZoneRegistryReturn,
  type ZoneDefinition,
  type ZoneInfo,
  // BlockConfig & ZoneRegistry exported from zones
} from './composables/useZoneRegistry'
export { useHooks } from './composables/useHooks'
export {
  useLayoutResolver,
  createLayoutComponents,
  layoutMeta,
  LAYOUT_TYPES,
  type UseLayoutResolverOptions,
  type UseLayoutResolverReturn,
  type LayoutType,
  type LayoutComponentsMap,
  type LayoutComponentsInput,
  type LayoutMeta,
} from './composables/useLayoutResolver'
export { useSSEBridge, type UseSSEBridgeReturn } from './composables/useSSEBridge'
export {
  useDeferred,
  useDeferredValue,
  DEFERRED_INJECTION_KEY,
  type UseDeferredValueReturn,
} from './composables/useDeferred'
export {
  useInfoBanner,
  provideBannerStore,
  createBannerStore,
  type Banner,
  type BannerOptions,
  type BannerSeverity,
  type BannerStore,
} from './composables/useInfoBanner'
export {
  useUserImpersonator,
  type UseUserImpersonatorOptions,
  type UseUserImpersonatorReturn,
  type UserRecord,
} from './composables/useUserImpersonator'
export { useCurrentEntity, type UseCurrentEntityReturn } from './composables/useCurrentEntity'
export { useChildPage, type UseChildPageReturn } from './composables/useChildPage'

// ════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ════════════════════════════════════════════════════════════════════════════
export * from './components/index'

// ════════════════════════════════════════════════════════════════════════════
// MODULE SYSTEM (excluding types that conflict)
// ════════════════════════════════════════════════════════════════════════════
export {
  registry,
  initModules,
  setSectionOrder,
  getRoutes,
  getNavSections,
  alterMenuSections,
  isMenuAltered,
  getRouteFamilies,
  getEntityConfigs,
  getEntityConfig,
  getSiblingRoutes,
  getChildRoutes,
  isRouteInFamily,
  resetRegistry,
  type ModuleRouteMeta,
  type ModuleRoute,
  type NavItemWithSection,
  type AddRoutesOptions,
  type EntityConfig,
  type ModuleInitContext,
  type ModuleInitFunction,
  type InitModulesOptions,
  type MenuAlterContext,
  // ParentConfig, NavItem, NavSection, ModuleDefinition - already exported
} from './module/moduleRegistry'

// ════════════════════════════════════════════════════════════════════════════
// ZONES (ZoneRegistry class and zone constants)
// ════════════════════════════════════════════════════════════════════════════
export {
  ZoneRegistry,
  createZoneRegistry,
  type BlockOperation,
  type WrapperInfo,
  type ZoneConfig,
  type ZoneDefineOptions,
  type ZoneListInfo,
  type ZoneDetailInfo,
  type ZoneInspection,
  type ZoneRegistryOptions,
  // BlockConfig - already exported from kernel
} from './zones/ZoneRegistry'
export {
  ZONES,
  LAYOUT_ZONES,
  LIST_ZONES,
  FORM_ZONES,
  DASHBOARD_ZONES,
  registerStandardZones,
  getStandardZoneNames,
} from './zones/zones'

// ════════════════════════════════════════════════════════════════════════════
// CHAIN (active navigation stack)
// ════════════════════════════════════════════════════════════════════════════
export * from './chain/index'

// ════════════════════════════════════════════════════════════════════════════
// HOOKS
// ════════════════════════════════════════════════════════════════════════════
export * from './hooks/index'

// ════════════════════════════════════════════════════════════════════════════
// DEFERRED (async service loading)
// ════════════════════════════════════════════════════════════════════════════
export * from './deferred/index'

// ════════════════════════════════════════════════════════════════════════════
// CORE (extension helpers)
// ════════════════════════════════════════════════════════════════════════════
export * from './core/index'

// ════════════════════════════════════════════════════════════════════════════
// QUERY (MongoDB-like filtering)
// ════════════════════════════════════════════════════════════════════════════
export * from './query/index'

// ════════════════════════════════════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════════════════════════════════════
export * from './utils/index'

// ════════════════════════════════════════════════════════════════════════════
// TOAST (signal-based notifications)
// ════════════════════════════════════════════════════════════════════════════
export * from './toast/index'

// ════════════════════════════════════════════════════════════════════════════
// DEBUG - NOT exported here to enable tree-shaking.
// Import from 'qdadm/debug' separately when needed:
//   import { debugBar, DebugModule } from 'qdadm/debug'
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// ASSETS
// ════════════════════════════════════════════════════════════════════════════
export { default as qdadmLogo } from './assets/logo.svg'
