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
import { ref, computed, watch, onMounted, onUnmounted, provide, type Ref, type ComputedRef } from 'vue'
import { useRouter, useRoute, type Router, type RouteLocationNormalizedLoaded } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { useDirtyState } from './useDirtyState'
import { useUnsavedChangesGuard, type GuardDialogState } from './useUnsavedChangesGuard'
import { useBreadcrumb, type BreadcrumbDisplayItem } from './useBreadcrumb'
import {
  useEntityItemPage,
  type ParentConfig,
  type UseEntityItemPageReturn,
  type EntityManager,
  type CreateContext,
} from './useEntityItemPage'
import { registerGuardDialog, unregisterGuardDialog } from './useGuardStore'
import { deepClone } from '../utils/transformers'
import { getSiblingRoutes } from '../module/moduleRegistry'
import type { StackHydratorReturn } from '../chain/useStackHydrator'

/**
 * Orchestrator interface
 */
interface Orchestrator {
  get: (entityName: string) => EntityManager
  toast?: {
    success: (summary: string, detail?: string, emitter?: unknown) => void
    error: (summary: string, detail?: string, emitter?: unknown) => void
    warn: (summary: string, detail?: string, emitter?: unknown) => void
    info: (summary: string, detail?: string, emitter?: unknown) => void
    [key: string]: ((summary: string, detail?: string, emitter?: unknown) => void) | undefined
  }
}

/**
 * Field definition from EntityManager schema
 */
export interface FieldDefinition {
  name: string
  type?: string
  schemaType?: string
  label?: string
  required?: boolean
  default?: unknown
  options?: unknown[]
  optionLabel?: string
  optionValue?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  editable?: boolean
  reference?: string
  validate?: (value: unknown, formData: unknown) => boolean | string | null | undefined
  [key: string]: unknown
}

/**
 * Resolved field configuration for form rendering
 */
export interface ResolvedFieldConfig extends FieldDefinition {
  name: string
  type: string
  schemaType: string
  label: string
}

/**
 * Toast helper interface
 */
interface ToastHelper {
  add: (options: {
    severity: 'success' | 'error' | 'warn' | 'info'
    summary: string
    detail?: string
    emitter?: unknown
    life?: number
  }) => void
}

/**
 * Action configuration
 */
export interface ActionConfig {
  name: string
  label: string
  icon?: string
  severity?: string
  onClick: () => void | Promise<void>
  visible?: (ctx: { isEdit: boolean; dirty: boolean }) => boolean
  disabled?: (ctx: { dirty: boolean; saving: boolean }) => boolean
  loading?: () => boolean
}

/**
 * Resolved action for rendering
 */
export interface ResolvedAction extends ActionConfig {
  isLoading: boolean
  isDisabled: boolean
}

/**
 * Error summary item
 */
