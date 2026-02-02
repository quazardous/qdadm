/**
 * useEntityItemShowPage - Unified procedural builder for read-only detail pages
 *
 * Provides a declarative/procedural API to build show pages with:
 * - Auto-load entity data from route params
 * - Auto-generate display fields from EntityManager.fields schema
 * - Permission-aware actions (edit, delete, back)
 * - ShowPage component binding via props/events
 *
 * ## Basic Usage
 *
 * ```ts
 * const show = useEntityItemShowPage({ entity: 'books' })
 * show.generateFields()
 * show.addEditAction()
 * show.addBackAction()
 *
 * <ShowPage v-bind="show.props.value" v-on="show.events">
 *   <template #fields>
 *     <ShowField v-for="f in show.fields.value" :key="f.name" :field="f" :value="show.data.value[f.name]" />
 *   </template>
 * </ShowPage>
 * ```
 *
 * ## Auto-render mode
 *
 * ```ts
 * const show = useEntityItemShowPage({ entity: 'books' })
 * show.generateFields()
 * show.addEditAction()
 *
 * // ShowPage can auto-render fields when data is passed
 * <ShowPage v-bind="show.props.value" v-on="show.events" />
 * ```
 */
import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { useRouter, useRoute, type Router } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import {
  useEntityItemPage,
  type ParentConfig,
  type EntityManager,
} from './useEntityItemPage'
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
  reference?: string
  referenceRoute?: string | ((value: unknown) => { name: string; params: Record<string, unknown> })
  referenceLabel?: string | ((value: unknown, option?: unknown) => string)
  options?: unknown[]
  optionLabel?: string
  optionValue?: string
  // Display options
  dateFormat?: string
  currencyCode?: string
  locale?: string
  booleanLabels?: { true: string; false: string }
  severity?: string | ((value: unknown) => string)
  imageWidth?: string
  imageHeight?: string
  render?: (value: unknown) => string
  [key: string]: unknown
}

/**
 * Resolved field configuration for display rendering
 */
