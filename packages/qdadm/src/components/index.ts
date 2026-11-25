/**
 * qdadm - Components exports
 */

// Layout
// Base widget wrappers — the single indirection points over the widget
// library (#1391 exit-readiness)
export { default as QdButton } from './base/QdButton.vue'
export { default as QdMessage } from './base/QdMessage.vue'
export { default as AppLayout } from './layout/AppLayout.vue'
export { default as AppBanner } from './layout/AppBanner.vue'
export { default as BaseLayout } from './layout/BaseLayout.vue'
export { default as PageLayout } from './layout/PageLayout.vue'
export { default as PageHeader } from './layout/PageHeader.vue'
export { default as Breadcrumb } from './layout/Breadcrumb.vue'
export { default as PageNav } from './layout/PageNav.vue'
export { default as EntityItemLayout } from './layout/EntityItemLayout.vue'
export { default as Zone } from './layout/Zone.vue'
export { default as CardsDashboard } from './layout/CardsDashboard.vue'
export { default as SidebarBox } from './layout/SidebarBox.vue'
export { default as NavlinksGroup } from './layout/NavlinksGroup.vue'

// Default zone components
export { default as DefaultHeader } from './layout/defaults/DefaultHeader.vue'
export { default as DefaultMenu } from './layout/defaults/DefaultMenu.vue'
export { default as DefaultFooter } from './layout/defaults/DefaultFooter.vue'
export { default as DefaultUserInfo } from './layout/defaults/DefaultUserInfo.vue'
export { default as DefaultBreadcrumb } from './layout/defaults/DefaultBreadcrumb.vue'

// The side menu's sections and the settings menu (#5401)
export { default as QdSidebarMenus } from './layout/QdSidebarMenus.vue'

// Tabs on a page of the app's own (#5398)
export { default as QdTabs } from './layout/QdTabs.vue'
export type { QdTab } from './layout/QdTabs.types'

// Item (shared between edit and show)
export { default as FieldGroups } from './item/FieldGroups.vue'

// Edit (form pages)
export { default as FormPage } from './edit/FormPage.vue'
export { default as FormField } from './edit/FormField.vue'
export { default as FormInput } from './edit/FormInput.vue'
export { default as FormActions } from './edit/FormActions.vue'
export { default as LookupField } from './edit/LookupField.vue'
export { default as LookupPickerDialog } from './edit/LookupPickerDialog.vue'

// Show (read-only detail pages)
export { default as ShowPage } from './show/ShowPage.vue'
export { default as QdActionButton } from './show/QdActionButton.vue'
export { default as ShowField } from './show/ShowField.vue'
export { default as ShowDisplay } from './show/ShowDisplay.vue'
export { default as ParentCard } from './show/ParentCard.vue'

// Lists
export { default as ListPage } from './lists/ListPage.vue'
// The filter contract (#5467): qdadm's filter of several values, and what an app's own filter receives and gives back
export { default as QdMultiFilter } from './lists/filters/QdMultiFilter.vue'
export { useFilterModel, shapeFilterValue, badgeColor } from './lists/filters/contract'
export type { QdFilterProps, QdFilterEmits } from './lists/filters/contract'
export { default as ActionButtons } from './lists/ActionButtons.vue'
export { default as FilterBar } from './lists/FilterBar.vue'

// Editors (vanilla-jsoneditor free)
export { default as KeyValueEditor } from './editors/KeyValueEditor.vue'
export { default as LanguageEditor } from './editors/LanguageEditor.vue'
export { default as ScopeEditor } from './editors/ScopeEditor.vue'
export { default as PermissionEditor } from './editors/PermissionEditor.vue'
export { permissionRegistryFromList, type PermissionRegistry, type Permission as RegistryPermission } from './editors/permissionSuggestions'
export { default as RoleGrantsEditor } from './editors/RoleGrantsEditor.vue'
export { default as JsonEditorFoldable } from './editors/JsonEditorFoldable.vue'
export { default as JsonViewer } from './editors/JsonViewer.vue'

// A value through a structured face or as raw JSON / YAML (#5333). Its raw
// faces come with '@quazardous/qdadm/editors/json' and '.../editors/yaml'.
export { default as StructuredField } from './editors/structured/StructuredField.vue'
export { registerStructuredFace, type StructuredFormat } from './editors/structured/faces'

// NOTE: VanillaJsonEditor and JsonStructuredField require vanilla-jsoneditor
// Import from '@quazardous/qdadm/editors/json' instead:
// import { VanillaJsonEditor, JsonStructuredField } from '@quazardous/qdadm/editors/json'

// Dialogs
export { default as SimpleDialog } from './dialogs/SimpleDialog.vue'
export { default as MultiStepDialog } from './dialogs/MultiStepDialog.vue'
export { default as BulkStatusDialog } from './dialogs/BulkStatusDialog.vue'
export { default as UnsavedChangesDialog } from './dialogs/UnsavedChangesDialog.vue'
export { default as QdRevealOnce } from './dialogs/QdRevealOnce.vue'
// The rich dialog (#5445)
export * from './dialogs/rich'

// Display
export { default as CardsGrid } from './display/CardsGrid.vue'
export { default as RichCardsGrid } from './display/RichCardsGrid.vue'
export { default as CopyableId } from './display/CopyableId.vue'
export { default as EmptyState } from './display/EmptyState.vue'
export { default as IntensityBar } from './display/IntensityBar.vue'
export { default as LogStream } from './display/LogStream.vue'
export { default as QdPending } from './display/QdPending.vue'
export { default as QdPendingZone } from './display/QdPendingZone.vue'
export { default as EntityTimeline } from './display/EntityTimeline.vue'
export { default as PayloadViewer } from './display/PayloadViewer.vue'
export { default as PayloadDiff } from './display/PayloadDiff.vue'
export { default as EmailPreview } from './display/EmailPreview.vue'
export { default as TaskDialog } from './tasks/TaskDialog.vue'
export { default as TaskRunView } from './tasks/TaskRunView.vue'
export { default as TaskSequenceDialog } from './tasks/TaskSequenceDialog.vue'
export { default as TaskPhases } from './tasks/TaskPhases.vue'
export { default as TaskRunStatus } from './tasks/TaskRunStatus.vue'
export { default as TaskHost } from './tasks/TaskHost.vue'
export { default as TaskTray } from './tasks/TaskTray.vue'
export { default as BoolCell } from './BoolCell.vue'
export { default as SeverityTag } from './SeverityTag.vue'
export { default as InfoBanner } from './InfoBanner.vue'
export { default as BannerZone } from './display/BannerZone.vue'

// Pages
export { default as LoginPage } from './pages/LoginPage.vue'
export { default as OAuthCallbackPage } from './pages/OAuthCallbackPage.vue'
export { default as NotFoundPage } from './pages/NotFoundPage.vue'
export { default as QdSettingsHome } from './pages/QdSettingsHome.vue'

// Host integration helper — render in a host App.vue when using
// `Kernel({ existingApp })` so qdadm's DOM extras (Toast,
// ToastListener, DebugBar) appear without the Kernel-managed
// WrappedRoot.
export { default as QdadmRoot } from './QdadmRoot.vue'
