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
import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { useRouter, type Router } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import {
  useEntityItemPage,
  type ParentConfig,
  type EntityManager,
} from './useEntityItemPage'
import type { StackHydratorReturn } from '../chain/useStackHydrator'
import {
  useFieldManager,
  type FieldGroup,
  type GroupDefinition,
  type GroupOptions,
  type AddFieldOptions,
} from './useFieldManager'
import {
  createShowFieldResolver,
  type ShowFieldDefinition,
  type ShowResolvedFieldConfig,
} from './createShowFieldResolver'
import type { OrchestratorLike } from '../entity/EntityManager.interface'
import { useActionRegistry } from './useActionRegistry'

// #1191 — shared structural view (manager tier from useEntityItemPage)
type Orchestrator = OrchestratorLike<EntityManager>

/**
 * Field definition from EntityManager schema.
 * Re-exported from the shared resolver under the historical name.
 */
export type FieldDefinition = ShowFieldDefinition

/**
 * Resolved field configuration for display rendering.
 * Re-exported from the shared resolver under the historical name.
 */
export type ResolvedFieldConfig = ShowResolvedFieldConfig

// FieldGroup, GroupDefinition, GroupOptions imported from useFieldManager

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
 * Lazy action configuration
 *
 * Unlike regular actions whose visibility is derived from entity data on the model,
 * lazy actions resolve asynchronously after entity load (e.g., fetching security info
 * from a separate endpoint). Hidden by default until resolve() returns visible: true.
 */
export interface LazyActionConfig {
  name: string
  label: string
  icon?: string
  severity?: string
  onClick: () => void | Promise<void>
  resolve: (data: unknown) => Promise<{ visible?: boolean; disabled?: boolean }>
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
  badges: Array<{ label: string; severity?: string }>
  fields: ResolvedFieldConfig[]
  groups: FieldGroup<ResolvedFieldConfig>[]
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
 * Options for useEntityItemShowPage
 */
export interface UseEntityItemShowPageOptions<T = unknown> {
  /** Entity name */
  entity: string
  /** Auto-load entity on mount (default: true) */
  loadOnMount?: boolean
  /** Transform hook for loaded data */
  transformLoad?: (data: unknown) => T
  /** Callback on successful load */
  onLoadSuccess?: ((data: T) => Promise<void> | void) | null
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

// AddFieldOptions imported from useFieldManager

/**
 * Return type for useEntityItemShowPage
 */
export interface UseEntityItemShowPageReturn<T = unknown> {
  // State from base
  data: Ref<T | null>
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
  generateFields: (options?: GenerateFieldsOptions) => UseEntityItemShowPageReturn<T>
  addField: (name: string, fieldConfig: Partial<FieldDefinition>, options?: AddFieldOptions) => UseEntityItemShowPageReturn<T>
  updateField: (name: string, updates: Partial<FieldDefinition>) => UseEntityItemShowPageReturn<T>
  removeField: (name: string) => UseEntityItemShowPageReturn<T>
  excludeField: (name: string) => UseEntityItemShowPageReturn<T>
  reorderFields: (fieldNames: string[]) => UseEntityItemShowPageReturn<T>
  getField: (name: string) => ResolvedFieldConfig | undefined

  // Group management
  groups: ComputedRef<FieldGroup<ResolvedFieldConfig>[]>
  group: (name: string, fieldsOrOptions?: string[] | GroupOptions, options?: GroupOptions) => UseEntityItemShowPageReturn<T>
  defineGroups: (definitions: Record<string, GroupDefinition>) => UseEntityItemShowPageReturn<T>
  getGroup: (name: string) => FieldGroup<ResolvedFieldConfig> | undefined