export interface ResolvedFieldConfig extends FieldDefinition {
  name: string
  type: string
  schemaType: string
  label: string
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
  visible?: (ctx: { canEdit: boolean; canDelete: boolean }) => boolean
  disabled?: (ctx: { loading: boolean }) => boolean
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
 * Page title parts for PageHeader
 */
interface PageTitleParts {
  action: string
  entityName: string | undefined
  entityLabel: string | undefined
}

/**
 * Show props for ShowPage component
 */
export interface ShowPageProps {
  loading: boolean
  title: string
  titleParts: PageTitleParts
  fields: ResolvedFieldConfig[]
  data: Record<string, unknown> | null
  actions: ResolvedAction[]
  fetchError: string | null
}

/**
 * Show events for ShowPage component
 */
export interface ShowPageEvents {
  edit: () => void
  delete: () => void
  back: () => void
}

/**
 * Type mapping from schema types to display types
 */
const TYPE_MAPPINGS: Record<string, string> = {
  text: 'text',
  string: 'text',
  email: 'email',
  password: 'password',
  number: 'number',
  integer: 'number',
  float: 'number',
  decimal: 'number',
  currency: 'currency',
  boolean: 'boolean',
  bool: 'boolean',
  date: 'date',
  datetime: 'datetime',
  time: 'datetime',
  timestamp: 'datetime',
  select: 'select',
  enum: 'select',
  textarea: 'textarea',
  longtext: 'textarea',
  reference: 'reference',
  foreignKey: 'reference',
  image: 'image',
  url: 'url',
  link: 'url',
  json: 'json',
  object: 'json',
  array: 'json',
  badge: 'badge',
  tag: 'badge',
}

/**
 * Utility: Convert snake_case/kebab-case to Title Case
 */
function snakeCaseToTitle(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

/**
 * Options for useEntityItemShowPage
 */
export interface UseEntityItemShowPageOptions {
  /** Entity name */
  entity: string
  /** Auto-load entity on mount (default: true) */
  loadOnMount?: boolean
  /** Transform hook for loaded data */
  transformLoad?: (data: unknown) => unknown
  /** Callback on successful load */
  onLoadSuccess?: ((data: unknown) => Promise<void> | void) | null
  /** Callback on load error */
  onLoadError?: ((error: unknown) => Promise<void> | void) | null
}

/**
 * Options for generateFields
 */
export interface GenerateFieldsOptions {
  /** Only include these fields */
  only?: string[] | null
  /** Exclude these fields */
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
 * Return type for useEntityItemShowPage
 */
export interface UseEntityItemShowPageReturn {
  // State from base
  data: Ref<unknown>
  loading: Ref<boolean>
  error: Ref<string | null>
  entityId: ComputedRef<string | number | null>
  entityLabel: ComputedRef<string | null>
  isLoaded: ComputedRef<boolean>

  // Parent chain
  parentConfig: ComputedRef<ParentConfig | null>
  parentId: ComputedRef<string | number | null>
  parentData: ComputedRef<unknown | null>

  // Field management
  fields: ComputedRef<ResolvedFieldConfig[]>
  generateFields: (options?: GenerateFieldsOptions) => UseEntityItemShowPageReturn
  addField: (name: string, fieldConfig: Partial<FieldDefinition>, options?: AddFieldOptions) => UseEntityItemShowPageReturn
  updateField: (name: string, updates: Partial<FieldDefinition>) => UseEntityItemShowPageReturn
  removeField: (name: string) => UseEntityItemShowPageReturn
  excludeField: (name: string) => UseEntityItemShowPageReturn
  reorderFields: (fieldNames: string[]) => UseEntityItemShowPageReturn
  getField: (name: string) => ResolvedFieldConfig | undefined

  // Action management
  actions: ComputedRef<ResolvedAction[]>
  addAction: (action: ActionConfig) => UseEntityItemShowPageReturn
  addEditAction: (options?: { label?: string; icon?: string }) => UseEntityItemShowPageReturn
  addDeleteAction: (options?: { label?: string; icon?: string; confirm?: boolean }) => UseEntityItemShowPageReturn
  addBackAction: (options?: { label?: string; icon?: string; route?: string }) => UseEntityItemShowPageReturn
  removeAction: (name: string) => UseEntityItemShowPageReturn

  // Permissions
  canEdit: ComputedRef<boolean>
  canDelete: ComputedRef<boolean>

  // Page title
  title: ComputedRef<string>
  titleParts: ComputedRef<PageTitleParts>

  // Component binding
  props: ComputedRef<ShowPageProps>
  events: ShowPageEvents

  // Actions
  load: (id?: string | number | null) => Promise<unknown | null>
  reload: () => Promise<unknown | null>
  goToEdit: () => void
  goBack: () => void
  deleteEntity: () => Promise<void>

  // References
  manager: EntityManager
  orchestrator: Orchestrator
  hydrator: StackHydratorReturn
}

/**
 * Confirm service interface
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

export function useEntityItemShowPage(
  options: UseEntityItemShowPageOptions
): UseEntityItemShowPageReturn {
  const { entity, loadOnMount = true, transformLoad, onLoadSuccess, onLoadError } = options

  const router: Router = useRouter()
  const route = useRoute()
  const confirm = useConfirm() as ConfirmService

  // Use base composable
  const base = useEntityItemPage({
    entity,
    loadOnMount,
    transformLoad,
    onLoadSuccess,
    onLoadError,
  })

  const { manager, orchestrator: baseOrchestrator, data, loading, error, entityId, entityLabel, isLoaded, hydrator } = base
  // Cast orchestrator to include toast methods
  const orchestrator = baseOrchestrator as Orchestrator

  // ============ FIELD MANAGEMENT ============

  const fieldsMap = ref<Map<string, ResolvedFieldConfig>>(new Map())
  const fieldOrder = ref<string[]>([])
  const excludedFields = ref<Set<string>>(new Set())

  /**
   * Resolve field configuration from schema definition
   */
  function resolveFieldConfig(name: string, fieldConfig: Partial<FieldDefinition>): ResolvedFieldConfig {
    const {
      type = 'text',
      schemaType = type,
      label = '',
      reference = '',
      ...rest
    } = fieldConfig

    const displayType = TYPE_MAPPINGS[type] || TYPE_MAPPINGS[schemaType] || 'text'
    const resolvedLabel = label || snakeCaseToTitle(name)

    // Auto-set reference route if reference entity is specified
    let referenceRoute = rest.referenceRoute
    if (reference && !referenceRoute) {
      // Default: entity-show route
      const refManager = orchestrator.get(reference)
      if (refManager) {
        referenceRoute = (value: unknown) => ({
          name: `${refManager.routePrefix || reference}-show`,
          params: { [refManager.idField]: value },
        })
      }
    }

    return {
      name,
      type: displayType,
      schemaType,
      label: resolvedLabel,
      reference,
      referenceRoute,
      ...rest,
    }
  }

  function generateFields(genOptions: GenerateFieldsOptions = {}): UseEntityItemShowPageReturn {
    const { only = null, exclude = [] } = genOptions

    const allExcluded = new Set([...excludedFields.value, ...exclude])
    const formFields = manager.getFormFields?.() || []

    for (const fieldConfig of formFields) {
      const name = fieldConfig.name
      if (!name) continue

      if (only && !only.includes(name)) continue
      if (allExcluded.has(name)) continue
      if (fieldsMap.value.has(name)) continue

      const resolvedConfig = resolveFieldConfig(name, fieldConfig)
      fieldsMap.value.set(name, resolvedConfig)
      fieldOrder.value.push(name)
    }

    return returnValue
  }

  function addField(
    name: string,
    fieldConfig: Partial<FieldDefinition>,
    addOptions: AddFieldOptions = {}
  ): UseEntityItemShowPageReturn {
    const { after = null, before = null } = addOptions

    const schemaConfig = manager.getFieldConfig?.(name) || {}
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
        fieldOrder.value.unshift(name)
      }
    } else {
      fieldOrder.value.push(name)
    }

    return returnValue
  }

