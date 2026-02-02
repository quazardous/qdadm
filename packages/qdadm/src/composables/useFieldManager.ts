/**
 * useFieldManager - Shared field and group management for form/show pages
 *
 * Provides unified API for:
 * - Field management (add, update, remove, reorder)
 * - Group management (hierarchical, with dot notation support)
 * - Type mapping (customizable per consumer)
 *
 * ## Usage
 *
 * ```ts
 * const fieldManager = useFieldManager({
 *   typeMappings: FORM_TYPE_MAPPINGS,
 *   resolveFieldConfig: (name, config) => ({ ... }),
 * })
 *
 * fieldManager.generateFields(formFields, { exclude: ['id'] })
 * fieldManager.group('info', ['name', 'email'], { label: 'Information' })
 * ```
 */
import { ref, computed, type Ref, type ComputedRef } from 'vue'

/**
 * Base field definition (minimal common interface)
 */
export interface BaseFieldDefinition {
  name: string
  type?: string
  schemaType?: string
  label?: string
  [key: string]: unknown
}

/**
 * Resolved field configuration
 */
export interface ResolvedFieldConfig extends BaseFieldDefinition {
  name: string
  type: string
  schemaType: string
  label: string
  group?: string
}

/**
 * Internal group representation
 */
interface InternalGroup {
  name: string
  label: string
  fields: string[]
  parent?: string
  // Tab/accordion options
  icon?: string
  badge?: string | number
  badgeSeverity?: BadgeSeverity
  count?: number
  visible?: boolean
  disabled?: boolean
}

/**
 * Field group (tree structure for rendering)
 */
export interface FieldGroup<T extends ResolvedFieldConfig = ResolvedFieldConfig> {
  name: string
  label: string
  fields: T[]
  children: FieldGroup<T>[]
  parent?: string
  // Tab/accordion options
  icon?: string
  badge?: string | number
  badgeSeverity?: BadgeSeverity
  count?: number
  visible?: boolean
  disabled?: boolean
}

/**
 * Group definition input (for defineGroups)
 */
export interface GroupDefinition extends GroupOptions {
  fields?: string[]
  children?: Record<string, GroupDefinition>
}

/**
 * Badge severity type
 */
export type BadgeSeverity = 'secondary' | 'info' | 'success' | 'warn' | 'danger' | 'contrast'

/**
 * Group options
 */
export interface GroupOptions {
  label?: string
  /** Icon class (e.g., 'pi-cog', 'cog', 'pi pi-cog') */
  icon?: string
  /** Badge value */
  badge?: string | number
  /** Badge severity/color */
  badgeSeverity?: BadgeSeverity
  /** Count badge (shows only if > 0) */
  count?: number
  /** Show/hide the group (for tabs/accordion) */
  visible?: boolean
  /** Disable the group tab */
  disabled?: boolean
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
 * Position options for moveField
 */
export interface MoveFieldPosition {
  /** Move after this field */
  after?: string | null
  /** Move before this field */
  before?: string | null
}

/**
 * Field resolver function
 */
export type FieldResolver<T extends ResolvedFieldConfig = ResolvedFieldConfig> = (
  name: string,
  fieldConfig: Partial<BaseFieldDefinition>
) => T

/**
 * Options for useFieldManager
 */
export interface UseFieldManagerOptions<T extends ResolvedFieldConfig = ResolvedFieldConfig> {
  /** Custom field resolver (transforms raw config to resolved config) */
  resolveFieldConfig?: FieldResolver<T>
  /** Get field config from schema (e.g., manager.getFieldConfig) */
  getSchemaFieldConfig?: (name: string) => Partial<BaseFieldDefinition> | null
}

/**
 * Return type for useFieldManager
 */
export interface UseFieldManagerReturn<T extends ResolvedFieldConfig = ResolvedFieldConfig> {
  // Field storage (refs for direct manipulation if needed)
  fieldsMap: Ref<Map<string, T>>
  fieldOrder: Ref<string[]>
  excludedFields: Ref<Set<string>>

  // Field management
  fields: ComputedRef<T[]>
  generateFields: (formFields: BaseFieldDefinition[], options?: GenerateFieldsOptions) => UseFieldManagerReturn<T>
  addField: (name: string, fieldConfig: Partial<BaseFieldDefinition>, options?: AddFieldOptions) => UseFieldManagerReturn<T>
  updateField: (name: string, updates: Partial<BaseFieldDefinition>) => UseFieldManagerReturn<T>
  removeField: (name: string) => UseFieldManagerReturn<T>
  excludeField: (name: string) => UseFieldManagerReturn<T>
  setFieldOrder: (order: string[]) => UseFieldManagerReturn<T>
  moveField: (name: string, position: MoveFieldPosition) => UseFieldManagerReturn<T>
  getField: (name: string) => T | undefined
  getFieldsByGroup: (groupName: string) => T[]

