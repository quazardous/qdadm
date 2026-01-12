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
 * ```ts
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
 */
import { ref, computed, watch, onMounted, inject, provide, type Ref, type ComputedRef } from 'vue'
import type { Router } from 'vue-router'
import { useBareForm, type UseBareFormReturn } from './useBareForm'
import { useHooks } from './useHooks'
import { useStackHydrator } from '../chain/useStackHydrator'
import { deepClone } from '../utils/transformers'
import type { GuardDialogState } from './useUnsavedChangesGuard'
import type { BreadcrumbDisplayItem } from './useBreadcrumb'

/**
 * Entity manager interface
 */
interface EntityManager {
  idField: string
  label?: string
  labelField?: string
  routePrefix?: string
  fields?: FieldDefinition[]
  getInitialData: () => Record<string, unknown>
  getFormFields?: () => FieldDefinition[]
  getEntityLabel: (data: unknown) => string
  get: (id: string | number) => Promise<unknown>
  create: (data: unknown) => Promise<unknown>
  update: (id: string | number, data: unknown) => Promise<unknown>
  patch: (id: string | number, data: unknown) => Promise<unknown>
  delete: (id: string | number) => Promise<void>
}

/**
 * Orchestrator interface
 */
interface Orchestrator {
  get: (entityName: string) => EntityManager
  toast: {
    success: (summary: string, detail?: string, emitter?: unknown) => void
    error: (summary: string, detail?: string, emitter?: unknown) => void
    warn: (summary: string, detail?: string, emitter?: unknown) => void
    info: (summary: string, detail?: string, emitter?: unknown) => void
  }
}

/**
 * Field definition interface
 */
interface FieldDefinition {
  name: string
  type?: string
  label?: string
  computed?: boolean
  readonly?: boolean
  [key: string]: unknown
}

/**
 * Form alter config passed to hooks
 */
export interface FormAlterConfig {
  entity: string
  fields: FieldDefinition[]
  isEdit: boolean
  entityId: string | number | null
  form: unknown
  manager: EntityManager
}

/**
 * Page title parts for PageHeader
 */
interface PageTitleParts {
  action: string
  entityName: string | undefined
  entityLabel: string | null
}

/**
 * Axios-like error interface
 */
interface AxiosError {
  response?: {
    data?: {
      detail?: string
    }
  }
  message?: string
}

/**
 * Options for useForm
 */
export interface UseFormOptions {
  /** Entity name for EntityManager */
  entity: string
  /** Custom function to extract entity ID from route */
  getId?: (() => string | number | null) | null
  /** Transform loaded data before setting form */
  transformLoad?: (data: unknown) => unknown
  /** Transform form data before saving */
  transformSave?: (data: unknown) => unknown
  /** Callback on successful load */
  onLoadSuccess?: ((data: unknown) => Promise<void> | void) | null
  /** Callback on successful save */
  onSaveSuccess?: ((data: unknown, andClose: boolean) => Promise<void> | void) | null
  /** Enable unsaved changes guard (default: true) */
  enableGuard?: boolean
  /** Redirect to edit page after create (default: true) */
  redirectOnCreate?: boolean
  /** Custom dirty state getter */
  getDirtyState?: (() => Record<string, unknown>) | null
  /** Use PATCH instead of PUT for updates (default: false) */
  usePatch?: boolean
  /** Override manager.routePrefix */
  routePrefix?: string
  /** Override manager.label */
  entityName?: string
  /** Override manager.getInitialData() */
  initialData?: Record<string, unknown>
}

/**
 * Return type for useForm
 */
export interface UseFormReturn {
  // Manager access
  manager: EntityManager

  // State
  form: Ref<unknown>
  loading: Ref<boolean>
  saving: Ref<boolean>
  dirty: Ref<boolean>
  dirtyFields: Ref<string[]>
  isEdit: ComputedRef<boolean>
  entityId: ComputedRef<string | number | null>
  originalData: Ref<unknown>

  // form:alter hook results
  alteredFields: Ref<FieldDefinition[]>
  hooksInvoked: Ref<boolean>
  invokeFormAlterHook: () => Promise<void>

  // Actions
  load: () => Promise<void>
  submit: (andClose?: boolean) => Promise<unknown>
  cancel: () => void
  remove: () => Promise<void>
  reset: () => void
  takeSnapshot: () => void
  checkDirty: () => void
  isFieldDirty: (fieldPath: string) => boolean

  // Breadcrumb (auto-generated from route)
  breadcrumb: ComputedRef<BreadcrumbDisplayItem[]>

  // Guard dialog (for UnsavedChangesDialog - pass to PageLayout)
  guardDialog: GuardDialogState | null

  // Title helpers
  entityLabel: ComputedRef<string>
  pageTitle: ComputedRef<string>
  pageTitleParts: ComputedRef<PageTitleParts>
}

/**
 * CRUD form composable
 *
 * @param options - Configuration options
 * @returns Form utilities and state
 */
export function useForm(options: UseFormOptions): UseFormReturn {
  const {
    entity,
    getId = null,
    // Callbacks
    transformLoad = (data: unknown) => data,
    transformSave = (data: unknown) => data,
    onLoadSuccess = null,
    onSaveSuccess = null,
    // Options
    enableGuard = true,
    redirectOnCreate = true,
    getDirtyState = null,
    usePatch = false, // Use PATCH instead of PUT for updates
  } = options

  // Get EntityManager via orchestrator
  const orchestrator = inject<Orchestrator | null>('qdadmOrchestrator')
  if (!orchestrator) {
    throw new Error(
      '[qdadm] Orchestrator not provided. Make sure to use createQdadm() with entityFactory.'
    )
  }
  const manager = orchestrator.get(entity)

  // Get HookRegistry for form:alter hook (optional, may not exist in tests)
  const hooks = useHooks()

  // Active stack for navigation context
  const hydrator = useStackHydrator()

  // Read config from manager with option overrides
  const routePrefix = options.routePrefix ?? manager.routePrefix
  const entityName = options.entityName ?? manager.label
  const initialData = options.initialData ?? manager.getInitialData()

  // Form-specific state
  const form = ref<unknown>(deepClone(initialData))
  const originalData = ref<unknown>(null)

  /**
   * Altered fields configuration after form:alter hook processing
   *
   * Contains the field definitions modified by registered hooks.
   * Modules can register form:alter hooks to modify field visibility,
   * add/remove fields, change labels, or modify validation rules.
   */
  const alteredFields = ref<FieldDefinition[]>([])

  /**
   * Whether form:alter hooks have been invoked
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
    guardDialog,
  } = useBareForm({
    getState: dirtyStateGetter,
    routePrefix,
    guard: enableGuard,
    onGuardSave: async () => { await submit(false) },
    getId,
  })

  // Watch for changes
  watch(form, checkDirty, { deep: true })

  // ============ FORM:ALTER HOOK ============

  /**
   * Invoke form:alter hooks to allow modules to modify form configuration
   *
   * Builds a config snapshot from current state, passes it through the hook chain,
   * and stores the altered fields configuration.
   */
  async function invokeFormAlterHook(): Promise<void> {
    if (!hooks) return

    // Get fields from manager (if available)
    const managerFields =
      typeof manager.getFormFields === 'function'
        ? manager.getFormFields()
        : manager.fields || []

    // Build config snapshot
    const configSnapshot: FormAlterConfig = {
      entity,
      fields: deepClone(managerFields) as FieldDefinition[],
      isEdit: isEdit.value,
      entityId: entityId.value,
      form: form.value,
      manager,
    }

    // Invoke generic form:alter hook
    let alteredConfig = (await hooks.alter('form:alter', configSnapshot)) as FormAlterConfig

    // Invoke entity-specific hook: {entity}:form:alter
    const entityHookName = `${entity}:form:alter`
    if (hooks.hasHook(entityHookName)) {
      alteredConfig = (await hooks.alter(entityHookName, alteredConfig)) as FormAlterConfig
    }

    // Store altered fields for consumption by FormPage
    alteredFields.value = alteredConfig.fields || []
    hooksInvoked.value = true
  }

  // Load entity
  async function load(): Promise<void> {
    if (!isEdit.value) {
      form.value = deepClone(initialData)
      takeSnapshot()
      // Invoke form:alter hooks for create mode
      await invokeFormAlterHook()
      return
    }

    loading.value = true
    try {
      const responseData = await manager.get(entityId.value!)
      const data = transformLoad(responseData)
      form.value = data
      originalData.value = deepClone(data)
      takeSnapshot()

      // Update active stack
      hydrator.setCurrentData(data)

      // Invoke form:alter hooks after data is loaded
      await invokeFormAlterHook()

      if (onLoadSuccess) {
        await onLoadSuccess(data)
      }
    } catch (error) {
      console.error(`Failed to load ${entityName}:`, error)
      const axiosError = error as AxiosError
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: axiosError.response?.data?.detail || `Failed to load ${entityName}`,
      })
    } finally {
      loading.value = false
    }
  }

  // Submit form
  async function submit(andClose = true): Promise<unknown> {
    saving.value = true
    try {
      const payload = transformSave(deepClone(form.value))

      let responseData: unknown
      if (isEdit.value) {
        if (usePatch) {
          responseData = await manager.patch(entityId.value!, payload)
        } else {
          responseData = await manager.update(entityId.value!, payload)
        }
      } else {
        responseData = await manager.create(payload)
      }

      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: `${entityName} ${isEdit.value ? 'updated' : 'created'} successfully`,
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
        const newId = (responseData as Record<string, unknown>)[manager.idField]
        router.replace({ name: `${routePrefix}-edit`, params: { id: newId as string } })
      }

      return responseData
    } catch (error) {
      console.error(`Failed to save ${entityName}:`, error)
      const axiosError = error as AxiosError
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: axiosError.response?.data?.detail || `Failed to save ${entityName}`,
      })
      throw error
    } finally {
      saving.value = false
    }
  }

  // Delete entity
  async function remove(): Promise<void> {
    if (!isEdit.value) return

    try {
      await manager.delete(entityId.value!)
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: `${entityName} deleted successfully`,
      })
      router.push({ name: routePrefix })
    } catch (error) {
      console.error(`Failed to delete ${entityName}:`, error)
      const axiosError = error as AxiosError
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: axiosError.response?.data?.detail || `Failed to delete ${entityName}`,
      })
    }
  }

  // Reset form to original data
  function reset(): void {
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
  const pageTitleParts = computed<PageTitleParts>(() => ({
    action: isEdit.value ? 'Edit' : 'Create',
    entityName,
    entityLabel: isEdit.value ? entityLabel.value : null,
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
    pageTitleParts,
  }
}
