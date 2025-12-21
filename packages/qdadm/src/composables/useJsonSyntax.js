/**
 * useJsonSyntax - Shared JSON syntax highlighting utilities
 *
 * Provides consistent JSON formatting and syntax highlighting
 * across JsonEditor, JsonViewer, and JsonEditorFoldable components.
 */

/**
 * Apply syntax highlighting to JSON string
 * @param {string} jsonText - Raw JSON text
 * @returns {string} HTML with syntax highlighting spans
 */
export function highlightJson(jsonText) {
  if (!jsonText) {
    return ''
  }

  return jsonText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Strings (values only - after colon or in arrays)
    .replace(/("(?:[^"\\]|\\.)*")(?=\s*[,\]}]|\s*$)/gm, '<span class="json-string">$1</span>')
    // Keys (before colon)
    .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="json-key">$1</span>$2')
    // Numbers
    .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="json-number">$1</span>')
    // Booleans
    .replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>')
    // Null
    .replace(/\bnull\b/g, '<span class="json-null">null</span>')
}

/**
 * Get the type of a JSON value for display
 * @param {any} value - The value to check
 * @returns {string} Type name: 'string', 'number', 'boolean', 'null', 'array', 'object'
 */
export function getJsonValueType(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

/**
 * Get a short preview of a JSON value
 * @param {any} value - The value to preview
 * @param {number} maxLength - Maximum length for string previews
 * @returns {string} Short preview text
 */
export function getJsonPreview(value, maxLength = 50) {
  const type = getJsonValueType(value)

  switch (type) {
    case 'string': {
      const preview = value.substring(0, maxLength)
      return preview + (value.length > maxLength ? '...' : '')
    }
    case 'array':
      return `[${value.length} item${value.length !== 1 ? 's' : ''}]`
    case 'object':
      return `{${Object.keys(value).length} key${Object.keys(value).length !== 1 ? 's' : ''}}`
    case 'null':
      return 'null'
    case 'boolean':
      return String(value)
    case 'number':
      return String(value)
    default:
      return String(value)
  }
}

/**
 * Safely parse JSON with error handling
 * @param {string} text - JSON text to parse
 * @returns {{ value: any, error: string | null }} Parse result
 */
export function safeJsonParse(text) {
  if (!text || !text.trim()) {
    return { value: null, error: null }
  }
  try {
    return { value: JSON.parse(text), error: null }
  } catch (e) {
    return { value: null, error: e.message }
  }
}

/**
 * CSS class names for JSON syntax highlighting
 * Import these in your component's style section
 */
export const JSON_SYNTAX_CLASSES = `
.json-key { color: #881391; }
.json-string { color: #1a1aa6; }
.json-number { color: #1c00cf; }
.json-boolean { color: #0d22aa; font-weight: 500; }
.json-null { color: #808080; font-style: italic; }
.json-placeholder { color: var(--p-surface-400); }
`
