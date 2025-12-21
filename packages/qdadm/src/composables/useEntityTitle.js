/**
 * Composable for generating display titles for entities
 *
 * Usage:
 * const { displayTitle, pageTitle } = useEntityTitle(entity, {
 *   type: 'Agent',
 *   nameField: 'name',  // default
 *   fallbackField: 'id'  // default
 * })
 *
 * // In template:
 * <h1>{{ pageTitle }}</h1>  // "Edit Agent John Doe" or "Create Agent"
 */

import { computed } from 'vue'

/**
 * Field priority for display title (first match wins)
 */
const DEFAULT_NAME_FIELDS = ['name', 'title', 'label', 'username', 'slug']

/**
 * Get display title from an entity object
 *
 * @param {Object} entity - Entity object
 * @param {Object} options - Options
 * @param {string|string[]} options.nameField - Field(s) to use for display name
 * @param {string} options.fallbackField - Fallback field (usually 'id')
 * @param {number} options.maxLength - Max length before truncation (default: 50)
 * @returns {string} Display title
 */
export function getEntityDisplayTitle(entity, options = {}) {
  if (!entity) return ''

  const {
    nameField = DEFAULT_NAME_FIELDS,
    fallbackField = 'id',
    maxLength = 50
  } = options

  // Try name fields in order
  const fields = Array.isArray(nameField) ? nameField : [nameField]
  for (const field of fields) {
    const value = entity[field]
    if (value && typeof value === 'string' && value.trim()) {
      const title = value.trim()
      if (title.length > maxLength) {
        return title.slice(0, maxLength - 3) + '...'
      }
      return title
    }
  }

  // Fallback to ID (truncated)
  const fallback = entity[fallbackField]
  if (fallback) {
    const id = String(fallback)
    if (id.length > 12) {
      return id.slice(0, 8) + '...'
    }
    return id
  }

  return ''
}

/**
 * Composable for entity display titles
 *
 * @param {Ref<Object>} entityRef - Reactive entity reference
 * @param {Object} options - Options
 * @param {string} options.type - Entity type name (e.g., 'Agent', 'Newsroom')
 * @param {string|string[]} options.nameField - Field(s) to use for display name
 * @param {string} options.fallbackField - Fallback field (usually 'id')
 * @param {Ref<boolean>} options.isEdit - Reactive boolean for edit mode
 */
export function useEntityTitle(entityRef, options = {}) {
  const {
    type = 'Entity',
    nameField = DEFAULT_NAME_FIELDS,
    fallbackField = 'id',
    isEdit = null
  } = options

  /**
   * Display title for the entity (just the name/id part)
   */
  const displayTitle = computed(() => {
    return getEntityDisplayTitle(entityRef.value, { nameField, fallbackField })
  })

  /**
   * Full page title (e.g., "Edit Agent John Doe" or "Create Agent")
   */
  const pageTitle = computed(() => {
    if (isEdit?.value) {
      const title = displayTitle.value
      return title ? `Edit ${type}: ${title}` : `Edit ${type}`
    }
    return `Create ${type}`
  })

  /**
   * Browser document title
   */
  const documentTitle = computed(() => {
    if (isEdit?.value) {
      const title = displayTitle.value
      return title ? `${title} - ${type}` : `Edit ${type}`
    }
    return `New ${type}`
  })

  return {
    displayTitle,
    pageTitle,
    documentTitle
  }
}

export default useEntityTitle
