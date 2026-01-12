/**
 * useJsonSyntax - Shared JSON syntax highlighting utilities
 *
 * Provides consistent JSON formatting and syntax highlighting
 * across JsonEditor, JsonViewer, and JsonEditorFoldable components.
 */

/**
 * JSON value type enumeration
 */
export type JsonValueType = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object'

/**
 * Result of safe JSON parsing
 */
export interface SafeJsonParseResult<T = unknown> {
  value: T | null
  error: string | null
}

/**
 * Apply syntax highlighting to JSON string
 * @param jsonText - Raw JSON text
 * @returns HTML with syntax highlighting spans
 */
export function highlightJson(jsonText: string): string {
  if (!jsonText) {
    return ''
  }

  return (
    jsonText
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
  )
}

/**
 * Get the type of a JSON value for display
 * @param value - The value to check
 * @returns Type name: 'string', 'number', 'boolean', 'null', 'array', 'object'
 */
export function getJsonValueType(value: unknown): JsonValueType {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value as JsonValueType
}

/**
 * Get a short preview of a JSON value
 * @param value - The value to preview
 * @param maxLength - Maximum length for string previews
 * @returns Short preview text
 */
export function getJsonPreview(value: unknown, maxLength = 50): string {
  const type = getJsonValueType(value)

  switch (type) {
    case 'string': {
      const strValue = value as string
      const preview = strValue.substring(0, maxLength)
      return preview + (strValue.length > maxLength ? '...' : '')
    }
    case 'array': {
      const arrValue = value as unknown[]
      return `[${arrValue.length} item${arrValue.length !== 1 ? 's' : ''}]`
    }
    case 'object': {
      const objValue = value as Record<string, unknown>
      const keyCount = Object.keys(objValue).length
      return `{${keyCount} key${keyCount !== 1 ? 's' : ''}}`
    }
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
 * @param text - JSON text to parse
 * @returns Parse result with value and error
 */
export function safeJsonParse<T = unknown>(text: string): SafeJsonParseResult<T> {
  if (!text || !text.trim()) {
    return { value: null, error: null }
  }
  try {
    return { value: JSON.parse(text) as T, error: null }
  } catch (e) {
    return { value: null, error: (e as Error).message }
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
