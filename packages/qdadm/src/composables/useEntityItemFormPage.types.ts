/**
 * useEntityItemFormPage - Type definitions
 *
 * Extracted from useEntityItemFormPage.ts for maintainability.
 */
import type { Ref, ComputedRef } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import type { GuardDialogState } from './useUnsavedChangesGuard'
import type { BreadcrumbDisplayItem } from './useBreadcrumb'
import type { ParentConfig, EntityManager } from './useEntityItemPage'
import type { FieldGroup, GroupDefinition, GroupOptions, MoveFieldPosition } from './useFieldManager'
import type { StackHydratorReturn } from '../chain/useStackHydrator'

/**
 * Orchestrator interface
 */
export interface Orchestrator {
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
  group?: string
}

/**
 * Toast helper interface
 */
export interface ToastHelper {
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
export interface ErrorSummaryItem {
  field: string
  label: string
  message: string
}

/**
 * Page title parts for PageHeader
 */
export interface PageTitleParts {
  action: string
  entityName: string | undefined
  entityLabel: string | undefined
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
  groups: FieldGroup<ResolvedFieldConfig>[]
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
export interface AxiosError {
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
export interface ConfirmService {
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

  // Group management
  groups: ComputedRef<FieldGroup<ResolvedFieldConfig>[]>
  group: (name: string, fieldsOrOptions?: string[] | GroupOptions, options?: GroupOptions) => UseEntityItemFormPageReturn
  defineGroups: (definitions: Record<string, GroupDefinition>) => UseEntityItemFormPageReturn
  getGroup: (name: string) => FieldGroup<ResolvedFieldConfig> | undefined
  getFieldsByGroup: (groupName: string) => ResolvedFieldConfig[]
  getUngroupedFields: () => ResolvedFieldConfig[]

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
export const TYPE_MAPPINGS: Record<string, string> = {
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
export const TYPE_VALIDATORS: Record<string, (value: unknown) => boolean | string> = {
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
export function snakeCaseToTitle(str: string): string {
  if (!str) return ''
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Check if a value is "empty" for required validation
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}
