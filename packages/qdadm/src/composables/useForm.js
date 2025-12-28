/**
 * useForm - CRUD form composable extending useBareForm
 *
 * Provides standardized form handling:
 * - Loading and saving states (via EntityManager)
 * - Dirty state tracking (via useBareForm)
 * - Unsaved changes guard (via useBareForm)
 * - Toast notifications
 * - Navigation helpers
 * - form:alter hook for extensibility
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
 *
 * ## form:alter Hook
 *
 * The composable invokes `form:alter` and `{entity}:form:alter` hooks after
 * form initialization (load for edit, or initial data for create). This allows
 * modules to modify form configuration dynamically.
 *
 * Hook context structure:
 * @typedef {object} FormAlterConfig
 * @property {string} entity - Entity name
 * @property {Array} fields - Field definitions from manager
 * @property {boolean} isEdit - Whether form is in edit mode
 * @property {*} entityId - Entity ID (null for create)
 * @property {object} form - Current form data
 * @property {object} manager - EntityManager reference
 *
 * @example
 * // Register a hook to modify form fields
 * hooks.register('form:alter', (config) => {
 *   if (config.entity === 'books') {
 *     // Add a computed field
 *     config.fields.push({ name: 'fullTitle', computed: true, readonly: true })
 *   }
 *   return config
 * })
 *
 * @example
 * // Entity-specific hook
 * hooks.register('books:form:alter', (config) => {
 *   // Modify field visibility based on edit mode
 *   if (!config.isEdit) {
 *     config.fields = config.fields.filter(f => f.name !== 'internal_id')
 *   }
 *   return config
 * })
 */
import { ref, computed, watch, onMounted, inject, provide } from 'vue'
import { useBareForm } from './useBareForm'
import { useHooks } from './useHooks'
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

  // Get HookRegistry for form:alter hook (optional, may not exist in tests)
  const hooks = useHooks()

  // Read config from manager with option overrides
  const routePrefix = options.routePrefix ?? manager.routePrefix
  const entityName = options.entityName ?? manager.label
  const initialData = options.initialData ?? manager.getInitialData()

  // Form-specific state
  const form = ref(deepClone(initialData))
  const originalData = ref(null)

  /**
   * Altered fields configuration after form:alter hook processing
   *
   * Contains the field definitions modified by registered hooks.
   * Modules can register form:alter hooks to modify field visibility,
   * add/remove fields, change labels, or modify validation rules.
   *
   * @type {import('vue').Ref<Array<object>>}
   */
  const alteredFields = ref([])

  /**
   * Whether form:alter hooks have been invoked
   * @type {import('vue').Ref<boolean>}
   */
  const hooksInvoked = ref(false)

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

  // ============ FORM:ALTER HOOK ============

  /**
   * Invoke form:alter hooks to allow modules to modify form configuration
   *
   * Builds a config snapshot from current state, passes it through the hook chain,
   * and stores the altered fields configuration.
   *
   * Hook context structure:
   * @typedef {object} FormAlterConfig
   * @property {string} entity - Entity name
   * @property {Array} fields - Field definitions from manager.getFormFields()
   * @property {boolean} isEdit - Whether form is in edit mode
   * @property {*} entityId - Entity ID (null for create)
   * @property {object} form - Current form data
   * @property {object} manager - EntityManager reference
   *
   * @example
   * // Register a hook to add a custom field
   * hooks.register('form:alter', (config) => {
   *   if (config.entity === 'books') {
   *     config.fields.push({ name: 'custom', type: 'text', label: 'Custom' })
   *   }
   *   return config
   * })
   *
   * @example
   * // Register entity-specific hook
   * hooks.register('books:form:alter', (config) => {
   *   // Hide internal_id in create mode
   *   if (!config.isEdit) {
   *     config.fields = config.fields.filter(f => f.name !== 'internal_id')
   *   }
   *   return config
   * })
   */
  async function invokeFormAlterHook() {
    if (!hooks) return

    // Get fields from manager (if available)
    const managerFields = typeof manager.getFormFields === 'function'
      ? manager.getFormFields()
      : (manager.fields || [])

    // Build config snapshot
    const configSnapshot = {
      entity,
      fields: deepClone(managerFields),
      isEdit: isEdit.value,
      entityId: entityId.value,
      form: form.value,
      manager,
    }

    // Invoke generic form:alter hook
    let alteredConfig = await hooks.alter('form:alter', configSnapshot)

    // Invoke entity-specific hook: {entity}:form:alter
    const entityHookName = `${entity}:form:alter`
    if (hooks.hasHook(entityHookName)) {
      alteredConfig = await hooks.alter(entityHookName, alteredConfig)
    }

    // Store altered fields for consumption by FormPage
    alteredFields.value = alteredConfig.fields || []
    hooksInvoked.value = true
  }

  // Load entity
  async function load() {
    if (!isEdit.value) {
      form.value = deepClone(initialData)
      takeSnapshot()
      // Invoke form:alter hooks for create mode
      await invokeFormAlterHook()
      return
    }

    loading.value = true
    try {
      const responseData = await manager.get(entityId.value)
      const data = transformLoad(responseData)
      form.value = data
      originalData.value = deepClone(data)
      takeSnapshot()

      // Invoke form:alter hooks after data is loaded
      await invokeFormAlterHook()

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

    // form:alter hook results
    alteredFields,
    hooksInvoked,
    invokeFormAlterHook,

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
