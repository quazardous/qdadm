import { ref, computed, provide, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
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
 *
 * @param {Object} options
 * @param {Function} options.getState - Function returning current form state for comparison
 * @param {string} options.routePrefix - Route name for cancel navigation (default: '')
 * @param {boolean} options.guard - Enable unsaved changes guard (default: true)
 * @param {Function} options.onGuardSave - Callback for save button in guard modal
 * @param {Function} options.getId - Custom function to extract entity ID from route (optional)
 * @param {Ref|Object} options.entity - Entity data for dynamic breadcrumb labels (optional)
 * @param {Function} options.breadcrumbLabel - Callback (entity) => string for custom breadcrumb label (optional)
 */
export function useBareForm(options = {}) {
  const {
    getState,
    routePrefix = '',
    guard = true,
    onGuardSave = null,
    getId = null,
    entity = null,
    breadcrumbLabel = null
  } = options

  if (!getState || typeof getState !== 'function') {
    throw new Error('useBareForm requires a getState function')
  }

  // Router, route, toast - common dependencies
  const router = useRouter()
  const route = useRoute()
  const toast = useToast()

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

  // Breadcrumb (auto-generated from route path, with optional entity for dynamic labels)
  const { breadcrumbItems } = useBreadcrumb({ entity, getEntityLabel: breadcrumbLabel })

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
    guardDialog
  }
}