  function updateField(name: string, updates: Partial<FieldDefinition>): UseEntityItemShowPageReturn {
    const existing = fieldsMap.value.get(name)
    if (existing) {
      fieldsMap.value.set(name, { ...existing, ...updates } as ResolvedFieldConfig)
    }
    return returnValue
  }

  function removeField(name: string): UseEntityItemShowPageReturn {
    fieldsMap.value.delete(name)
    const index = fieldOrder.value.indexOf(name)
    if (index !== -1) {
      fieldOrder.value.splice(index, 1)
    }
    return returnValue
  }

  function excludeField(name: string): UseEntityItemShowPageReturn {
    excludedFields.value.add(name)
    removeField(name)
    return returnValue
  }

  function reorderFields(fieldNames: string[]): UseEntityItemShowPageReturn {
    fieldOrder.value = fieldNames.filter((name) => fieldsMap.value.has(name))
    return returnValue
  }

  function getField(name: string): ResolvedFieldConfig | undefined {
    return fieldsMap.value.get(name)
  }

  const fields = computed<ResolvedFieldConfig[]>(() => {
    return fieldOrder.value
      .map((name) => fieldsMap.value.get(name))
      .filter((f): f is ResolvedFieldConfig => f !== undefined)
  })

  // ============ ACTION MANAGEMENT ============

  const actionsMap = ref<Map<string, ActionConfig>>(new Map())
  const actionOrder = ref<string[]>([])

  const canEdit = computed(() => manager.canUpdate?.(data.value) ?? true)
  const canDelete = computed(() => manager.canDelete?.(data.value) ?? true)

  function addAction(action: ActionConfig): UseEntityItemShowPageReturn {
    actionsMap.value.set(action.name, action)
    if (!actionOrder.value.includes(action.name)) {
      actionOrder.value.push(action.name)
    }
    return returnValue
  }

  function addEditAction(editOptions: { label?: string; icon?: string } = {}): UseEntityItemShowPageReturn {
    const { label = 'Edit', icon = 'pi pi-pencil' } = editOptions
    return addAction({
      name: 'edit',
      label,
      icon,
      severity: 'primary',
      onClick: goToEdit,
      visible: ({ canEdit }) => canEdit,
    })
  }

  function addDeleteAction(
    deleteOptions: { label?: string; icon?: string; confirm?: boolean } = {}
  ): UseEntityItemShowPageReturn {
    const { label = 'Delete', icon = 'pi pi-trash', confirm: confirmDelete = true } = deleteOptions
    return addAction({
      name: 'delete',
      label,
      icon,
      severity: 'danger',
      onClick: () => {
        if (confirmDelete) {
          confirm.require({
            message: `Are you sure you want to delete this ${manager.label || entity}?`,
            header: 'Confirm Delete',
            icon: 'pi pi-exclamation-triangle',
            acceptClass: 'p-button-danger',
            accept: () => deleteEntity(),
          })
        } else {
          deleteEntity()
        }
      },
      visible: ({ canDelete }) => canDelete,
    })
  }

