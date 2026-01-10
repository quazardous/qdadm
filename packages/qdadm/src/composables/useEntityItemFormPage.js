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
 * ```js
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
 *
 * ## Auto-generated Fields
 *
 * ```js
 * const form = useEntityItemFormPage({ entity: 'books' })
 * form.generateFields()  // Auto-generate from manager.fields
 * form.excludeField('internal_id')  // Exclude specific fields
 * form.addField('custom', { type: 'text', label: 'Custom' })  // Manual override
 *
 * // Access generated fields
 * form.fields  // Computed array of field configs
 * form.getFieldConfig('title')  // Get specific field config
 * ```
 *
 * ## Validation
 *
 * ```js
 * const form = useEntityItemFormPage({ entity: 'books' })
 * form.generateFields()
 *
 * // Add custom validator
 * form.addField('email', { validate: (v) => v.includes('@') || 'Invalid email' })
 *
 * // Validate manually
 * if (form.validate()) {
 *   await form.submit()
 * }
 *
 * // Errors are available
 * form.errors.value  // { email: 'Invalid email' }
 * form.getFieldError('email')  // 'Invalid email'
 * form.hasErrors.value  // true
 * ```
 *
 * ## Field Type Mapping
 *
 * Schema types are mapped to input component types:
 * - text, string, email, password -> text input
 * - number, integer, float -> number input
 * - boolean, checkbox -> checkbox/toggle
 * - select, dropdown -> select/dropdown
 * - date, datetime -> date picker
 * - textarea -> textarea
 *
 * ## Features
 *
 * - Mode detection: `/books/new` = create, `/books/:id/edit` = edit
 * - Auto-load on edit mode via EntityManager.get()
 * - Auto-generate fields from EntityManager.fields schema
 * - Dirty state tracking (from useDirtyState)
 * - Validation with required, type-based, and custom validators
 * - Unsaved changes guard modal
 * - Permission-aware save/delete actions via EntityManager.canUpdate/canDelete
 */
import { ref, computed, watch, onMounted, onUnmounted, provide } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { useDirtyState } from './useDirtyState'
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard'
import { useBreadcrumb } from './useBreadcrumb'
import { useEntityItemPage } from './useEntityItemPage'
import { registerGuardDialog, unregisterGuardDialog } from './useGuardStore'
import { deepClone } from '../utils/transformers'
import { getSiblingRoutes } from '../module/moduleRegistry'

export function useEntityItemFormPage(config = {}) {
  const {
    entity,
    // Mode detection
    getId = null,  // Custom function to extract ID from route
    createRouteSuffix = 'create',  // Route name suffix for create mode
    editRouteSuffix = 'edit',      // Route name suffix for edit mode
    // Form options
    loadOnMount = true,
    enableGuard = true,
    // redirectOnCreate removed: "Create" now resets form, "Create & Close" navigates
    usePatch = false,         // Use PATCH instead of PUT for updates
    // Hooks for custom behavior
    transformLoad = (data) => data,
    transformSave = (data) => data,
    onLoadSuccess = null,
    onSaveSuccess = null,
    onDeleteSuccess = null,
    // Validation options
    validateOnBlur = true,         // Validate field on blur
    validateOnSubmit = true,       // Validate all fields before submit
    showErrorSummary = false,      // Show error summary at top of form
    // Field generation
    generateFormFields = true      // Auto-generate fields from manager schema
  } = config

  const router = useRouter()
  const route = useRoute()
  const toast = useToast()
  const confirm = useConfirm()

  // Use useEntityItemPage for common infrastructure
  // (orchestrator, manager, entityId, provide('mainEntity'), breadcrumb)
  const itemPage = useEntityItemPage({
    entity,
    loadOnMount: false,  // Form controls its own loading
    breadcrumb: false,   // Form calls setBreadcrumbEntity manually after transform
    getId
  })

  const { manager, orchestrator, entityId, setBreadcrumbEntity, getInitialDataWithParent, parentConfig, parentId, parentData, parentChain, getChainDepth } = itemPage

  // Read config from manager with option overrides
  const entityName = config.entityName ?? manager.label
  const routePrefix = config.routePrefix ?? manager.routePrefix

  // Initial data: merge user-provided with auto-populated parent foreignKey
  // getInitialDataWithParent() adds the foreignKey from route.meta.parent
  const baseInitialData = getInitialDataWithParent()
  const initialData = config.initialData
    ? { ...baseInitialData, ...config.initialData }
    : baseInitialData

  /**
   * Detect form mode: 'create' or 'edit'
   * Based on route name or presence of ID
   */
  const mode = computed(() => {
    const routeName = route.name || ''
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

  const data = ref(deepClone(initialData))
  const originalData = ref(null)
  const loading = ref(false)
  const saving = ref(false)

  // Dirty state getter
  const dirtyStateGetter = config.getDirtyState || (() => ({ form: data.value }))

  // Dirty state tracking
  const {
    dirty,
    dirtyFields,
    isFieldDirty,
    takeSnapshot,
    checkDirty
  } = useDirtyState(dirtyStateGetter)

  // Provide isFieldDirty and dirtyFields for child components (FormField)
  provide('isFieldDirty', isFieldDirty)
  provide('dirtyFields', dirtyFields)

  // Watch for changes to update dirty state
  watch(data, checkDirty, { deep: true })

  // ============ VALIDATION STATE ============

  /**
   * Map of field errors: { fieldName: 'Error message' }
   */
  const errors = ref({})

  /**
   * Whether the form has been submitted at least once (for showing all errors)
   */
  const submitted = ref(false)

  /**
   * Computed: whether form has any errors
   */
  const hasErrors = computed(() => Object.keys(errors.value).length > 0)

  /**
   * Computed: list of error messages for summary display
   */
  const errorSummary = computed(() => {
    return Object.entries(errors.value).map(([field, message]) => {
      const fieldConfig = fieldsMap.value.get(field)
      const label = fieldConfig?.label || snakeCaseToTitle(field)
      return { field, label, message }
    })
  })

  // Provide validation state for child components (FormField)
  provide('getFieldError', (name) => errors.value[name] || null)
  provide('formSubmitted', submitted)

  // ============ UNSAVED CHANGES GUARD ============

  let guardDialog = null
  if (enableGuard) {
    const { guardDialog: gd } = useUnsavedChangesGuard(dirty, {
      onSave: () => submit(false)
    })
    guardDialog = gd
    registerGuardDialog(guardDialog)
    onUnmounted(() => unregisterGuardDialog(guardDialog))
  }

  // ============ BREADCRUMB ============

  const { breadcrumbItems } = useBreadcrumb({ entity: data })

  // ============ LOADING ============

  async function load() {
    if (!isEdit.value) {
      data.value = deepClone(initialData)
      takeSnapshot()
      return
    }

    loading.value = true
    try {
      const responseData = await manager.get(entityId.value)
      const transformed = transformLoad(responseData)
      data.value = transformed
      originalData.value = deepClone(transformed)
      takeSnapshot()

      // Share with navigation context for breadcrumb
      setBreadcrumbEntity(transformed)

      if (onLoadSuccess) {
        await onLoadSuccess(transformed)
      }
    } catch (error) {
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

  // ============ SUBMIT ============

  async function submit(andClose = true) {
    // Mark as submitted (shows all errors in UI)
    submitted.value = true

    // Validate before submit if enabled
    if (validateOnSubmit && !validate()) {
      toast.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please fix the errors before saving',
        life: 3000
      })
      return null
    }

    saving.value = true
    try {
      const payload = transformSave(deepClone(data.value))

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

      // Update data and snapshot
      const savedData = transformLoad(responseData)
      data.value = savedData
      originalData.value = deepClone(savedData)
      takeSnapshot()

      if (onSaveSuccess) {
        await onSaveSuccess(responseData, andClose)
      }

      if (andClose) {
        // Navigate to list route (or previous page)
        const listRoute = findListRoute()
        router.push(listRoute)
      } else if (!isEdit.value) {
        // "Create" without close: reset form for new entry, stay on route
        data.value = deepClone(initialData)
        originalData.value = null
        takeSnapshot()
        errors.value = {}
        submitted.value = false
        toast.add({
          severity: 'info',
          summary: 'Ready',
          detail: 'Form reset for new entry',
          life: 2000
        })
      }
      // Edit mode without close: just stay on page (data already updated)

      return responseData
    } catch (error) {
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

  // ============ DELETE ============

  async function remove() {
    if (!isEdit.value) return

    try {
      await manager.delete(entityId.value)
      toast.add({
        severity: 'success',
        summary: 'Deleted',
        detail: `${entityName} deleted successfully`,
        life: 3000
      })

      if (onDeleteSuccess) {
        await onDeleteSuccess()
      }

      router.push({ name: routePrefix })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error.response?.data?.detail || `Failed to delete ${entityName}`,
        life: 5000
      })
    }
  }

  function confirmDelete() {
    const label = manager.getEntityLabel(data.value) || entityId.value
    confirm.require({
      message: `Delete ${entityName} "${label}"?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptClass: 'p-button-danger',
      accept: remove
    })
  }

  // ============ RESET ============

  function reset() {
    if (originalData.value) {
      data.value = deepClone(originalData.value)
    } else {
      data.value = deepClone(initialData)
    }
    takeSnapshot()
    // Clear validation state on reset
    errors.value = {}
    submitted.value = false
  }

  // ============ NAVIGATION ============

  /**
   * Find the list route for redirects after save/cancel
   * For child entities: finds sibling list route with parent params
   * For top-level entities: uses routePrefix
   *
   * When parent has multiple child entity types (e.g., bots → commands AND bots → logs),
   * we find the list route matching the current entity's route prefix.
   */
  function findListRoute() {
    // If has parent config, find sibling list route
    if (parentConfig.value) {
      const { entity: parentEntityName, param } = parentConfig.value
      const siblings = getSiblingRoutes(parentEntityName, param)

      // Extract base route name from current route (e.g., 'bot-commands-create' → 'bot-commands')
      const currentRouteName = route.name || ''
      const baseRouteName = currentRouteName.replace(/-(create|edit|new)$/, '')

      // Find list routes among siblings (exclude create/edit/new routes)
      const listRoutes = siblings.filter(r => {
        const name = r.name || ''
        const path = r.path || ''
        return !name.match(/-(create|edit|new)$/) && !path.match(/\/(create|edit|new)$/)
      })

      // Prefer route matching current entity's base name
      let listRoute = listRoutes.find(r => r.name === baseRouteName)

      // Fallback: try route containing routePrefix (e.g., 'bot-commands' contains 'command')
      if (!listRoute && routePrefix) {
        listRoute = listRoutes.find(r => r.name?.includes(routePrefix))
      }

      // Last fallback: first list route
      if (!listRoute && listRoutes.length > 0) {
        listRoute = listRoutes[0]
      }

      if (listRoute?.name) {
        return { name: listRoute.name, params: route.params }
      }
    }

    // Default: top-level entity list
    return { name: routePrefix }
  }

  function cancel() {
    router.push(findListRoute())
  }

  function goToList() {
    router.push(findListRoute())
  }

  // ============ FIELDS ============

  /**
   * Map of field configurations
   * Key: field name, Value: resolved field config
   */
  const fieldsMap = ref(new Map())

  /**
   * Ordered list of field names for rendering
   */
  const fieldOrder = ref([])

  /**
   * Set of excluded field names
   */
  const excludedFields = ref(new Set())

  /**
   * Type mapping from schema types to input component types
   * Maps EntityManager field types to form input types
   */
  const TYPE_MAPPINGS = {
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
    object: 'object'
  }

  /**
   * Generate form fields from EntityManager.fields schema
   *
   * Reads the manager's fields definition and creates form field configs.
   * Fields marked with editable: false are skipped.
   * Respects excludeField() calls made before generateFields().
   *
   * @param {object} options - Generation options
   * @param {string[]} [options.only] - Only include these fields
   * @param {string[]} [options.exclude] - Exclude these fields (merged with excludeField calls)
   * @returns {object} - The builder instance for chaining
   */
  function generateFields(options = {}) {
    const { only = null, exclude = [] } = options

    // Merge exclude option with excludedFields set
    const allExcluded = new Set([...excludedFields.value, ...exclude])

    // Get form-editable fields from manager
    const formFields = manager.getFormFields()

    for (const fieldDef of formFields) {
      const { name, ...fieldConfig } = fieldDef

      // Skip if not in 'only' list (when specified)
      if (only && !only.includes(name)) continue

      // Skip excluded fields
      if (allExcluded.has(name)) continue

      // Skip if already added manually (manual overrides take precedence)
      if (fieldsMap.value.has(name)) continue

      // Build resolved field config
      const resolvedConfig = resolveFieldConfig(name, fieldConfig)
      fieldsMap.value.set(name, resolvedConfig)
      fieldOrder.value.push(name)
    }

    // Auto-resolve reference options (async, non-blocking)
    resolveReferences()

    return builderApi
  }

  /**
   * Resolve reference options for all fields with reference config
   *
   * Called automatically by generateFields(). Loads options from
   * referenced entities and updates field configs reactively.
   *
   * @returns {Promise<void>}
   */
  async function resolveReferences() {
    for (const [name, config] of fieldsMap.value.entries()) {
      // Skip if field has static options or no reference
      if (config.options || !config.reference) continue

      try {
        const options = await manager.resolveReferenceOptions(name)
        // Update field config reactively
        const updatedConfig = { ...config, options }
        fieldsMap.value.set(name, updatedConfig)
      } catch (error) {
        console.warn(`[useEntityItemFormPage] Failed to resolve options for field '${name}':`, error)
      }
    }
  }

  /**
   * Resolve field configuration from schema definition
   *
   * @param {string} name - Field name
   * @param {object} fieldConfig - Raw field config from schema
   * @returns {object} - Resolved field configuration
   */
  function resolveFieldConfig(name, fieldConfig) {
    const {
      type = 'text',
      label = null,
      required = false,
      default: defaultValue,
      options = null,
      optionLabel = 'label',
      optionValue = 'value',
      placeholder = null,
      disabled = false,
      readonly = false,
      ...rest
    } = fieldConfig

    // Map schema type to input type
    const inputType = TYPE_MAPPINGS[type] || 'text'

    // Generate label from field name if not provided (snake_case to Title Case)
    const resolvedLabel = label || snakeCaseToTitle(name)

    return {
      name,
      type: inputType,
      schemaType: type,  // Preserve original schema type
      label: resolvedLabel,
      required,
      default: defaultValue,
      options,
      optionLabel,
      optionValue,
      placeholder,
      disabled,
      readonly,
      ...rest
    }
  }

  /**
   * Add or override a single field configuration
   *
   * @param {string} name - Field name
   * @param {object} fieldConfig - Field configuration
   * @param {object} [options] - Options
   * @param {string} [options.after] - Insert after this field
   * @param {string} [options.before] - Insert before this field
   * @returns {object} - The builder instance for chaining
   */
  function addField(name, fieldConfig, options = {}) {
    const { after = null, before = null } = options

    // Merge with existing schema config if available
    const schemaConfig = manager.getFieldConfig(name) || {}
    const resolvedConfig = resolveFieldConfig(name, { ...schemaConfig, ...fieldConfig })

    fieldsMap.value.set(name, resolvedConfig)

    // Handle ordering
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
      // New field, add at end
      fieldOrder.value.push(name)
    } else {
      // Existing field without repositioning, restore at original position
      fieldOrder.value.splice(currentIndex, 0, name)
    }

    return builderApi
  }

  /**
   * Update an existing field configuration
   *
   * Use this to modify properties of auto-generated fields.
   * Throws error if field doesn't exist (use addField for new fields).
   *
   * @param {string} name - Field name to update
   * @param {object} fieldConfig - Properties to merge with existing config
   * @returns {object} - The builder instance for chaining
   *
   * @example
   * form.updateField('book_id', { disabled: true })
   * form.updateField('email', { validate: v => v.includes('@') || 'Invalid' })
   */
  function updateField(name, fieldConfig) {
    if (!fieldsMap.value.has(name)) {
      throw new Error(`Field '${name}' does not exist. Use addField() to create new fields.`)
    }

    // Merge with existing config (keeps position)
    const existingConfig = fieldsMap.value.get(name)
    const mergedConfig = { ...existingConfig, ...fieldConfig }
    fieldsMap.value.set(name, mergedConfig)

    return builderApi
  }

  /**
   * Exclude a field from generation
   * Call before generateFields() or use exclude option
   *
   * @param {string} name - Field name to exclude
   * @returns {object} - The builder instance for chaining
   */
  function excludeField(name) {
    excludedFields.value.add(name)
    // Also remove from existing fields if already generated
    fieldsMap.value.delete(name)
    const idx = fieldOrder.value.indexOf(name)
    if (idx !== -1) {
      fieldOrder.value.splice(idx, 1)
    }
    return builderApi
  }

  /**
   * Remove a field from the form
   *
   * @param {string} name - Field name to remove
   * @returns {object} - The builder instance for chaining
   */
  function removeField(name) {
    fieldsMap.value.delete(name)
    const idx = fieldOrder.value.indexOf(name)
    if (idx !== -1) {
      fieldOrder.value.splice(idx, 1)
    }
    return builderApi
  }

  /**
   * Reorder fields
   *
   * @param {string[]} order - Array of field names in desired order
   * @returns {object} - The builder instance for chaining
   */
  function setFieldOrder(order) {
    // Only include fields that exist in fieldsMap
    fieldOrder.value = order.filter(name => fieldsMap.value.has(name))
    return builderApi
  }

  /**
   * Move a field to a specific position
   *
   * @param {string} name - Field name
   * @param {object} position - Position options
   * @param {string} [position.after] - Move after this field
   * @param {string} [position.before] - Move before this field
   * @returns {object} - The builder instance for chaining
   */
  function moveField(name, position) {
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

  /**
   * Get field configuration
   *
   * @param {string} name - Field name
   * @returns {object|undefined} - Field configuration
   */
  function getFieldConfig(name) {
    return fieldsMap.value.get(name)
  }

  /**
   * Get all fields in order
   *
   * @returns {Array<object>} - Array of field configurations
   */
  function getFields() {
    return fieldOrder.value.map(name => fieldsMap.value.get(name)).filter(Boolean)
  }

  /**
   * Computed property for ordered fields
   */
  const fields = computed(() => getFields())

  /**
   * Helper: Convert snake_case to Title Case
   */
  function snakeCaseToTitle(str) {
    if (!str) return ''
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // ============ VALIDATION ============

  /**
   * Built-in validators by type
   * Each validator returns true if valid, or error message string if invalid
   */
  const TYPE_VALIDATORS = {
    email: (value) => {
      if (!value) return true  // Empty handled by required
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(value) || 'Invalid email address'
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
        new URL(value)
        return true
      } catch {
        return 'Invalid URL'
      }
    }
  }

  /**
   * Check if a value is "empty" for required validation
   * @param {any} value
   * @returns {boolean}
   */
  function isEmpty(value) {
    if (value === null || value === undefined) return true
    if (typeof value === 'string') return value.trim() === ''
    if (Array.isArray(value)) return value.length === 0
    return false
  }

  /**
   * Validate a single field
   *
   * @param {string} name - Field name
   * @returns {string|null} - Error message or null if valid
   */
  function validateField(name) {
    const fieldConfig = fieldsMap.value.get(name)
    if (!fieldConfig) return null

    const value = data.value[name]

    // Required validation
    if (fieldConfig.required && isEmpty(value)) {
      const error = `${fieldConfig.label} is required`
      errors.value = { ...errors.value, [name]: error }
      return error
    }

    // Type-based validation
    const typeValidator = TYPE_VALIDATORS[fieldConfig.schemaType]
    if (typeValidator) {
      const result = typeValidator(value)
      if (result !== true) {
        errors.value = { ...errors.value, [name]: result }
        return result
      }
    }

    // Custom validator
    if (fieldConfig.validate && typeof fieldConfig.validate === 'function') {
      const result = fieldConfig.validate(value, data.value)
      if (result !== true && result !== undefined && result !== null) {
        const error = typeof result === 'string' ? result : `${fieldConfig.label} is invalid`
        errors.value = { ...errors.value, [name]: error }
        return error
      }
    }

    // Clear error if valid
    if (errors.value[name]) {
      const { [name]: _, ...rest } = errors.value
      errors.value = rest
    }

    return null
  }

  /**
   * Validate all fields in the form
   *
   * @returns {boolean} - true if form is valid, false otherwise
   */
  function validate() {
    const newErrors = {}

    for (const fieldName of fieldOrder.value) {
      const fieldConfig = fieldsMap.value.get(fieldName)
      if (!fieldConfig) continue

      const value = data.value[fieldName]

      // Required validation
      if (fieldConfig.required && isEmpty(value)) {
        newErrors[fieldName] = `${fieldConfig.label} is required`
        continue
      }

      // Type-based validation
      const typeValidator = TYPE_VALIDATORS[fieldConfig.schemaType]
      if (typeValidator) {
        const result = typeValidator(value)
        if (result !== true) {
          newErrors[fieldName] = result
          continue
        }
      }

      // Custom validator
      if (fieldConfig.validate && typeof fieldConfig.validate === 'function') {
        const result = fieldConfig.validate(value, data.value)
        if (result !== true && result !== undefined && result !== null) {
          newErrors[fieldName] = typeof result === 'string' ? result : `${fieldConfig.label} is invalid`
        }
      }
    }

    errors.value = newErrors
    return Object.keys(newErrors).length === 0
  }

  /**
   * Clear all validation errors
   */
  function clearErrors() {
    errors.value = {}
    submitted.value = false
  }

  /**
   * Clear error for a specific field
   * @param {string} name - Field name
   */
  function clearFieldError(name) {
    if (errors.value[name]) {
      const { [name]: _, ...rest } = errors.value
      errors.value = rest
    }
  }

  /**
   * Get error for a specific field
   * @param {string} name - Field name
   * @returns {string|null}
   */
  function getFieldError(name) {
    return errors.value[name] || null
  }

  /**
   * Handle field blur event (for validateOnBlur)
   * @param {string} name - Field name
   */
  function handleFieldBlur(name) {
    if (validateOnBlur) {
      validateField(name)
    }
  }

  // Provide handleFieldBlur for child components
  provide('handleFieldBlur', handleFieldBlur)

  // ============ PERMISSION STATE ============

  /**
   * Whether the current user can save the form
   * In create mode: checks canCreate()
   * In edit mode: checks canUpdate() for the current record
   */
  const canSave = computed(() => {
    return isEdit.value
      ? manager.canUpdate(data.value)
      : manager.canCreate()
  })

  /**
   * Whether the current user can delete the current record
   * Always false in create mode (nothing to delete)
   */
  const canDeleteRecord = computed(() => {
    return isEdit.value && manager.canDelete(data.value)
  })

  // ============ ACTIONS ============

  const actionsMap = ref(new Map())

  function addAction(name, actionConfig) {
    actionsMap.value.set(name, { name, ...actionConfig })
  }

  function removeAction(name) {
    actionsMap.value.delete(name)
  }

  /**
   * Get actions with resolved state
   */
  function getActions() {
    const actions = []
    for (const [, action] of actionsMap.value) {
      if (action.visible && !action.visible({ isEdit: isEdit.value, dirty: dirty.value })) continue
      actions.push({
        ...action,
        isLoading: action.loading ? action.loading() : false,
        isDisabled: action.disabled ? action.disabled({ dirty: dirty.value, saving: saving.value }) : false
      })
    }
    return actions
  }

  const actions = computed(() => getActions())

  /**
   * Add standard "Save" action
   * Respects manager.canCreate/canUpdate for visibility
   */
  function addSaveAction(options = {}) {
    const { label, andClose = true } = options
    const actionLabel = label || (andClose ? 'Save & Close' : 'Save')

    addAction('save', {
      label: actionLabel,
      icon: andClose ? 'pi pi-check-circle' : 'pi pi-check',
      severity: andClose ? 'success' : 'primary',
      onClick: () => submit(andClose),
      visible: () => isEdit.value ? manager.canUpdate() : manager.canCreate(),
      disabled: ({ dirty, saving }) => !dirty || saving,
      loading: () => saving.value
    })
  }

  /**
   * Add standard "Delete" action
   * Only visible in edit mode, respects manager.canDelete
   */
  function addDeleteAction(options = {}) {
    const { label = 'Delete' } = options

    addAction('delete', {
      label,
      icon: 'pi pi-trash',
      severity: 'danger',
      onClick: confirmDelete,
      visible: () => isEdit.value && manager.canDelete(data.value)
    })
  }

  /**
   * Add standard "Cancel" action
   */
  function addCancelAction(options = {}) {
    const { label = 'Cancel' } = options

    addAction('cancel', {
      label,
      icon: 'pi pi-times',
      severity: 'secondary',
      onClick: cancel,
      disabled: ({ saving }) => saving
    })
  }

  // ============ TITLE ============

  /**
   * Entity display label (e.g., "David Berlioz" for a user)
   */
  const entityLabel = computed(() => {
    return manager.getEntityLabel(data.value)
  })

  /**
   * Auto-generated page title
   * - Edit mode: "Edit Book: The Great Gatsby"
   * - Create mode: "Create Book"
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
   */
  const pageTitleParts = computed(() => ({
    action: isEdit.value ? 'Edit' : 'Create',
    entityName,
    entityLabel: isEdit.value ? entityLabel.value : null
  }))

  // Provide title parts for automatic PageHeader consumption
  provide('qdadmPageTitleParts', pageTitleParts)

  // ============ LIFECYCLE ============

  onMounted(() => {
    if (loadOnMount) {
      load()
    }
  })

  // ============ FORMPAGE PROPS/EVENTS ============

  /**
   * Props object for FormPage component
   * Use with v-bind: <FormPage v-bind="form.props.value">
   */
  const formProps = computed(() => ({
    // Mode
    isEdit: isEdit.value,
    mode: mode.value,

    // State
    loading: loading.value,
    saving: saving.value,
    dirty: dirty.value,

    // Title
    title: pageTitle.value,
    titleParts: pageTitleParts.value,

    // Fields (for auto-rendering)
    fields: fields.value,

    // Actions
    actions: actions.value,

    // Permissions
    canSave: canSave.value,
    canDelete: canDeleteRecord.value,

    // Validation state
    errors: errors.value,
    hasErrors: hasErrors.value,
    errorSummary: showErrorSummary ? errorSummary.value : null,
    submitted: submitted.value,

    // Guard dialog (for UnsavedChangesDialog)
    guardDialog
  }))

  /**
   * Event handlers for FormPage
   * Use with v-on: <FormPage v-bind="form.props.value" v-on="form.events">
   */
  const formEvents = {
    save: () => submit(false),
    saveAndClose: () => submit(true),
    cancel,
    delete: confirmDelete
  }

  // ============ BUILDER API ============
  // Object reference for method chaining (used by field methods)
  const builderApi = {
    // Manager access
    manager,

    // Mode
    mode,
    isEdit,
    isCreate,
    entityId,

    // Parent chain (from route.meta.parent, supports N-level nesting)
    parentConfig,
    parentId,
    parentData,        // Immediate parent (level 1)
    parentChain,       // All parents: Map(level -> data)
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

    // Guard dialog (for UnsavedChangesDialog - pass to PageLayout)
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
    events: formEvents
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
