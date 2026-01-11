import { ref, computed, provide, inject, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDirtyState } from './useDirtyState'
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard'
import { useBreadcrumb } from './useBreadcrumb'
import { registerGuardDialog, unregisterGuardDialog } from './useGuardStore'

/**
 * Base form composable providing common form functionality.
 *
 * Usage:
 *   const {
 *     // State
 *     loading, saving, dirty, isEdit, entityId,
 *     // Dirty tracking
 *     isFieldDirty, takeSnapshot, checkDirty,
 *     // Helpers
 *     router, route, toast, cancel
 *   } = useBareForm({
 *     getState: () => ({ form: form.value }),
 *     routePrefix: 'agents',    // for cancel() navigation
 *     entityName: 'Agent',      // for auto-title (optional, or use 'entity' for auto-lookup)
 *     labelField: 'name',       // field to use as entity label (optional)
 *     entity: 'agents',         // EntityManager name for auto metadata (optional)
 *     guard: true,              // enable unsaved changes modal
 *     onGuardSave: () => save() // optional save callback for guard modal
 *   })
 *
 * This composable provides:
 * - Dirty state tracking (form-level and field-level)
 * - isFieldDirty for child FormField components via inject
 * - Unsaved changes guard modal
 * - Common state refs (loading, saving)
 * - Common computed (isEdit, entityId)
 * - Navigation helpers (cancel)
 * - Access to router, route, toast
 * - Auto page title via provide (for PageHeader)
 *
 * @param {Object} options
 * @param {Function} options.getState - Function returning current form state for comparison
 * @param {string} options.routePrefix - Route name for cancel navigation (default: '')
 * @param {string} options.entityName - Display name for entity (default: from manager or derived from routePrefix)
 * @param {string|Function} options.labelField - Field name or function to extract entity label (default: from manager or 'name')
 * @param {string|Ref|Object} options.entity - EntityManager name (string) for auto metadata, OR entity data (Ref/Object) for breadcrumb
 * @param {boolean} options.guard - Enable unsaved changes guard (default: true)
 * @param {Function} options.onGuardSave - Callback for save button in guard modal
 * @param {Function} options.getId - Custom function to extract entity ID from route (optional)
 * @param {Function} options.breadcrumbLabel - Callback (entity) => string for custom breadcrumb label (optional)
 */
export function useBareForm(options = {}) {
  const {
    getState,
    routePrefix = '',
    entityName = null,
    labelField = null,
    guard = true,
    onGuardSave = null,
    getId = null,
    entity = null,
    breadcrumbLabel = null
  } = options

  if (!getState || typeof getState !== 'function') {
    throw new Error('useBareForm requires a getState function')
  }

  // Try to get EntityManager metadata if entity is a string
  let manager = null
  if (typeof entity === 'string') {
    const orchestrator = inject('qdadmOrchestrator', null)
    if (orchestrator) {
      try {
        manager = orchestrator.get(entity)
      } catch {
        // Manager not found, continue without it
      }
    }
  }

  // Router, route, toast - common dependencies
  const router = useRouter()
  const route = useRoute()
  const orchestrator = inject('qdadmOrchestrator', null)

  // Toast helper - wraps orchestrator.toast for legacy compatibility
  const toast = {
    add({ severity, summary, detail, emitter }) {
      orchestrator?.toast[severity]?.(summary, detail, emitter)
    }
  }

  // Common state
  const loading = ref(false)
  const saving = ref(false)

  // Common computed
  const entityId = computed(() => {
    if (getId) return getId()
    return route.params.id || route.params.key || null
  })

  const isEdit = computed(() => !!entityId.value)

  // Dirty state tracking
  const {
    dirty,
    dirtyFields,
    isFieldDirty,
    takeSnapshot,
    checkDirty,
    reset
  } = useDirtyState(getState)

  // Provide isFieldDirty and dirtyFields for child components (FormField)
  provide('isFieldDirty', isFieldDirty)
  provide('dirtyFields', dirtyFields)

  // Resolve entityName: explicit > manager > derived from routePrefix
  const derivedEntityName = routePrefix
    ? routePrefix.charAt(0).toUpperCase() + routePrefix.slice(1).replace(/s$/, '')
    : null
  const effectiveEntityName = entityName || manager?.label || derivedEntityName

  // Resolve labelField: explicit > manager > default 'name'
  const effectiveLabelField = labelField || manager?.labelField || 'name'

  // Provide entity context for child components (e.g., SeverityTag auto-discovery)
  if (routePrefix) {
    const entityNameForProvider = routePrefix.endsWith('s') ? routePrefix : routePrefix + 's'
    provide('mainEntity', entityNameForProvider)
  } else if (typeof entity === 'string') {
    provide('mainEntity', entity)
  }

  // Auto page title parts for PageHeader
  const getEntityLabel = () => {
    const state = getState()
    const formData = state.form || state
    if (!formData) return null
    // Use manager.getEntityLabel if available, otherwise use effectiveLabelField
    if (manager) {
      return manager.getEntityLabel(formData)
    }
    if (typeof effectiveLabelField === 'function') {
      return effectiveLabelField(formData)
    }
    return formData[effectiveLabelField] || null
  }

  const pageTitleParts = computed(() => ({
    action: isEdit.value ? 'Edit' : 'Create',
    entityName: effectiveEntityName,
    entityLabel: isEdit.value ? getEntityLabel() : null
  }))

  // Provide title parts for automatic PageHeader consumption
  if (effectiveEntityName) {
    provide('qdadmPageTitleParts', pageTitleParts)
  }

  // Breadcrumb (auto-generated from route path, with optional entity for dynamic labels)
  // Only pass entity to breadcrumb if it's actual entity data (not a string manager name)
  const breadcrumbEntity = typeof entity === 'string' ? null : entity
  const { breadcrumbItems } = useBreadcrumb({ entity: breadcrumbEntity, getEntityLabel: breadcrumbLabel })

  // Unsaved changes guard
  let guardDialog = null
  if (guard) {
    const guardOptions = onGuardSave ? { onSave: onGuardSave } : {}
    const guardResult = useUnsavedChangesGuard(dirty, guardOptions)
    guardDialog = guardResult.guardDialog
    // Register guardDialog in shared store so AppLayout can render it
    registerGuardDialog(guardDialog)
    onUnmounted(() => unregisterGuardDialog(guardDialog))
  }

  // Navigation helper
  function cancel() {
    if (routePrefix) {
      router.push({ name: routePrefix })
    } else {
      router.back()
    }
  }

  return {
    // Dependencies (for custom logic in form)
    router,
    route,
    toast,

    // Manager (if resolved from entity string)
    manager,

    // State
    loading,
    saving,
    dirty,
    dirtyFields,
    isEdit,
    entityId,

    // Dirty tracking
    isFieldDirty,
    takeSnapshot,
    checkDirty,
    reset,

    // Helpers
    cancel,

    // Breadcrumb
    breadcrumb: breadcrumbItems,

    // Guard dialog (for UnsavedChangesDialog component)
    guardDialog,

    // Title helpers
    pageTitleParts
  }
}
