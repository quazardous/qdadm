/**
 * useBareForm - Base form composable providing common form functionality
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
 */
import { ref, computed, provide, inject, onUnmounted, type Ref, type ComputedRef } from 'vue'
import { useRoute, useRouter, type Router, type RouteLocationNormalizedLoaded } from 'vue-router'
import { useDirtyState } from './useDirtyState'
import { useUnsavedChangesGuard, type GuardDialogState } from './useUnsavedChangesGuard'
import { useBreadcrumb, type BreadcrumbDisplayItem } from './useBreadcrumb'
import { registerGuardDialog, unregisterGuardDialog } from './useGuardStore'

/**
 * Entity manager interface (minimal for this composable)
 */
interface EntityManager {
  label?: string
  labelField?: string
  getEntityLabel: (data: unknown) => string
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
 * Toast helper interface
 */
interface ToastHelper {
  add: (options: {
    severity: 'success' | 'error' | 'warn' | 'info'
    summary: string
    detail?: string
    emitter?: unknown
  }) => void
}

/**
 * Page title parts for PageHeader
 */
interface PageTitleParts {
  action: string
  entityName: string | null
  entityLabel: string | null
}

/**
 * Options for useBareForm
 */
export interface UseBareFormOptions {
  /** Function returning current form state for comparison */
  getState: () => Record<string, unknown>
  /** Route name for cancel navigation (default: '') */
  routePrefix?: string
  /** Display name for entity (default: from manager or derived from routePrefix) */
  entityName?: string | null
  /** Field name or function to extract entity label (default: from manager or 'name') */
  labelField?: string | ((data: unknown) => string) | null
  /** EntityManager name (string) for auto metadata, OR entity data (Ref/Object) for breadcrumb */
  entity?: string | Ref<unknown> | Record<string, unknown> | null
  /** Enable unsaved changes guard (default: true) */
  guard?: boolean
  /** Callback for save button in guard modal */
  onGuardSave?: (() => Promise<void>) | null
  /** Custom function to extract entity ID from route (optional) */
  getId?: (() => string | number | null) | null
  /** Callback (entity) => string for custom breadcrumb label (optional) */
  breadcrumbLabel?: ((entity: unknown) => string) | null
}

/**
 * Return type for useBareForm
 */
export interface UseBareFormReturn {
  // Dependencies (for custom logic in form)
  router: Router
  route: RouteLocationNormalizedLoaded
  toast: ToastHelper

  // Manager (if resolved from entity string)
  manager: EntityManager | null

  // State
  loading: Ref<boolean>
  saving: Ref<boolean>
  dirty: Ref<boolean>
  dirtyFields: Ref<string[]>
  isEdit: ComputedRef<boolean>
  entityId: ComputedRef<string | number | null>

  // Dirty tracking
  isFieldDirty: (fieldPath: string) => boolean
  takeSnapshot: () => void
  checkDirty: () => void
  reset: () => void

  // Helpers
  cancel: () => void

  // Breadcrumb
  breadcrumb: ComputedRef<BreadcrumbDisplayItem[]>

  // Guard dialog (for UnsavedChangesDialog component)
  guardDialog: GuardDialogState | null

  // Title helpers
  pageTitleParts: ComputedRef<PageTitleParts>
}

/**
 * Base form composable providing common form functionality
 *
 * @param options - Configuration options
 * @returns Form utilities and state
 */
export function useBareForm(options: UseBareFormOptions): UseBareFormReturn {
  const {
    getState,
    routePrefix = '',
    entityName = null,
    labelField = null,
    guard = true,
    onGuardSave = null,
    getId = null,
    entity = null,
    breadcrumbLabel = null,
  } = options

  if (!getState || typeof getState !== 'function') {
    throw new Error('useBareForm requires a getState function')
  }

  // Try to get EntityManager metadata if entity is a string
  let manager: EntityManager | null = null
  if (typeof entity === 'string') {
    const orchestrator = inject<Orchestrator | null>('qdadmOrchestrator', null)
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
  const orchestrator = inject<Orchestrator | null>('qdadmOrchestrator', null)

  // Toast helper - wraps orchestrator.toast for legacy compatibility
  const toast: ToastHelper = {
    add({ severity, summary, detail, emitter }) {
      orchestrator?.toast[severity]?.(summary, detail, emitter)
    },
  }

  // Common state
  const loading = ref(false)
  const saving = ref(false)

  // Common computed
  const entityId = computed(() => {
    if (getId) return getId()
    return (route.params.id as string | number) || (route.params.key as string | number) || null
  })

  const isEdit = computed(() => !!entityId.value)

  // Dirty state tracking
  const { dirty, dirtyFields, isFieldDirty, takeSnapshot, checkDirty, reset } =
    useDirtyState(getState)

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
  const getEntityLabel = (): string | null => {
    const state = getState()
    const formData = (state.form as Record<string, unknown>) || state
    if (!formData) return null
    // Use manager.getEntityLabel if available, otherwise use effectiveLabelField
    if (manager) {
      return manager.getEntityLabel(formData)
    }
    if (typeof effectiveLabelField === 'function') {
      return effectiveLabelField(formData)
    }
    return (formData[effectiveLabelField as string] as string) || null
  }

  const pageTitleParts = computed<PageTitleParts>(() => ({
    action: isEdit.value ? 'Edit' : 'Create',
    entityName: effectiveEntityName,
    entityLabel: isEdit.value ? getEntityLabel() : null,
  }))

  // Provide title parts for automatic PageHeader consumption
  if (effectiveEntityName) {
    provide('qdadmPageTitleParts', pageTitleParts)
  }

  // Breadcrumb (auto-generated from route path, with optional entity for dynamic labels)
  // Only pass entity to breadcrumb if it's actual entity data (not a string manager name)
  const breadcrumbEntity = typeof entity === 'string' ? null : entity
  const { breadcrumbItems } = useBreadcrumb({
    entity: breadcrumbEntity as unknown | Ref<unknown> | undefined,
    getEntityLabel: breadcrumbLabel || undefined,
  })

  // Unsaved changes guard
  let guardDialog: GuardDialogState | null = null
  if (guard) {
    const guardOptions = onGuardSave ? { onSave: onGuardSave } : {}
    const guardResult = useUnsavedChangesGuard(dirty, guardOptions)
    guardDialog = guardResult.guardDialog
    // Register guardDialog in shared store so AppLayout can render it
    registerGuardDialog(guardDialog)
    onUnmounted(() => unregisterGuardDialog(guardDialog!))
  }

  // Navigation helper
  function cancel(): void {
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
    pageTitleParts,
  }
}
