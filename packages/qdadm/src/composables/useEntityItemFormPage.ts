/**
 * useEntityItemFormPage - Unified procedural builder for CRUD form pages
 *
 * Provides a declarative/procedural API to build form pages with:
 * - Mode detection (create vs edit from route params)
 * - Auto-load entity data in edit mode
 * - Auto-generate form fields from EntityManager.fields schema
 * - Dirty state tracking for unsaved changes
 * - Validation with schema-derived and custom validators
 * - Permission-aware actions (save, delete)
 * - FormPage component binding via props/events
 *
 * ## Basic Usage
 *
 * ```ts
 * const form = useEntityItemFormPage({ entity: 'books' })
 * form.addSaveAction()
 * form.addDeleteAction()
 *
 * <FormPage v-bind="form.props.value" v-on="form.events">
 *   <template #fields>
 *     <FormField v-model="form.data.title" name="title" />
 *   </template>
 * </FormPage>
 * ```
 */
import { ref, computed, watch, onMounted, onUnmounted, provide } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { useDirtyState } from './useDirtyState'
import { useUnsavedChangesGuard, type GuardDialogState } from './useUnsavedChangesGuard'
import { useBreadcrumb } from './useBreadcrumb'
import {
  useEntityItemPage,
  type CreateContext,
} from './useEntityItemPage'
import { registerGuardDialog, unregisterGuardDialog } from './useGuardStore'
import { deepClone } from '../utils/transformers'
import { getSiblingRoutes } from '../module/moduleRegistry'
import {
  useFieldManager,
} from './useFieldManager'

// Import types from dedicated types file
import type {
  Orchestrator,
  ToastHelper,
  ConfirmService,
  AxiosError,
  ErrorSummaryItem,
  PageTitleParts,
} from './useEntityItemFormPage.types'
import { TYPE_MAPPINGS, TYPE_VALIDATORS, snakeCaseToTitle, isEmpty } from './useEntityItemFormPage.types'

// Re-export public types
export type {
  FieldDefinition,
  ResolvedFieldConfig,
  ActionConfig,
  ResolvedAction,
  FormPageProps,
  FormPageEvents,
  UseEntityItemFormPageOptions,
  UseEntityItemFormPageReturn,
  GenerateFieldsOptions,
  AddFieldOptions,
  AddSaveActionOptions,
  AddDeleteActionOptions,
  AddCancelActionOptions,
} from './useEntityItemFormPage.types'

// Import concrete types needed in the function body
import type {
  FieldDefinition,
  ResolvedFieldConfig,
  ActionConfig,
  ResolvedAction,
  FormPageProps,
  FormPageEvents,
  UseEntityItemFormPageOptions,
  UseEntityItemFormPageReturn,
  GenerateFieldsOptions,
  AddSaveActionOptions,
  AddDeleteActionOptions,
  AddCancelActionOptions,
} from './useEntityItemFormPage.types'


/**
 * Unified procedural builder for CRUD form pages
 *
 * @param config - Configuration options
 * @returns Form builder API
 */