  // Group management
  groups: ComputedRef<FieldGroup<T>[]>
  group: (name: string, fieldsOrOptions?: string[] | GroupOptions, options?: GroupOptions) => UseFieldManagerReturn<T>
  defineGroups: (definitions: Record<string, GroupDefinition>) => UseFieldManagerReturn<T>
  getGroup: (name: string) => FieldGroup<T> | undefined
  clearGroups: () => UseFieldManagerReturn<T>

  // Utilities
  hasField: (name: string) => boolean
  hasGroup: (name: string) => boolean
  getUngroupedFields: () => T[]
}

/**
 * Convert snake_case/kebab-case to Title Case
 */
export function snakeCaseToTitle(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

/**
 * Default field resolver (basic type mapping)
 */
function defaultResolveFieldConfig(
  name: string,
  fieldConfig: Partial<BaseFieldDefinition>
): ResolvedFieldConfig {
  const { type = 'text', label, ...rest } = fieldConfig
  return {
    name,
    type,
    schemaType: type,
    label: label || snakeCaseToTitle(name),
    ...rest,
  }
}

/**
 * Create a field and group manager
 */
export function useFieldManager<T extends ResolvedFieldConfig = ResolvedFieldConfig>(
  options: UseFieldManagerOptions<T> = {}
): UseFieldManagerReturn<T> {
  const {
    resolveFieldConfig = defaultResolveFieldConfig as FieldResolver<T>,
    getSchemaFieldConfig,
  } = options

  // ============ FIELD STORAGE ============

  const fieldsMap = ref<Map<string, T>>(new Map()) as Ref<Map<string, T>>
  const fieldOrder = ref<string[]>([])
  const excludedFields = ref<Set<string>>(new Set())

  // ============ FIELD MANAGEMENT ============

  function generateFields(
    formFields: BaseFieldDefinition[],
    genOptions: GenerateFieldsOptions = {}
  ): UseFieldManagerReturn<T> {
    const { only = null, exclude = [] } = genOptions

    const allExcluded = new Set([...excludedFields.value, ...exclude])

    for (const fieldDef of formFields) {
      const { name, ...fieldConfig } = fieldDef
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
    fieldConfig: Partial<BaseFieldDefinition>,
    addOptions: AddFieldOptions = {}
  ): UseFieldManagerReturn<T> {
    const { after = null, before = null } = addOptions

    // Merge with schema config if available
    const schemaConfig = getSchemaFieldConfig?.(name) || {}
    const resolvedConfig = resolveFieldConfig(name, { ...schemaConfig, ...fieldConfig })

    fieldsMap.value.set(name, resolvedConfig)

    // Handle positioning
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
    } else if (currentIndex === -1) {
      fieldOrder.value.push(name)
    } else {
      fieldOrder.value.splice(currentIndex, 0, name)
    }

    return returnValue
  }

  function updateField(
    name: string,
    updates: Partial<BaseFieldDefinition>
  ): UseFieldManagerReturn<T> {
    const existing = fieldsMap.value.get(name)
    if (existing) {
      fieldsMap.value.set(name, { ...existing, ...updates } as T)
    }
    return returnValue
  }

  function removeField(name: string): UseFieldManagerReturn<T> {
    fieldsMap.value.delete(name)
    const idx = fieldOrder.value.indexOf(name)
    if (idx !== -1) {
      fieldOrder.value.splice(idx, 1)
    }
    return returnValue
  }

  function excludeField(name: string): UseFieldManagerReturn<T> {
    excludedFields.value.add(name)
    removeField(name)
    return returnValue
  }

  function setFieldOrder(order: string[]): UseFieldManagerReturn<T> {
    fieldOrder.value = order.filter((name) => fieldsMap.value.has(name))
    return returnValue
  }

  function moveField(name: string, position: MoveFieldPosition): UseFieldManagerReturn<T> {
    const { after = null, before = null } = position

    const currentIndex = fieldOrder.value.indexOf(name)
    if (currentIndex === -1) return returnValue

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

    return returnValue
  }

  function getField(name: string): T | undefined {
    return fieldsMap.value.get(name)
  }

  function hasField(name: string): boolean {
    return fieldsMap.value.has(name)
  }

  const fields = computed<T[]>(() => {
    return fieldOrder.value
      .map((name) => fieldsMap.value.get(name))
      .filter((f): f is T => f !== undefined)
  })

  // ============ GROUP MANAGEMENT ============

  const groupsMap = ref<Map<string, InternalGroup>>(new Map())

  /**
   * Create or update a group
   * @param name - Group name (supports dot notation: 'parent.child')
   * @param fieldsOrOptions - Array of field names or group options
   * @param options - Group options (if fieldsOrOptions is array)
   */
  function group(
    name: string,
    fieldsOrOptions?: string[] | GroupOptions,
    options?: GroupOptions
  ): UseFieldManagerReturn<T> {
    const fieldNames = Array.isArray(fieldsOrOptions) ? fieldsOrOptions : []
    const groupOptions = Array.isArray(fieldsOrOptions) ? options : fieldsOrOptions

    // Parse parent from dot notation
    const parts = name.split('.')
    const groupName = parts[parts.length - 1] || name
    const parentName = parts.length > 1 ? parts.slice(0, -1).join('.') : undefined

    // Create parent groups if they don't exist
    if (parentName && !groupsMap.value.has(parentName)) {
      const parentLabel = parentName.split('.').pop() || parentName
      group(parentName, { label: snakeCaseToTitle(parentLabel) })
    }

    // Create or update group
    const existing = groupsMap.value.get(name)
    groupsMap.value.set(name, {
      name,
      label: groupOptions?.label || existing?.label || snakeCaseToTitle(groupName),
      fields: [...(existing?.fields || []), ...fieldNames],
      parent: parentName,
      // Tab/accordion options (preserve existing if not specified)
      icon: groupOptions?.icon ?? existing?.icon,
      badge: groupOptions?.badge ?? existing?.badge,
      badgeSeverity: groupOptions?.badgeSeverity ?? existing?.badgeSeverity,
      count: groupOptions?.count ?? existing?.count,
      visible: groupOptions?.visible ?? existing?.visible,
      disabled: groupOptions?.disabled ?? existing?.disabled,
    })

    // Update fields with group reference
    for (const fieldName of fieldNames) {
      const field = fieldsMap.value.get(fieldName)
      if (field) {
        fieldsMap.value.set(fieldName, { ...field, group: name } as T)
      }
    }

    return returnValue
  }

  /**
   * Define groups from object structure
   */
  function defineGroups(
    definitions: Record<string, GroupDefinition>,
    parentPath = ''
  ): UseFieldManagerReturn<T> {
    for (const [name, def] of Object.entries(definitions)) {
      const fullPath = parentPath ? `${parentPath}.${name}` : name

      // Extract options (everything except fields and children)
      const { fields: defFields, children, ...options } = def

      // Create group with fields and all options
      group(fullPath, defFields || [], options)

      // Recursively define children
      if (children) {
        defineGroups(children, fullPath)
      }
    }

    return returnValue
  }

  /**
   * Build group tree from internal group
   */
  function buildGroupTree(internal: InternalGroup): FieldGroup<T> {
    const groupFields = internal.fields
      .map((name) => fieldsMap.value.get(name))
      .filter((f): f is T => f !== undefined)

    // Find children
    const children: FieldGroup<T>[] = []
    for (const [, g] of groupsMap.value.entries()) {
      if (g.parent === internal.name) {
        children.push(buildGroupTree(g))
      }
    }

    return {
      name: internal.name,
      label: internal.label,
      fields: groupFields,
      children,
      parent: internal.parent,
      // Tab/accordion options
      icon: internal.icon,
      badge: internal.badge,
      badgeSeverity: internal.badgeSeverity,
      count: internal.count,
      visible: internal.visible,
      disabled: internal.disabled,
    }
  }

  /**
   * Get a group by name
   */
  function getGroup(name: string): FieldGroup<T> | undefined {
    const internal = groupsMap.value.get(name)
    if (!internal) return undefined
    return buildGroupTree(internal)
  }

  function hasGroup(name: string): boolean {
    return groupsMap.value.has(name)
  }

  function clearGroups(): UseFieldManagerReturn<T> {
    // Remove group references from fields
    for (const [name, field] of fieldsMap.value.entries()) {
      if (field.group) {
        fieldsMap.value.set(name, { ...field, group: undefined } as T)
      }
    }
    groupsMap.value.clear()
    return returnValue
  }

  /**
   * Get fields belonging to a specific group
   */
  function getFieldsByGroup(groupName: string): T[] {
    const internal = groupsMap.value.get(groupName)
    if (!internal) return []

    return internal.fields
      .map((name) => fieldsMap.value.get(name))
      .filter((f): f is T => f !== undefined)
  }

  /**
   * Get fields that don't belong to any group
   */
  function getUngroupedFields(): T[] {
    return fields.value.filter((f) => !f.group)
  }

  /**
   * Computed groups tree (only root groups)
   */
  const groups = computed<FieldGroup<T>[]>(() => {
    const rootGroups: FieldGroup<T>[] = []

    for (const [, internal] of groupsMap.value.entries()) {
      // Only include root groups (no parent)
      if (!internal.parent) {
        rootGroups.push(buildGroupTree(internal))
      }
    }

    // If no groups defined, create a single "default" group with all fields
    if (rootGroups.length === 0 && fields.value.length > 0) {
      return [
        {
          name: '_default',
          label: '',
          fields: fields.value,
          children: [],
        },
      ]
    }

    return rootGroups
  })

  // ============ RETURN ============

  const returnValue: UseFieldManagerReturn<T> = {
    // Field storage
    fieldsMap,
    fieldOrder,
    excludedFields,

    // Field management
    fields,
    generateFields,
    addField,
    updateField,
    removeField,
    excludeField,
    setFieldOrder,
    moveField,
    getField,
    getFieldsByGroup,

    // Group management
    groups,
    group,
    defineGroups,
    getGroup,
    clearGroups,

    // Utilities
    hasField,
    hasGroup,
    getUngroupedFields,
  }

  return returnValue
}
