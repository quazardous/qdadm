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

import type { UnifiedFieldType } from './schema'

/**
 * Base type mappings: JSON Schema type -> UnifiedFieldSchema type
 */
export const BASE_TYPE_MAPPINGS: Readonly<Record<string, UnifiedFieldType>> = Object.freeze({
  string: 'text',
  integer: 'number',
  number: 'number',
  boolean: 'boolean',
  array: 'array',
  object: 'object',
})

/**
 * Format-specific mappings: JSON Schema format -> UnifiedFieldSchema type
 *
 * These take precedence over base type mappings when a format is specified.
 */
export const FORMAT_MAPPINGS: Readonly<Record<string, UnifiedFieldType>> = Object.freeze({
  email: 'email',
  'date-time': 'datetime',
  date: 'date',
  uri: 'url',
  url: 'url',
  uuid: 'uuid',
  password: 'text',
})

/**
 * Custom mappings override structure
 */
export interface CustomMappings {
  /** Custom type mappings { jsonSchemaType: unifiedType } */
  types?: Record<string, string>
  /** Custom format mappings { jsonSchemaFormat: unifiedType } */
  formats?: Record<string, string>
}

/**
 * Minimal JSON Schema property definition for type detection
 */
export interface SchemaProperty {
  /** JSON Schema type (string, integer, number, boolean, array, object) */
  type?: string
  /** JSON Schema format (email, date-time, uuid, etc.) */
  format?: string
  /** Enumeration values */
  enum?: unknown[]
}

/**
 * Get the UnifiedFieldSchema type for a JSON Schema property
 *
 * @param schema - JSON Schema property definition
 * @param customMappings - Optional custom type/format mappings
 * @returns Unified field type
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
export function getDefaultType(
  schema: SchemaProperty | null | undefined,
  customMappings: CustomMappings = {}
): UnifiedFieldType | 'select' {
  const { type, format } = schema || {}

  // Check for enum pattern first (returns 'select')
  if (Array.isArray(schema?.enum) && schema.enum.length > 0) {
    return 'select'
  }

  // Check custom format mapping
  if (format && customMappings.formats?.[format]) {
    return customMappings.formats[format] as UnifiedFieldType
  }

  // Check default format mapping
  if (format && FORMAT_MAPPINGS[format]) {
    return FORMAT_MAPPINGS[format]
  }

  // Check custom type mapping
  if (type && customMappings.types?.[type]) {
    return customMappings.types[type] as UnifiedFieldType
  }

  // Fall back to base type mapping, default to 'text'
  return (type && BASE_TYPE_MAPPINGS[type]) || 'text'
}
