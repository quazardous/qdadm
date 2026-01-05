/**
 * qdadm - Components exports
 */

// Layout
export { default as AppLayout } from './layout/AppLayout.vue'
export { default as BaseLayout } from './layout/BaseLayout.vue'
export { default as PageLayout } from './layout/PageLayout.vue'
export { default as PageHeader } from './layout/PageHeader.vue'
export { default as Breadcrumb } from './layout/Breadcrumb.vue'
export { default as PageNav } from './layout/PageNav.vue'
export { default as Zone } from './layout/Zone.vue'

// Default zone components
export { default as DefaultHeader } from './layout/defaults/DefaultHeader.vue'
export { default as DefaultMenu } from './layout/defaults/DefaultMenu.vue'
export { default as DefaultFooter } from './layout/defaults/DefaultFooter.vue'
export { default as DefaultUserInfo } from './layout/defaults/DefaultUserInfo.vue'
export { default as DefaultBreadcrumb } from './layout/defaults/DefaultBreadcrumb.vue'
export { default as DefaultToaster } from './layout/defaults/DefaultToaster.vue'

// Forms
export { default as FormPage } from './forms/FormPage.vue'
export { default as FormField } from './forms/FormField.vue'
export { default as FormActions } from './forms/FormActions.vue'
export { default as FormTabs } from './forms/FormTabs.vue'
export { default as FormTab } from './forms/FormTab.vue'

// Lists
export { default as ListPage } from './lists/ListPage.vue'
export { default as ActionButtons } from './lists/ActionButtons.vue'
export { default as ActionColumn } from './lists/ActionColumn.vue'
export { default as FilterBar } from './lists/FilterBar.vue'

// Editors (vanilla-jsoneditor free)
export { default as KeyValueEditor } from './editors/KeyValueEditor.vue'
export { default as LanguageEditor } from './editors/LanguageEditor.vue'
export { default as ScopeEditor } from './editors/ScopeEditor.vue'
export { default as PermissionEditor } from './editors/PermissionEditor.vue'
export { default as JsonEditorFoldable } from './editors/JsonEditorFoldable.vue'
export { default as JsonViewer } from './editors/JsonViewer.vue'

// NOTE: VanillaJsonEditor and JsonStructuredField require vanilla-jsoneditor
// Import from 'qdadm/editors' instead:
// import { VanillaJsonEditor, JsonStructuredField } from 'qdadm/editors'

// Dialogs
export { default as SimpleDialog } from './dialogs/SimpleDialog.vue'
export { default as MultiStepDialog } from './dialogs/MultiStepDialog.vue'
export { default as BulkStatusDialog } from './dialogs/BulkStatusDialog.vue'
export { default as UnsavedChangesDialog } from './dialogs/UnsavedChangesDialog.vue'

// Display
export { default as CardsGrid } from './display/CardsGrid.vue'
export { default as RichCardsGrid } from './display/RichCardsGrid.vue'
export { default as CopyableId } from './display/CopyableId.vue'
export { default as EmptyState } from './display/EmptyState.vue'
export { default as IntensityBar } from './display/IntensityBar.vue'
export { default as BoolCell } from './BoolCell.vue'
export { default as SeverityTag } from './SeverityTag.vue'

// Pages
export { default as LoginPage } from './pages/LoginPage.vue'