  // Action management
  actions: ComputedRef<ResolvedAction[]>
  addAction: (action: ActionConfig) => UseEntityItemShowPageReturn<T>
  addLazyAction: (action: LazyActionConfig) => UseEntityItemShowPageReturn<T>
  addEditAction: (options?: { label?: string; icon?: string }) => UseEntityItemShowPageReturn<T>
  addDeleteAction: (options?: { label?: string; icon?: string; confirm?: boolean }) => UseEntityItemShowPageReturn<T>
  addBackAction: (options?: { label?: string; icon?: string; route?: string }) => UseEntityItemShowPageReturn<T>
  removeAction: (name: string) => UseEntityItemShowPageReturn<T>

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
  load: (id?: string | number | null) => Promise<T | null>
  reload: () => Promise<T | null>
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

export function useEntityItemShowPage<T = unknown>(
  options: UseEntityItemShowPageOptions<T>
): UseEntityItemShowPageReturn<T> {
  const { entity, loadOnMount = true, transformLoad, onLoadSuccess, onLoadError } = options

  const router: Router = useRouter()
  const confirm = useConfirm() as ConfirmService

  // Lazy action state (declared before base so onLoadSuccess wrapper can reference it)
  const lazyActionsMap = ref<Map<string, LazyActionConfig>>(new Map())
  const lazyResolvedStates = ref<Map<string, { visible: boolean; disabled: boolean }>>(new Map())

  /**
   * Run all lazy action resolvers with the loaded entity data.
   * Errors in individual resolvers are caught — action stays hidden.
   */
  async function runLazyResolvers(entityData: unknown): Promise<void> {
    const newStates = new Map<string, { visible: boolean; disabled: boolean }>()
    const entries = Array.from(lazyActionsMap.value.entries())
    await Promise.all(
      entries.map(async ([name, action]) => {
        try {
          const result = await action.resolve(entityData)
          newStates.set(name, {
            visible: result.visible ?? false,
            disabled: result.disabled ?? false,
          })
        } catch (err) {
          console.warn(`[useEntityItemShowPage] Lazy action "${name}" resolve failed:`, err)
          newStates.set(name, { visible: false, disabled: false })
        }
      })
    )
    lazyResolvedStates.value = newStates
  }

  // Use base composable — wrap onLoadSuccess to run lazy resolvers after entity load
  const base = useEntityItemPage<T>({
    entity,
    loadOnMount,
    transformLoad,
    onLoadSuccess: async (entityData) => {
      await runLazyResolvers(entityData)
      if (onLoadSuccess) await onLoadSuccess(entityData)
    },
    onLoadError,
  })

  const { manager, orchestrator: baseOrchestrator, data, loading, error, entityId, entityLabel, isLoaded, hydrator } = base
  // Cast orchestrator to include toast methods
  const orchestrator = baseOrchestrator as Orchestrator

  // ============ FIELD & GROUP MANAGEMENT (via useFieldManager) ============

  // Show-specific field resolver (shared with <ParentCard>, see #1038)
  const resolveFieldConfig = createShowFieldResolver(manager, orchestrator)

  // Create field manager with show-specific resolver
  const fieldManager = useFieldManager<ResolvedFieldConfig>({
    resolveFieldConfig,
    getSchemaFieldConfig: (name) => manager.getFieldConfig?.(name) || null,
    entity,
  })

  // Direct access to computed values
  const { fields, groups } = fieldManager

  // Chainable method wrappers (return returnValue for fluent API)
  const chain = <A extends unknown[], R>(fn: (...args: A) => R) =>
    (...args: A): UseEntityItemShowPageReturn<T> => { fn(...args); return returnValue }

  const generateFields = (opts?: GenerateFieldsOptions): UseEntityItemShowPageReturn<T> => {
    const formFields = manager.getFormFields?.() || []
    fieldManager.generateFields(formFields, opts)
    return returnValue
  }

  const addField = chain(fieldManager.addField)
  const updateField = chain(fieldManager.updateField)
  const removeField = chain(fieldManager.removeField)
  const excludeField = chain(fieldManager.excludeField)
  const reorderFields = chain(fieldManager.setFieldOrder)
  const group = chain(fieldManager.group)
  const defineGroups = chain(fieldManager.defineGroups)

  // Direct accessors (no chaining needed)
  const getField = fieldManager.getField
  const getGroup = fieldManager.getGroup

  // ============ ACTION MANAGEMENT ============

  const canEdit = computed(() => manager.canUpdate?.(data.value) ?? true)
  const canDelete = computed(() => manager.canDelete?.(data.value) ?? true)

  // #1193 — shared registry skeleton; the order list is shared with lazy
  // actions so declaration order survives the regular/lazy interleave.
  type ShowActionCtx = { canEdit: boolean; canDelete: boolean; loading: boolean }
  const actionRegistry = useActionRegistry<ActionConfig, ShowActionCtx, ResolvedAction>({
    resolve: (action, ctx) => {
      if (action.visible && !action.visible(ctx)) return null
      return {
        ...action,
        isLoading: action.loading ? action.loading() : false,
        isDisabled: action.disabled ? action.disabled(ctx) : false,
      }
    },
  })
  const actionsMap = actionRegistry.actionsMap
  const actionOrder = actionRegistry.order

  function addAction(action: ActionConfig): UseEntityItemShowPageReturn<T> {
    actionRegistry.add(action)
    return returnValue
  }

  function addLazyAction(action: LazyActionConfig): UseEntityItemShowPageReturn<T> {
    lazyActionsMap.value.set(action.name, action)
    if (!actionOrder.value.includes(action.name)) {
      actionOrder.value.push(action.name)
    }
    return returnValue
  }

  function addEditAction(editOptions: { label?: string; icon?: string } = {}): UseEntityItemShowPageReturn<T> {
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
  ): UseEntityItemShowPageReturn<T> {
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

  function addBackAction(backOptions: { label?: string; icon?: string; route?: string } = {}): UseEntityItemShowPageReturn<T> {
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

  function removeAction(name: string): UseEntityItemShowPageReturn<T> {
    actionsMap.value.delete(name)
    lazyActionsMap.value.delete(name)
    lazyResolvedStates.value.delete(name)
    const index = actionOrder.value.indexOf(name)
    if (index !== -1) {
      actionOrder.value.splice(index, 1)
    }
    return returnValue
  }

  const actions = computed<ResolvedAction[]>(() => {
    const ctx = { canEdit: canEdit.value, canDelete: canDelete.value, loading: loading.value }
    const resolved = lazyResolvedStates.value // force dependency tracking

    return actionOrder.value
      .map((name) => {
        const regular = actionsMap.value.get(name)
        if (regular) return { type: 'regular' as const, action: regular }
        const lazy = lazyActionsMap.value.get(name)
        if (lazy) return { type: 'lazy' as const, action: lazy }
        return null
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .map((entry) => {
        if (entry.type === 'regular') {
          return actionRegistry.resolveOne(entry.action.name, ctx)
        }
        const state = resolved.get(entry.action.name)
        if (state?.visible !== true) return null
        const a = entry.action
        return { ...a, isLoading: a.loading ? a.loading() : false, isDisabled: state?.disabled ?? false }
      })
      .filter((a): a is ResolvedAction => a !== null)
  })

  // ============ PAGE TITLE ============

  const titleParts = computed<PageTitleParts>(() => ({
    action: 'View',
    entityName: manager.label || entity,
    entityLabel: entityLabel.value || undefined,
  }))

  const entityBadges = computed(() => {
    if (!manager.getEntityBadges) return []
    return manager.getEntityBadges(data.value as any)
  })

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
    badges: entityBadges.value,
    fields: fields.value,
    groups: groups.value,
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

  const returnValue: UseEntityItemShowPageReturn<T> = {
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

    // Group management
    groups,
    group,
    defineGroups,
    getGroup,

    // Action management
    actions,
    addAction,
    addLazyAction,
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