export function useEntityItemFormPage(
  config: UseEntityItemFormPageOptions
): UseEntityItemFormPageReturn {
  const {
    entity,
    // Mode detection
    getId = null,
    createRouteSuffix = 'create',
    editRouteSuffix: _editRouteSuffix = 'edit', // eslint-disable-line @typescript-eslint/no-unused-vars
    // Form options
    loadOnMount = true,
    enableGuard = true,
    usePatch = false,
    // Hooks for custom behavior
    transformLoad = (data: unknown) => data,
    transformSave = (data: unknown) => data,
    onLoadSuccess = null,
    onSaveSuccess = null,
    onDeleteSuccess = null,
    // Validation options
    validateOnBlur = true,
    validateOnSubmit = true,
    showErrorSummary = false,
    // Field generation
    generateFormFields = true,
  } = config

  const router = useRouter()
  const route = useRoute()
  const confirm = useConfirm() as ConfirmService

  // Use useEntityItemPage for common infrastructure
  const itemPage = useEntityItemPage({
    entity,
    loadOnMount: false, // Form controls its own loading
    getId,
  })

  const {
    manager,
    orchestrator,
    entityId,
    getInitialDataWithParent,
    parentConfig,
    parentId,
    parentData,
    parentChain,
    getChainDepth,
    hydrator,
  } = itemPage

  // Toast helper - wraps orchestrator.toast for legacy compatibility
  const toast: ToastHelper = {
    add({ severity, summary, detail, emitter }) {
      ;(orchestrator as Orchestrator)?.toast?.[severity]?.(summary, detail, emitter)
    },
  }

  // Read config from manager with option overrides
  const entityName = config.entityName ?? manager.label
  const routePrefix = config.routePrefix ?? manager.routePrefix

  // Initial data: merge user-provided with auto-populated parent foreignKey
  const baseInitialData = getInitialDataWithParent()
  const initialData: Record<string, unknown> = config.initialData
    ? { ...baseInitialData, ...config.initialData }
    : baseInitialData

  /**
   * Detect form mode: 'create' or 'edit'
   */
  const mode = computed<'create' | 'edit'>(() => {
    const routeName = (route.name as string) || ''
    if (routeName.endsWith(createRouteSuffix) || routeName.endsWith('-new')) {
      return 'create'
    }
    if (entityId.value) {
      return 'edit'
    }
    return 'create'
  })

  const isEdit = computed(() => mode.value === 'edit')
  const isCreate = computed(() => mode.value === 'create')

  // ============ STATE ============

  const data = ref<Record<string, unknown>>(deepClone(initialData) as Record<string, unknown>)
  const originalData = ref<unknown>(null)
  const loading = ref(false)
  const saving = ref(false)

  // Dirty state getter
  const dirtyStateGetter = config.getDirtyState || (() => ({ form: data.value }))

  // Dirty state tracking
  const { dirty, dirtyFields, isFieldDirty, takeSnapshot, checkDirty } =
    useDirtyState(dirtyStateGetter)

  // Provide isFieldDirty and dirtyFields for child components (FormField)
  provide('isFieldDirty', isFieldDirty)
  provide('dirtyFields', dirtyFields)

  // Watch for changes to update dirty state
  watch(data, checkDirty, { deep: true })

  // ============ VALIDATION STATE ============

  const errors = ref<Record<string, string>>({})
  const submitted = ref(false)
  const hasErrors = computed(() => Object.keys(errors.value).length > 0)

  const errorSummary = computed<ErrorSummaryItem[]>(() => {
    return Object.entries(errors.value).map(([field, message]) => {
      const fieldConfig = fieldsMap.value.get(field)
      const label = fieldConfig?.label || snakeCaseToTitle(field)
      return { field, label, message }
    })
  })

  // Provide validation state for child components (FormField)
  provide('getFieldError', (name: string) => errors.value[name] || null)
  provide('formSubmitted', submitted)

  // ============ UNSAVED CHANGES GUARD ============

  let guardDialog: GuardDialogState | null = null
  if (enableGuard) {
    const { guardDialog: gd } = useUnsavedChangesGuard(dirty, {
      onSave: async () => { await submit(false) },
    })
    guardDialog = gd
    registerGuardDialog(guardDialog)
    onUnmounted(() => unregisterGuardDialog(guardDialog!))
  }

  // ============ BREADCRUMB ============

  const { breadcrumbItems } = useBreadcrumb({ entity: data })

  // ============ LOADING ============

  async function load(): Promise<void> {
    if (!isEdit.value) {
      data.value = deepClone(initialData) as Record<string, unknown>
      takeSnapshot()
      return
    }

    loading.value = true
    try {
      const responseData = await manager.get(entityId.value!)
      const transformed = transformLoad(responseData)
      data.value = transformed as Record<string, unknown>
      originalData.value = deepClone(transformed)
      takeSnapshot()

      // Update active stack
      hydrator.setCurrentData(transformed)

      if (onLoadSuccess) {
        await onLoadSuccess(transformed)
      }
    } catch (error) {
      const axiosError = error as AxiosError
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: axiosError.response?.data?.detail || `Failed to load ${entityName}`,
        life: 5000,
      })
    } finally {
      loading.value = false
    }
  }

  // ============ SUBMIT ============

  async function submit(andClose = true): Promise<unknown> {
    // Mark as submitted (shows all errors in UI)
    submitted.value = true

    // Validate before submit if enabled
    if (validateOnSubmit && !validate()) {
      toast.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please fix the errors before saving',
        life: 3000,
      })
      return null
    }

    saving.value = true
    try {
      const payload = transformSave(deepClone(data.value))

      let responseData: unknown
      if (isEdit.value) {
        if (usePatch) {
          responseData = await manager.patch(entityId.value!, payload)
        } else {
          responseData = await manager.update(entityId.value!, payload)
        }
      } else {
        // Build context with parent chain for multi-storage routing
        const context: CreateContext | undefined =
          parentConfig.value && parentId.value
            ? { parentChain: [{ entity: parentConfig.value.entity, id: parentId.value }] }
            : undefined
        responseData = await manager.create(payload, context)
      }

      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: `${entityName} ${isEdit.value ? 'updated' : 'created'} successfully`,
        life: 3000,
      })

      // Update data and snapshot
      const savedData = transformLoad(responseData)
      data.value = savedData as Record<string, unknown>
      originalData.value = deepClone(savedData)
      takeSnapshot()

      if (onSaveSuccess) {
        await onSaveSuccess(responseData, andClose)
      }

      if (andClose) {
        // Navigate to list route (or previous page)
        const listRoute = findListRoute()
        router.push(listRoute as { name: string })
      } else if (!isEdit.value) {
        // "Create" without close: navigate to edit route for the created entity
        const createdId = (responseData as Record<string, unknown>)?.[manager.idField]
        if (createdId) {
          const currentRouteName = (route.name as string) || ''
          const editRouteName = currentRouteName.replace(/(-create|-new)$/, '-edit')
          router.push({
            name: editRouteName,
            params: { ...route.params, [manager.idField]: String(createdId) },
          } as { name: string; params: Record<string, string> })
        }
      }

      return responseData
    } catch (error) {
      const axiosError = error as AxiosError
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: axiosError.response?.data?.detail || `Failed to save ${entityName}`,
        life: 5000,
      })
      throw error
    } finally {
      saving.value = false
    }
  }

  // ============ DELETE ============

  async function remove(): Promise<void> {
    if (!isEdit.value) return

    try {
      await manager.delete(entityId.value!)
      toast.add({
        severity: 'success',
        summary: 'Deleted',
        detail: `${entityName} deleted successfully`,
        life: 3000,
      })

      if (onDeleteSuccess) {
        await onDeleteSuccess()
      }

      router.push({ name: routePrefix })
    } catch (error) {
      const axiosError = error as AxiosError
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: axiosError.response?.data?.detail || `Failed to delete ${entityName}`,
        life: 5000,
      })
    }
  }

  function confirmDelete(): void {
    const label = manager.getEntityLabel(data.value) || entityId.value
    confirm.require({
      message: `Delete ${entityName} "${label}"?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptClass: 'p-button-danger',
      accept: remove,
    })
  }

  // ============ RESET ============

  function reset(): void {
    if (originalData.value) {
      data.value = deepClone(originalData.value) as Record<string, unknown>
    } else {
      data.value = deepClone(initialData) as Record<string, unknown>
    }
    takeSnapshot()
    // Clear validation state on reset
    errors.value = {}
    submitted.value = false
  }

  // ============ NAVIGATION ============

  function findListRoute(): { name: string; params?: Record<string, unknown> } {
    // If has parent config, find sibling list route
    if (parentConfig.value) {
      const { entity: parentEntityName, param } = parentConfig.value
      const siblings = getSiblingRoutes(parentEntityName, param)

      const currentRouteName = (route.name as string) || ''
      const baseRouteName = currentRouteName.replace(/-(create|edit|new)$/, '')

      const listRoutes = siblings.filter((r) => {
        const name = (r.name as string) || ''
        const path = (r.path as string) || ''
        return !name.match(/-(create|edit|new)$/) && !path.match(/\/(create|edit|new)$/)
      })

      let listRoute = listRoutes.find((r) => r.name === baseRouteName)

      if (!listRoute && routePrefix) {
        listRoute = listRoutes.find((r) => (r.name as string)?.includes(routePrefix))
      }

      if (!listRoute && listRoutes.length > 0) {
        listRoute = listRoutes[0]
      }

      if (listRoute?.name) {
        const params = { ...route.params } as Record<string, unknown>
        delete params[manager.idField]
        return { name: listRoute.name as string, params }
      }
    }

    return { name: routePrefix! }
  }

  function cancel(): void {
    router.push(findListRoute() as { name: string })
  }

  function goToList(): void {
    router.push(findListRoute() as { name: string })
  }

  // ============ FIELDS & GROUPS (via useFieldManager) ============

  /**
   * Form-specific field resolver
   */
  function resolveFieldConfig(
    name: string,
    fieldConfig: Partial<FieldDefinition>
  ): ResolvedFieldConfig {
    const {
      type = 'text',
      label,
      required = false,
      default: defaultValue,
      options,
      optionLabel = 'label',
      optionValue = 'value',
      placeholder,
      disabled = false,
      readonly = false,
      ...rest
    } = fieldConfig

    const inputType = TYPE_MAPPINGS[type] || 'text'
    const resolvedLabel = label || snakeCaseToTitle(name)

    return {
      name,
      type: inputType,
      schemaType: type,
      label: resolvedLabel,
      required,
      default: defaultValue,
      options: options as unknown[] | undefined,
      optionLabel,
      optionValue,
      placeholder,
      disabled,
      readonly,
      ...rest,
    }
  }

  // Use shared field manager
  const fieldManager = useFieldManager<ResolvedFieldConfig>({
    resolveFieldConfig,
    getSchemaFieldConfig: (name) => manager.getFieldConfig(name) || null,
  })

  // Expose refs for validation (which needs direct access)
  const { fieldsMap, fieldOrder, excludedFields, fields, groups } = fieldManager

  /**
   * Generate fields from manager schema
   */
  function generateFields(options: GenerateFieldsOptions = {}): UseEntityItemFormPageReturn {
    const formFields = manager.getFormFields()
    fieldManager.generateFields(formFields, options)
    // Auto-resolve reference options (async, non-blocking)
    resolveReferences()
    return builderApi
  }

  /**
   * Resolve reference field options from related entities
   */
  async function resolveReferences(): Promise<void> {
    for (const [name, config] of fieldsMap.value.entries()) {
      if (config.options || !config.reference) continue

      try {
        const options = await manager.resolveReferenceOptions(name)
        fieldManager.updateField(name, { options })
      } catch (error) {
        console.warn(
          `[useEntityItemFormPage] Failed to resolve options for field '${name}':`,
          error
        )
      }
    }
  }

  // Chainable method wrapper (returns builderApi for fluent API)
  const chain = <T extends unknown[], R>(fn: (...args: T) => R) =>
    (...args: T): UseEntityItemFormPageReturn => { fn(...args); return builderApi }

  // Field management (chainable)
  const addField = chain(fieldManager.addField)
  const removeField = chain(fieldManager.removeField)
  const excludeField = chain(fieldManager.excludeField)
  const setFieldOrder = chain(fieldManager.setFieldOrder)
  const moveField = chain(fieldManager.moveField)

  // updateField needs custom validation logic
  function updateField(name: string, fieldConfig: Partial<FieldDefinition>): UseEntityItemFormPageReturn {
    if (!fieldsMap.value.has(name)) {
      throw new Error(`Field '${name}' does not exist. Use addField() to create new fields.`)
    }
    fieldManager.updateField(name, fieldConfig)
    return builderApi
  }

  // Direct accessors
  const getFieldConfig = fieldManager.getField
  const getFields = (): ResolvedFieldConfig[] => fields.value

  // Group management (chainable)
  const group = chain(fieldManager.group)
  const defineGroups = chain(fieldManager.defineGroups)

  // Group accessors
  const getGroup = fieldManager.getGroup
  const getFieldsByGroup = fieldManager.getFieldsByGroup
  const getUngroupedFields = fieldManager.getUngroupedFields

  // ============ VALIDATION ============

  function validateField(name: string): string | null {
    const fieldConfig = fieldsMap.value.get(name)
    if (!fieldConfig) return null

    const value = data.value[name]

    if (fieldConfig.required && isEmpty(value)) {
      const error = `${fieldConfig.label} is required`
      errors.value = { ...errors.value, [name]: error }
      return error
    }

    const typeValidator = TYPE_VALIDATORS[fieldConfig.schemaType]
    if (typeValidator) {
      const result = typeValidator(value)
      if (result !== true) {
        errors.value = { ...errors.value, [name]: result as string }
        return result as string
      }
    }

    if (fieldConfig.validate && typeof fieldConfig.validate === 'function') {
      const result = fieldConfig.validate(value, data.value)
      if (result !== true && result !== undefined && result !== null) {
        const error = typeof result === 'string' ? result : `${fieldConfig.label} is invalid`
        errors.value = { ...errors.value, [name]: error }
        return error
      }
    }

    if (errors.value[name]) {
      const { [name]: _removed, ...rest } = errors.value
      void _removed // Intentionally unused - destructuring to omit
      errors.value = rest
    }

    return null
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    for (const fieldName of fieldOrder.value) {
      const fieldConfig = fieldsMap.value.get(fieldName)
      if (!fieldConfig) continue

      const value = data.value[fieldName]

      if (fieldConfig.required && isEmpty(value)) {
        newErrors[fieldName] = `${fieldConfig.label} is required`
        continue
      }

      const typeValidator = TYPE_VALIDATORS[fieldConfig.schemaType]
      if (typeValidator) {
        const result = typeValidator(value)
        if (result !== true) {
          newErrors[fieldName] = result as string
          continue
        }
      }

      if (fieldConfig.validate && typeof fieldConfig.validate === 'function') {
        const result = fieldConfig.validate(value, data.value)
        if (result !== true && result !== undefined && result !== null) {
          newErrors[fieldName] =
            typeof result === 'string' ? result : `${fieldConfig.label} is invalid`
        }
      }
    }

    errors.value = newErrors
    return Object.keys(newErrors).length === 0
  }

  function clearErrors(): void {
    errors.value = {}
    submitted.value = false
  }

  function clearFieldError(name: string): void {
    if (errors.value[name]) {
      const { [name]: _removed, ...rest } = errors.value
      void _removed // Intentionally unused - destructuring to omit
      errors.value = rest
    }
  }

  function getFieldError(name: string): string | null {
    return errors.value[name] || null
  }

  function handleFieldBlur(name: string): void {
    if (validateOnBlur) {
      validateField(name)
    }
  }

  provide('handleFieldBlur', handleFieldBlur)

  // ============ PERMISSION STATE ============

  const canSave = computed(() => {
    return isEdit.value ? manager.canUpdate(data.value) : manager.canCreate()
  })

  const canDeleteRecord = computed(() => {
    return isEdit.value && manager.canDelete(data.value)
  })

  // ============ ACTIONS ============

  const actionsMap = ref<Map<string, ActionConfig>>(new Map())

  function addAction(name: string, actionConfig: Omit<ActionConfig, 'name'>): void {
    actionsMap.value.set(name, { name, ...actionConfig })
  }

  function removeAction(name: string): void {
    actionsMap.value.delete(name)
  }

  function getActions(): ResolvedAction[] {
    const actions: ResolvedAction[] = []
    for (const [, action] of actionsMap.value) {
      if (action.visible && !action.visible({ isEdit: isEdit.value, dirty: dirty.value })) continue
      actions.push({
        ...action,
        isLoading: action.loading ? action.loading() : false,
        isDisabled: action.disabled
          ? action.disabled({ dirty: dirty.value, saving: saving.value })
          : false,
      })
    }
    return actions
  }

  const actions = computed(() => getActions())

  function addSaveAction(options: AddSaveActionOptions = {}): void {
    const { label, andClose = true } = options
    const actionLabel = label || (andClose ? 'Save & Close' : 'Save')

    addAction('save', {
      label: actionLabel,
      icon: andClose ? 'pi pi-check-circle' : 'pi pi-check',
      severity: andClose ? 'success' : 'primary',
      onClick: async () => { await submit(andClose) },
      visible: () => (isEdit.value ? manager.canUpdate() : manager.canCreate()),
      disabled: ({ dirty, saving }) => !dirty || saving,
      loading: () => saving.value,
    })
  }

  function addDeleteAction(options: AddDeleteActionOptions = {}): void {
    const { label = 'Delete' } = options

    addAction('delete', {
      label,
      icon: 'pi pi-trash',
      severity: 'danger',
      onClick: confirmDelete,
      visible: () => isEdit.value && manager.canDelete(data.value),
    })
  }

  function addCancelAction(options: AddCancelActionOptions = {}): void {
    const { label = 'Cancel' } = options

    addAction('cancel', {
      label,
      icon: 'pi pi-times',
      severity: 'secondary',
      onClick: cancel,
      disabled: ({ saving }) => saving,
    })
  }

  // ============ TITLE ============

  const entityLabel = computed(() => {
    return manager.getEntityLabel(data.value)
  })

  const pageTitle = computed(() => {
    if (isEdit.value) {
      const label = entityLabel.value
      return label ? `Edit ${entityName}: ${label}` : `Edit ${entityName}`
    }
    return `Create ${entityName}`
  })

  const pageTitleParts = computed<PageTitleParts>(() => ({
    action: isEdit.value ? 'Edit' : 'Create',
    entityName,
    entityLabel: isEdit.value ? entityLabel.value : undefined,
  }))

  provide('qdadmPageTitleParts', pageTitleParts)

  // ============ LIFECYCLE ============

  onMounted(() => {
    if (loadOnMount) {
      load()
    }
  })

  watch(entityId, (newId, oldId) => {
    if (newId !== oldId && loadOnMount) {
      load()
    }
  })

  // ============ FORMPAGE PROPS/EVENTS ============

  const formProps = computed<FormPageProps>(() => ({
    isEdit: isEdit.value,
    mode: mode.value,
    loading: loading.value,
    saving: saving.value,
    dirty: dirty.value,
    title: pageTitle.value,
    titleParts: pageTitleParts.value,
    fields: fields.value,
    groups: groups.value,
    actions: actions.value,
    canSave: canSave.value,
    canDelete: canDeleteRecord.value,
    errors: errors.value,
    hasErrors: hasErrors.value,
    errorSummary: showErrorSummary ? errorSummary.value : null,
    submitted: submitted.value,
    guardDialog,
  }))

  const formEvents: FormPageEvents = {
    save: () => submit(false),
    saveAndClose: () => submit(true),
    cancel,
    delete: confirmDelete,
  }

  // ============ BUILDER API ============

  const builderApi: UseEntityItemFormPageReturn = {
    // Manager access
    manager,

    // Mode
    mode,
    isEdit,
    isCreate,
    entityId,

    // Parent chain
    parentConfig,
    parentId,
    parentData,
    parentChain,
    getChainDepth,

    // State
    data,
    loading,
    saving,
    dirty,
    dirtyFields,
    originalData,

    // Actions
    load,
    submit,
    cancel,
    remove,
    confirmDelete,
    reset,
    goToList,
    findListRoute,

    // Dirty tracking
    takeSnapshot,
    checkDirty,
    isFieldDirty,

    // Field management
    fields,
    generateFields,
    resolveReferences,
    addField,
    updateField,
    removeField,
    excludeField,
    getFieldConfig,
    getFields,
    setFieldOrder,
    moveField,

    // Group management
    groups,
    group,
    defineGroups,
    getGroup,
    getFieldsByGroup,
    getUngroupedFields,

    // Validation
    errors,
    hasErrors,
    errorSummary,
    submitted,
    validate,
    validateField,
    clearErrors,
    clearFieldError,
    getFieldError,
    handleFieldBlur,

    // Action management
    actions,
    addAction,
    removeAction,
    getActions,
    addSaveAction,
    addDeleteAction,
    addCancelAction,

    // Permissions
    canSave,
    canDeleteRecord,

    // Breadcrumb
    breadcrumb: breadcrumbItems,

    // Guard dialog
    guardDialog,

    // Title helpers
    entityLabel,
    pageTitle,
    pageTitleParts,

    // Utilities
    toast,
    confirm,
    router,
    route,

    // FormPage integration
    props: formProps,
    events: formEvents,

    // Stack hydrator
    hydrator,
  }

  // Auto-generate fields from manager schema if enabled
  if (generateFormFields) {
    generateFields()
  }

  // Auto-disable parent foreignKey field (it's auto-filled from route)
  if (parentConfig.value?.foreignKey && fieldsMap.value.has(parentConfig.value.foreignKey)) {
    updateField(parentConfig.value.foreignKey, { disabled: true })
  }

  return builderApi
}
