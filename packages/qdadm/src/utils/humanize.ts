/**
 * Field-name humanization (#1255)
 *
 * Turns machine field names into presentable labels:
 *   'botUuid'      → 'Bot Uuid'
 *   'created_at'   → 'Created At'
 *   'filter.botId' → 'Filter Bot Id'
 *
 * Shared by the list column binding helper (useListPage.column()) and the
 * OpenAPI connector's opt-in label inference — dependency-free so the gen
 * side (node) can import it too.
 */

/**
 * Humanize a field name: split camelCase, snake_case, kebab-case and dotted
 * segments into words, then capitalize each word.
 */
export function humanizeFieldName(field: string): string {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
