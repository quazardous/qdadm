import { computed, inject } from 'vue'

/**
 * Composable for building sub-editor components that edit a portion of parent form data.
 *
 * Sub-editors receive data via v-model and emit updates, but don't handle persistence.
 * The parent form (using useForm/useBareForm) handles loading, saving, and dirty tracking.
 *
 * Usage in sub-editor:
 *   const props = defineProps({ modelValue: Object })
 *   const emit = defineEmits(['update:modelValue'])
 *
 *   const { data, update, field } = useSubEditor(props, emit)
 *
 *   // Access data
 *   data.value.someField
 *
 *   // Update single field
 *   update('someField', newValue)
 *
 *   // Computed getter/setter for field
 *   const myField = field('someField', defaultValue)
 *   myField.value = 'new value' // auto-emits update
 *
 *   // Nested field access
 *   const nested = field('config.subsection.value', 0)
 *
 * Features:
 * - Simplified update pattern (no manual spread)
 * - Computed fields with get/set for v-model binding
 * - Nested path support (dot notation)
 * - Default values
 * - Optional dirty field indicator integration with parent
 *
 * @param {Object} props - Component props (must include modelValue)
 * @param {Function} emit - Component emit function
 * @param {Object} options - Additional options
 * @param {*} options.defaultData - Default data structure if modelValue is empty
 */
export function useSubEditor(props, emit, options = {}) {
  const { defaultData = {} } = options

  // Computed reference to data (with default fallback)
  const data = computed(() => props.modelValue ?? defaultData)

  /**
   * Get value at nested path
   */
  function getNestedValue(obj, path) {
    if (!path.includes('.')) {
      return obj?.[path]
    }
    return path.split('.').reduce((curr, key) => curr?.[key], obj)
  }

  /**
   * Set value at nested path, returning new object
   */
  function setNestedValue(obj, path, value) {
    if (!path.includes('.')) {
      return { ...obj, [path]: value }
    }

    const keys = path.split('.')
    const result = { ...obj }
    let current = result

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      current[key] = { ...current[key] }
      current = current[key]
    }

    current[keys[keys.length - 1]] = value
    return result
  }

  /**
   * Update a field and emit the new value
   * @param {string} path - Field path (supports dot notation for nested)
   * @param {*} value - New value
   */
  function update(path, value) {
    const newData = setNestedValue(data.value, path, value)
    emit('update:modelValue', newData)
  }

  /**
   * Replace entire data object
   * @param {Object} newData - Complete new data object
   */
  function replace(newData) {
    emit('update:modelValue', newData)
  }

  /**
   * Create a computed ref for a field with get/set
   * Useful for v-model binding in template
   *
   * @param {string} path - Field path (supports dot notation)
   * @param {*} defaultValue - Default value if field is undefined
   * @returns {ComputedRef} Writable computed ref
   */
  function field(path, defaultValue = undefined) {
    return computed({
      get: () => {
        const value = getNestedValue(data.value, path)
        return value !== undefined ? value : defaultValue
      },
      set: (value) => update(path, value)
    })
  }

  /**
   * Create multiple field refs at once
   * @param {Object} fields - { fieldName: defaultValue, ... }
   * @returns {Object} { fieldName: computedRef, ... }
   */
  function fields(fieldDefs) {
    const result = {}
    for (const [path, defaultValue] of Object.entries(fieldDefs)) {
      result[path] = field(path, defaultValue)
    }
    return result
  }

  /**
   * Get value with default fallback (non-reactive, for one-time reads)
   */
  function get(path, defaultValue = undefined) {
    const value = getNestedValue(data.value, path)
    return value !== undefined ? value : defaultValue
  }

  // Try to inject field-level dirty tracking from parent (if available)
  const parentIsFieldDirty = inject('isFieldDirty', null)

  /**
   * Check if a field is dirty (if parent provides tracking)
   * This allows sub-editors to show field-level dirty indicators
   */
  function isFieldDirty(path) {
    if (!parentIsFieldDirty) return false
    // The parent tracks 'form.value.fieldName' or similar
    // We need to prefix with the path the parent uses
    return parentIsFieldDirty(path)
  }

  return {
    // Data access
    data,
    get,

    // Updates
    update,
    replace,

    // Field helpers
    field,
    fields,

    // Dirty tracking (from parent)
    isFieldDirty
  }
}
