/**
 * useForm - CRUD form composable extending useBareForm
 *
 * Provides standardized form handling:
 * - Loading and saving states (via EntityManager)
 * - Dirty state tracking (via useBareForm)
 * - Unsaved changes guard (via useBareForm)
 * - Toast notifications
 * - Navigation helpers
 *
 * Usage:
 * ```js
 * // Minimal - reads config from EntityManager
 * const { form, loading, saving, dirty, isEdit, submit, cancel } = useForm({
 *   entity: 'users',
 *   getId: () => route.params.id
 * })
 *
 * // With overrides
 * const { form, ... } = useForm({
 *   entity: 'users',
 *   getId: () => route.params.id,
 *   initialData: { name: '', email: '' },  // Override manager.getInitialData()
 *   routePrefix: 'user',                   // Override manager.routePrefix
 *   entityName: 'User'                     // Override manager.label
 * })
 * ```
 */
import { ref, computed, watch, onMounted, inject, provide } from 'vue'
import { useBareForm } from './useBareForm'
import { deepClone } from '../utils/transformers'

export function useForm(options = {}) {
  const {
    entity,
    getId = null,
    // Callbacks
    transformLoad = (data) => data,
    transformSave = (data) => data,
    onLoadSuccess = null,
    onSaveSuccess = null,
    // Options
    enableGuard = true,
    redirectOnCreate = true,
    getDirtyState = null,
    usePatch = false  // Use PATCH instead of PUT for updates
  } = options

  // Get EntityManager via orchestrator
  const orchestrator = inject('qdadmOrchestrator')
  if (!orchestrator) {
    throw new Error('[qdadm] Orchestrator not provided. Make sure to use createQdadm() with entityFactory.')
  }
  const manager = orchestrator.get(entity)

  // Read config from manager with option overrides
  const routePrefix = options.routePrefix ?? manager.routePrefix
  const entityName = options.entityName ?? manager.label
  const initialData = options.initialData ?? manager.getInitialData()

  // Form-specific state
  const form = ref(deepClone(initialData))
  const originalData = ref(null)

  // Dirty state getter
  const dirtyStateGetter = getDirtyState || (() => ({ form: form.value }))

  // Use base form for common functionality
  const {
    // Dependencies
    router,
    toast,
    // State from useBareForm
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
    // Helpers
    cancel,
    // Breadcrumb
    breadcrumb,
    // Guard dialog for unsaved changes
    guardDialog
  } = useBareForm({
    getState: dirtyStateGetter,
    routePrefix,
    guard: enableGuard,
    onGuardSave: () => submit(false),
    getId
  })

  // Watch for changes
  watch(form, checkDirty, { deep: true })

  // Load entity
  async function load() {
    if (!isEdit.value) {
      form.value = deepClone(initialData)
      takeSnapshot()
      return
    }

    loading.value = true
    try {
      const responseData = await manager.get(entityId.value)
      const data = transformLoad(responseData)
      form.value = data
      originalData.value = deepClone(data)
      takeSnapshot()

      if (onLoadSuccess) {
        await onLoadSuccess(data)
      }
    } catch (error) {
      console.error(`Failed to load ${entityName}:`, error)
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error.response?.data?.detail || `Failed to load ${entityName}`,
        life: 5000
      })
    } finally {
      loading.value = false
    }
  }

  // Submit form
  async function submit(andClose = true) {
    saving.value = true
    try {
      const payload = transformSave(deepClone(form.value))

      let responseData
      if (isEdit.value) {
        if (usePatch) {
          responseData = await manager.patch(entityId.value, payload)
        } else {
          responseData = await manager.update(entityId.value, payload)
        }
      } else {
        responseData = await manager.create(payload)
      }

      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: `${entityName} ${isEdit.value ? 'updated' : 'created'} successfully`,
        life: 3000
      })

      // Update original data and snapshot
      const savedData = transformLoad(responseData)
      form.value = savedData
      originalData.value = deepClone(savedData)
      takeSnapshot()

      if (onSaveSuccess) {
        await onSaveSuccess(responseData, andClose)
      }

      if (andClose) {
        router.push({ name: routePrefix })
      } else if (!isEdit.value && redirectOnCreate) {
        // Redirect to edit mode after create
        const newId = responseData.id || responseData.key
        router.replace({ name: `${routePrefix}-edit`, params: { id: newId } })
      }

      return responseData
    } catch (error) {
      console.error(`Failed to save ${entityName}:`, error)
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error.response?.data?.detail || `Failed to save ${entityName}`,
        life: 5000
      })
      throw error
    } finally {
      saving.value = false
    }
  }

  // Delete entity
  async function remove() {
    if (!isEdit.value) return

    try {
      await manager.delete(entityId.value)
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: `${entityName} deleted successfully`,
        life: 3000
      })
      router.push({ name: routePrefix })
    } catch (error) {
      console.error(`Failed to delete ${entityName}:`, error)
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error.response?.data?.detail || `Failed to delete ${entityName}`,
        life: 5000
      })
    }
  }

  // Reset form to original data
  function reset() {
    if (originalData.value) {
      form.value = deepClone(originalData.value)
    } else {
      form.value = deepClone(initialData)
    }
    takeSnapshot()
  }

  // Load on mount if editing
  onMounted(() => {
    load()
  })

  // ============ COMPUTED TITLE ============

  /**
   * Entity display label (e.g., "David Berlioz" for an agent)
   * Uses manager.getEntityLabel() with labelField config
   */
  const entityLabel = computed(() => {
    return manager.getEntityLabel(form.value)
  })

  /**
   * Auto-generated page title
   * - Edit mode: "Edit Agent: David Berlioz"
   * - Create mode: "Create Agent"
   */
  const pageTitle = computed(() => {
    if (isEdit.value) {
      const label = entityLabel.value
      return label ? `Edit ${entityName}: ${label}` : `Edit ${entityName}`
    }
    return `Create ${entityName}`
  })

  /**
   * Structured page title for decorated rendering
   * Returns { action, entityName, entityLabel } for custom styling
   */
  const pageTitleParts = computed(() => ({
    action: isEdit.value ? 'Edit' : 'Create',
    entityName,
    entityLabel: isEdit.value ? entityLabel.value : null
  }))

  // Provide title parts for automatic PageHeader consumption
  provide('qdadmPageTitleParts', pageTitleParts)

  return {
    // Manager access
    manager,

    // State
    form,
    loading,
    saving,
    dirty,
    dirtyFields,
    isEdit,
    entityId,
    originalData,

    // Actions
    load,
    submit,
    cancel,
    remove,
    reset,
    takeSnapshot,
    checkDirty,
    isFieldDirty,

    // Breadcrumb (auto-generated from route)
    breadcrumb,

    // Guard dialog (for UnsavedChangesDialog - pass to PageLayout)
    guardDialog,

    // Title helpers
    entityLabel,
    pageTitle,
    pageTitleParts
  }
}
