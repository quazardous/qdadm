/**
 * Field Type Mapper
 *
 * Maps JSON Schema types and formats to UnifiedFieldSchema types.
 * Extracted from Skybot and Faketual to eliminate duplication.
 *
 * Mapping priority:
 * 1. Enum detection (schema.enum present -> 'select')
 * 2. Custom mappings (user-provided)
 * 3. Format-specific mappings (e.g., string + format:email -> email)
 * 4. Base type mappings (e.g., string -> text)
 *
 * @module gen/FieldMapper
 */

/**
 * Base type mappings: JSON Schema type -> UnifiedFieldSchema type
 *
 * @type {Readonly<Record<string, import('./schema.js').UnifiedFieldType>>}
 */
export const BASE_TYPE_MAPPINGS = Object.freeze({
  string: 'text',
  integer: 'number',
  number: 'number',
  boolean: 'boolean',
  array: 'array',
  object: 'object'
})

/**
 * Format-specific mappings: JSON Schema format -> UnifiedFieldSchema type
 *
 * These take precedence over base type mappings when a format is specified.
 *
 * @type {Readonly<Record<string, import('./schema.js').UnifiedFieldType>>}
 */
export const FORMAT_MAPPINGS = Object.freeze({
  email: 'email',
  'date-time': 'datetime',
  date: 'date',
  uri: 'url',
  url: 'url',
  uuid: 'uuid',
  password: 'text'
})

/**
 * Custom mappings override structure
 *
 * @typedef {object} CustomMappings
 * @property {Record<string, string>} [types] - Custom type mappings { jsonSchemaType: unifiedType }
 * @property {Record<string, string>} [formats] - Custom format mappings { jsonSchemaFormat: unifiedType }
 */

/**
 * Minimal JSON Schema property definition for type detection
 *
 * @typedef {object} SchemaProperty
 * @property {string} [type] - JSON Schema type (string, integer, number, boolean, array, object)
 * @property {string} [format] - JSON Schema format (email, date-time, uuid, etc.)
 * @property {Array<*>} [enum] - Enumeration values
 */

/**
 * Get the UnifiedFieldSchema type for a JSON Schema property
 *
 * @param {SchemaProperty} schema - JSON Schema property definition
 * @param {CustomMappings} [customMappings] - Optional custom type/format mappings
 * @returns {import('./schema.js').UnifiedFieldType | 'select'} - Unified field type
 *
 * @example
 * // Basic type mapping
 * getDefaultType({ type: 'string' })           // 'text'
 * getDefaultType({ type: 'integer' })          // 'number'
 *
 * @example
 * // Format takes precedence
 * getDefaultType({ type: 'string', format: 'email' })  // 'email'
 * getDefaultType({ type: 'string', format: 'uuid' })   // 'uuid'
 *
 * @example
 * // Enum detection
 * getDefaultType({ type: 'string', enum: ['a', 'b'] }) // 'select'
 *
 * @example
 * // Custom mappings
 * getDefaultType({ type: 'string', format: 'phone' }, {
 *   formats: { phone: 'text' }
 * })  // 'text'
 */
export function getDefaultType(schema, customMappings = {}) {
  const { type, format } = schema || {}

  // Check for enum pattern first (returns 'select')
  if (Array.isArray(schema?.enum) && schema.enum.length > 0) {
    return 'select'
  }

  // Check custom format mapping
  if (format && customMappings.formats?.[format]) {
    return customMappings.formats[format]
  }

  // Check default format mapping
  if (format && FORMAT_MAPPINGS[format]) {
    return FORMAT_MAPPINGS[format]
  }

  // Check custom type mapping
  if (type && customMappings.types?.[type]) {
    return customMappings.types[type]
  }

  // Fall back to base type mapping, default to 'text'
  return BASE_TYPE_MAPPINGS[type] || 'text'
}
