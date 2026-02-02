/**
 * qdadm - Composables exports
 */

export { useBareForm, type UseBareFormOptions, type UseBareFormReturn } from './useBareForm'
export {
  useBreadcrumb,
  type UseBreadcrumbOptions,
  type UseBreadcrumbReturn,
  type BreadcrumbDisplayItem,
} from './useBreadcrumb'
export {
  useSemanticBreadcrumb,
  computeSemanticBreadcrumb,
  type SemanticBreadcrumbItem,
} from './useSemanticBreadcrumb'
export { useDirtyState, type UseDirtyStateReturn } from './useDirtyState'
export {
  useForm,
  type UseFormOptions,
  type UseFormReturn,
  type FormAlterConfig,
} from './useForm'
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
} from './useEntityItemFormPage'
export * from './useJsonSyntax'
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
} from './useListPage'
export { usePageTitle, type UsePageTitleReturn, type TitleParts, type TitleInput } from './usePageTitle'
export { useApp, type UseAppReturn } from './useApp'
export { useAuth, type UseAuthReturn } from './useAuth'
export {
  useEntityItemPage,
  type UseEntityItemPageOptions,
  type UseEntityItemPageReturn,
  type ParentConfig,
} from './useEntityItemPage'
export {
  useEntityItemShowPage,
  useEntityItemShowPage as useShowPageBuilder,
  type UseEntityItemShowPageOptions,
  type UseEntityItemShowPageReturn,
  type FieldDefinition as ShowFieldDefinition,
  type ResolvedFieldConfig as ShowResolvedFieldConfig,
  type ActionConfig as ShowActionConfig,
  type ShowPageProps,
  type ShowPageEvents,
} from './useEntityItemShowPage'
export {
  useNavContext,
  type UseNavContextOptions,
  type UseNavContextReturn,
  type NavChainSegment,
  type NavChainType,
  type BreadcrumbItem,
  type NavLinkItem,
} from './useNavContext'
export { useNavigation, type UseNavigationReturn, type NavItem, type NavSection } from './useNavigation'
export {
  useUnsavedChangesGuard,
  type UseUnsavedChangesGuardOptions,
  type UseUnsavedChangesGuardReturn,
  type GuardDialogState,
} from './useUnsavedChangesGuard'
export { useGuardDialog, type GuardDialog } from './useGuardStore'
export { useSignals } from './useSignals'
export {
  useZoneRegistry,
  type UseZoneRegistryReturn,
  type BlockConfig,
  type ZoneDefinition,
  type ZoneInfo,
  type ZoneRegistry,
} from './useZoneRegistry'
export { useHooks } from './useHooks'
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
} from './useLayoutResolver'
export { useSSEBridge, type UseSSEBridgeReturn } from './useSSEBridge'
export {
  useDeferred,
  useDeferredValue,
  DEFERRED_INJECTION_KEY,
  type UseDeferredValueReturn,
} from './useDeferred'
export {
  useInfoBanner,
  provideBannerStore,
  createBannerStore,
  type Banner,
  type BannerOptions,
  type BannerSeverity,
  type BannerStore,
} from './useInfoBanner'
export {
  useUserImpersonator,
  type UseUserImpersonatorOptions,
  type UseUserImpersonatorReturn,
  type UserRecord,
} from './useUserImpersonator'
export { useCurrentEntity, type UseCurrentEntityReturn } from './useCurrentEntity'
export {
  useFieldManager,
  snakeCaseToTitle,
  type BaseFieldDefinition,
  type ResolvedFieldConfig as FieldManagerFieldConfig,
  type FieldGroup,
  type GroupDefinition,
  type GroupOptions,
  type GenerateFieldsOptions as FieldManagerGenerateOptions,
  type AddFieldOptions as FieldManagerAddOptions,
  type MoveFieldPosition,
  type UseFieldManagerOptions,
  type UseFieldManagerReturn,
} from './useFieldManager'