interface ErrorSummaryItem {
  field: string
  label: string
  message: string
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
 * Form props for FormPage component
 */
export interface FormPageProps {
  isEdit: boolean
  mode: 'create' | 'edit'
  loading: boolean
  saving: boolean
  dirty: boolean
  title: string
  titleParts: PageTitleParts
  fields: ResolvedFieldConfig[]
  actions: ResolvedAction[]
  canSave: boolean
  canDelete: boolean
  errors: Record<string, string>
  hasErrors: boolean
  errorSummary: ErrorSummaryItem[] | null
  submitted: boolean
  guardDialog: GuardDialogState | null
}

/**
 * Form events for FormPage component
 */
export interface FormPageEvents {
  save: () => Promise<unknown>
  saveAndClose: () => Promise<unknown>
  cancel: () => void
  delete: () => void
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
 * PrimeVue confirm service interface
 */
interface ConfirmService {
  require: (options: {
    message: string
    header: string
    icon: string
    acceptClass?: string
    accept: () => void
  }) => void
}

/**
 * Options for useEntityItemFormPage
 */
export interface UseEntityItemFormPageOptions {
  /** Entity name for EntityManager */
  entity: string
  /** Custom function to extract ID from route */
  getId?: (() => string | number | null) | null
  /** Route name suffix for create mode (default: 'create') */
  createRouteSuffix?: string
  /** Route name suffix for edit mode (default: 'edit') */
  editRouteSuffix?: string
  /** Auto-load entity on mount (default: true) */
  loadOnMount?: boolean
  /** Enable unsaved changes guard (default: true) */
  enableGuard?: boolean
  /** Use PATCH instead of PUT for updates (default: false) */
  usePatch?: boolean
  /** Transform loaded data before setting form */
  transformLoad?: (data: unknown) => unknown
  /** Transform form data before saving */
  transformSave?: (data: unknown) => unknown
  /** Callback on successful load */
  onLoadSuccess?: ((data: unknown) => Promise<void> | void) | null
  /** Callback on successful save */
  onSaveSuccess?: ((data: unknown, andClose: boolean) => Promise<void> | void) | null
  /** Callback on successful delete */
  onDeleteSuccess?: (() => Promise<void> | void) | null
  /** Validate field on blur (default: true) */
  validateOnBlur?: boolean
  /** Validate all fields before submit (default: true) */
  validateOnSubmit?: boolean
  /** Show error summary at top of form (default: false) */
  showErrorSummary?: boolean
  /** Auto-generate fields from manager schema (default: true) */
  generateFormFields?: boolean
  /** Custom dirty state getter */
  getDirtyState?: (() => Record<string, unknown>) | null
  /** Override manager.entityName */
  entityName?: string
  /** Override manager.routePrefix */
  routePrefix?: string
  /** Override manager.getInitialData() */
  initialData?: Record<string, unknown>
}

/**
 * Options for generateFields
 */
export interface GenerateFieldsOptions {
  /** Only include these fields */
  only?: string[] | null
  /** Exclude these fields (merged with excludeField calls) */
  exclude?: string[]
}

/**
 * Options for addField
 */
export interface AddFieldOptions {
  /** Insert after this field */
  after?: string | null
  /** Insert before this field */
  before?: string | null
}

/**
 * Position options for moveField
 */
export interface MoveFieldPosition {
  /** Move after this field */
  after?: string | null
  /** Move before this field */
  before?: string | null
}

/**
 * Options for addSaveAction
 */
export interface AddSaveActionOptions {
  /** Custom label */
  label?: string
  /** Close after save (default: true) */
  andClose?: boolean
}

/**
 * Options for addDeleteAction
 */
export interface AddDeleteActionOptions {
  /** Custom label (default: 'Delete') */
  label?: string
}

/**
 * Options for addCancelAction
 */
export interface AddCancelActionOptions {
  /** Custom label (default: 'Cancel') */
  label?: string
}

/**
 * Return type for useEntityItemFormPage
 */
export interface UseEntityItemFormPageReturn {
  // Manager access
  manager: EntityManager

  // Mode
  mode: ComputedRef<'create' | 'edit'>
  isEdit: ComputedRef<boolean>
  isCreate: ComputedRef<boolean>
  entityId: ComputedRef<string | number | null>

  // Parent chain (from route.meta.parent, supports N-level nesting)
  parentConfig: ComputedRef<ParentConfig | null>
  parentId: ComputedRef<string | number | null>
  parentData: ComputedRef<unknown | null>
  parentChain: Ref<Map<number, unknown>>
  getChainDepth: (config?: ParentConfig | null) => number

  // State
  data: Ref<Record<string, unknown>>
  loading: Ref<boolean>
  saving: Ref<boolean>
  dirty: Ref<boolean>
  dirtyFields: Ref<string[]>
  originalData: Ref<unknown>

  // Actions
  load: () => Promise<void>
  submit: (andClose?: boolean) => Promise<unknown>
  cancel: () => void
  remove: () => Promise<void>
  confirmDelete: () => void
  reset: () => void
  goToList: () => void
  findListRoute: () => { name: string; params?: Record<string, unknown> }

  // Dirty tracking
  takeSnapshot: () => void
  checkDirty: () => void
  isFieldDirty: (fieldPath: string) => boolean

  // Field management
  fields: ComputedRef<ResolvedFieldConfig[]>
  generateFields: (options?: GenerateFieldsOptions) => UseEntityItemFormPageReturn
  resolveReferences: () => Promise<void>
  addField: (
    name: string,
    fieldConfig: Partial<FieldDefinition>,
    options?: AddFieldOptions
  ) => UseEntityItemFormPageReturn
  updateField: (name: string, fieldConfig: Partial<FieldDefinition>) => UseEntityItemFormPageReturn
  removeField: (name: string) => UseEntityItemFormPageReturn
  excludeField: (name: string) => UseEntityItemFormPageReturn
  getFieldConfig: (name: string) => ResolvedFieldConfig | undefined
  getFields: () => ResolvedFieldConfig[]
  setFieldOrder: (order: string[]) => UseEntityItemFormPageReturn
  moveField: (name: string, position: MoveFieldPosition) => UseEntityItemFormPageReturn