  function addBackAction(backOptions: { label?: string; icon?: string; route?: string } = {}): UseEntityItemShowPageReturn {
    const { label = 'Back', icon = 'pi pi-arrow-left', route: backRoute } = backOptions
    return addAction({
      name: 'back',
      label,
      icon,
      severity: 'secondary',
      onClick: () => {
        if (backRoute) {
          router.push({ name: backRoute })
        } else {
          goBack()
        }
      },
    })
  }

  function removeAction(name: string): UseEntityItemShowPageReturn {
    actionsMap.value.delete(name)
    const index = actionOrder.value.indexOf(name)
    if (index !== -1) {
      actionOrder.value.splice(index, 1)
    }
    return returnValue
  }

  const actions = computed<ResolvedAction[]>(() => {
    const ctx = { canEdit: canEdit.value, canDelete: canDelete.value, loading: loading.value }

    return actionOrder.value
      .map((name) => actionsMap.value.get(name))
      .filter((a): a is ActionConfig => a !== undefined)
      .filter((a) => !a.visible || a.visible(ctx))
      .map((a) => ({
        ...a,
        isLoading: a.loading ? a.loading() : false,
        isDisabled: a.disabled ? a.disabled(ctx) : false,
      }))
  })

  // ============ PAGE TITLE ============

  const titleParts = computed<PageTitleParts>(() => ({
    action: 'View',
    entityName: manager.label || entity,
    entityLabel: entityLabel.value || undefined,
  }))

  const title = computed(() => {
    const parts = titleParts.value
    if (parts.entityLabel) {
      return `${parts.entityLabel}`
    }
    return `${parts.action} ${parts.entityName}`
  })

  // ============ NAVIGATION ============

  function goToEdit(): void {
    if (!entityId.value) return
    const editRouteName = `${manager.routePrefix || entity}-edit`
    router.push({
      name: editRouteName,
      params: { [manager.idField]: entityId.value },
    })
  }

  function goBack(): void {
    // Try to go to list route
    const listRouteName = manager.routePrefix || entity
    router.push({ name: listRouteName })
  }

  async function deleteEntity(): Promise<void> {
    if (!entityId.value) return

    try {
      await manager.delete(entityId.value)
      orchestrator.toast?.success(`${manager.label || entity} deleted`)
      goBack()
    } catch (err) {
      console.error(`[useEntityItemShowPage] Failed to delete ${entity}:`, err)
      const axiosError = err as { response?: { data?: { detail?: string } }; message?: string }
      const errorMessage =
        axiosError.response?.data?.detail || axiosError.message || `Failed to delete ${manager.label || entity}`
      orchestrator.toast?.error(errorMessage)
    }
  }

  // ============ COMPONENT BINDING ============

  const props = computed<ShowPageProps>(() => ({
    loading: loading.value,
    title: title.value,
    titleParts: titleParts.value,
    fields: fields.value,
    data: data.value as Record<string, unknown> | null,
    actions: actions.value,
    fetchError: error.value,
  }))

  const events: ShowPageEvents = {
    edit: goToEdit,
    delete: deleteEntity,
    back: goBack,
  }

  // ============ RETURN ============

  const returnValue: UseEntityItemShowPageReturn = {
    // State from base
    data,
    loading,
    error,
    entityId,
    entityLabel,
    isLoaded,

    // Parent chain
    parentConfig: base.parentConfig,
    parentId: base.parentId,
    parentData: base.parentData,

    // Field management
    fields,
    generateFields,
    addField,
    updateField,
    removeField,
    excludeField,
    reorderFields,
    getField,

    // Action management
    actions,
    addAction,
    addEditAction,
    addDeleteAction,
    addBackAction,
    removeAction,

    // Permissions
    canEdit,
    canDelete,

    // Page title
    title,
    titleParts,

    // Component binding
    props,
    events,

    // Actions
    load: base.load,
    reload: base.reload,
    goToEdit,
    goBack,
    deleteEntity,

    // References
    manager,
    orchestrator,
    hydrator,
  }

  return returnValue
}