  // Validation
  errors: Ref<Record<string, string>>
  hasErrors: ComputedRef<boolean>
  errorSummary: ComputedRef<ErrorSummaryItem[]>
  submitted: Ref<boolean>
  validate: () => boolean
  validateField: (name: string) => string | null
  clearErrors: () => void
  clearFieldError: (name: string) => void
  getFieldError: (name: string) => string | null
  handleFieldBlur: (name: string) => void

  // Action management
  actions: ComputedRef<ResolvedAction[]>
  addAction: (name: string, actionConfig: Omit<ActionConfig, 'name'>) => void
  removeAction: (name: string) => void
  getActions: () => ResolvedAction[]
  addSaveAction: (options?: AddSaveActionOptions) => void
  addDeleteAction: (options?: AddDeleteActionOptions) => void
  addCancelAction: (options?: AddCancelActionOptions) => void

  // Permissions
  canSave: ComputedRef<boolean>
  canDeleteRecord: ComputedRef<boolean>

  // Breadcrumb
  breadcrumb: ComputedRef<BreadcrumbDisplayItem[]>

  // Guard dialog (for UnsavedChangesDialog - pass to PageLayout)
  guardDialog: GuardDialogState | null

  // Title helpers
  entityLabel: ComputedRef<string>
  pageTitle: ComputedRef<string>
  pageTitleParts: ComputedRef<PageTitleParts>

  // Utilities
  toast: ToastHelper
  confirm: ConfirmService
  router: Router
  route: RouteLocationNormalizedLoaded

  // FormPage integration
  props: ComputedRef<FormPageProps>
  events: FormPageEvents

  // Stack hydrator (for setting entity data on navigation context)
  hydrator: StackHydratorReturn
}

/**
 * Type mapping from schema types to input component types
 */
const TYPE_MAPPINGS: Record<string, string> = {
  text: 'text',
  string: 'text',
  email: 'email',
  password: 'password',
  number: 'number',
  integer: 'number',
  float: 'number',
  boolean: 'boolean',
  checkbox: 'boolean',
  select: 'select',
  dropdown: 'select',
  date: 'date',
  datetime: 'datetime',
  textarea: 'textarea',
  array: 'array',
  object: 'object',
}

/**
 * Built-in validators by type
 */
const TYPE_VALIDATORS: Record<string, (value: unknown) => boolean | string> = {
  email: (value) => {
    if (!value) return true // Empty handled by required
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value as string) || 'Invalid email address'
  },
  number: (value) => {
    if (value === null || value === undefined || value === '') return true
    return !isNaN(Number(value)) || 'Must be a number'
  },
  integer: (value) => {
    if (value === null || value === undefined || value === '') return true
    return Number.isInteger(Number(value)) || 'Must be an integer'
  },
  url: (value) => {
    if (!value) return true
    try {
      new URL(value as string)
      return true
    } catch {
      return 'Invalid URL'
    }
  },
}

/**
 * Helper: Convert snake_case to Title Case
 */
function snakeCaseToTitle(str: string): string {
  if (!str) return ''
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Check if a value is "empty" for required validation
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

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
    editRouteSuffix = 'edit',
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

  // ============ FIELDS ============

  const fieldsMap = ref<Map<string, ResolvedFieldConfig>>(new Map())
  const fieldOrder = ref<string[]>([])
  const excludedFields = ref<Set<string>>(new Set())

  /**
   * Resolve field configuration from schema definition
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

  function generateFields(options: GenerateFieldsOptions = {}): UseEntityItemFormPageReturn {
    const { only = null, exclude = [] } = options

    const allExcluded = new Set([...excludedFields.value, ...exclude])
    const formFields = manager.getFormFields()

    for (const fieldDef of formFields) {
      const { name, ...fieldConfig } = fieldDef

      if (only && !only.includes(name)) continue
      if (allExcluded.has(name)) continue
      if (fieldsMap.value.has(name)) continue

      const resolvedConfig = resolveFieldConfig(name, fieldConfig)
      fieldsMap.value.set(name, resolvedConfig)
      fieldOrder.value.push(name)
    }

    // Auto-resolve reference options (async, non-blocking)
    resolveReferences()

    return builderApi
  }

  async function resolveReferences(): Promise<void> {
    for (const [name, config] of fieldsMap.value.entries()) {
      if (config.options || !config.reference) continue

      try {
        const options = await manager.resolveReferenceOptions(name)
        const updatedConfig = { ...config, options }
        fieldsMap.value.set(name, updatedConfig)
      } catch (error) {
        console.warn(
          `[useEntityItemFormPage] Failed to resolve options for field '${name}':`,
          error
        )
      }
    }
  }

  function addField(
    name: string,
    fieldConfig: Partial<FieldDefinition>,
    options: AddFieldOptions = {}
  ): UseEntityItemFormPageReturn {
    const { after = null, before = null } = options

    const schemaConfig = manager.getFieldConfig(name) || {}
    const resolvedConfig = resolveFieldConfig(name, { ...schemaConfig, ...fieldConfig })

    fieldsMap.value.set(name, resolvedConfig)

    const currentIndex = fieldOrder.value.indexOf(name)
    if (currentIndex !== -1) {
      fieldOrder.value.splice(currentIndex, 1)
    }

    if (after) {
      const afterIndex = fieldOrder.value.indexOf(after)
      if (afterIndex !== -1) {
        fieldOrder.value.splice(afterIndex + 1, 0, name)
      } else {
        fieldOrder.value.push(name)
      }
    } else if (before) {
      const beforeIndex = fieldOrder.value.indexOf(before)
      if (beforeIndex !== -1) {
        fieldOrder.value.splice(beforeIndex, 0, name)
      } else {
        fieldOrder.value.push(name)
      }
    } else if (currentIndex === -1) {
      fieldOrder.value.push(name)
    } else {
      fieldOrder.value.splice(currentIndex, 0, name)
    }

    return builderApi
  }

  function updateField(
    name: string,
    fieldConfig: Partial<FieldDefinition>
  ): UseEntityItemFormPageReturn {
    if (!fieldsMap.value.has(name)) {
      throw new Error(`Field '${name}' does not exist. Use addField() to create new fields.`)
    }

    const existingConfig = fieldsMap.value.get(name)!
    const mergedConfig = { ...existingConfig, ...fieldConfig } as ResolvedFieldConfig
    fieldsMap.value.set(name, mergedConfig)

    return builderApi
  }

  function excludeField(name: string): UseEntityItemFormPageReturn {
    excludedFields.value.add(name)
    fieldsMap.value.delete(name)
    const idx = fieldOrder.value.indexOf(name)
    if (idx !== -1) {
      fieldOrder.value.splice(idx, 1)
    }
    return builderApi
  }

  function removeField(name: string): UseEntityItemFormPageReturn {
    fieldsMap.value.delete(name)
    const idx = fieldOrder.value.indexOf(name)
    if (idx !== -1) {
      fieldOrder.value.splice(idx, 1)
    }
    return builderApi
  }

  function setFieldOrder(order: string[]): UseEntityItemFormPageReturn {
    fieldOrder.value = order.filter((name) => fieldsMap.value.has(name))
    return builderApi
  }

  function moveField(name: string, position: MoveFieldPosition): UseEntityItemFormPageReturn {
    const { after = null, before = null } = position

    const currentIndex = fieldOrder.value.indexOf(name)
    if (currentIndex === -1) return builderApi

    fieldOrder.value.splice(currentIndex, 1)

    if (after) {
      const afterIndex = fieldOrder.value.indexOf(after)
      if (afterIndex !== -1) {
        fieldOrder.value.splice(afterIndex + 1, 0, name)
      } else {
        fieldOrder.value.push(name)
      }
    } else if (before) {
      const beforeIndex = fieldOrder.value.indexOf(before)
      if (beforeIndex !== -1) {
        fieldOrder.value.splice(beforeIndex, 0, name)
      } else {
        fieldOrder.value.unshift(name)
      }
    }

    return builderApi
  }

  function getFieldConfig(name: string): ResolvedFieldConfig | undefined {
    return fieldsMap.value.get(name)
  }

  function getFields(): ResolvedFieldConfig[] {
    return fieldOrder.value
      .map((name) => fieldsMap.value.get(name))
      .filter((f): f is ResolvedFieldConfig => f !== undefined)
  }

  const fields = computed(() => getFields())

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
      const { [name]: _, ...rest } = errors.value
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
      const { [name]: _, ...rest } = errors.value
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
    entityLabel: isEdit.value ? entityLabel.value : null,
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
