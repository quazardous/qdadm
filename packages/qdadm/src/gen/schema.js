/**
 * Unified Schema Types
 *
 * Core contracts that abstract differences between OpenAPI, Pydantic, and manual schema sources.
 * These types provide a common format for entity and field definitions that can be used
 * by connectors (schema sources) and generators (code output).
 *
 * @module gen/schema
 */

/**
 * Field Type Enumeration
 *
 * Unified field types that abstract source-specific types (OpenAPI string/integer,
 * Pydantic str/int, etc.) into a common set.
 *
 * @typedef {'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'email' | 'url' | 'uuid' | 'array' | 'object'} UnifiedFieldType
 */

/**
 * Reference Definition
 *
 * Describes a relation to another entity for foreign key fields.
 *
 * @typedef {object} UnifiedFieldReference
 * @property {string} entity - Target entity name (e.g., 'users', 'categories')
 * @property {string} [labelField] - Field to display as label (e.g., 'name', 'title')
 */

/**
 * Unified Field Schema
 *
 * Common field definition that abstracts OpenAPI property, Pydantic field, or manual definition.
 * Connectors transform their source-specific formats into this common shape.
 *
 * @typedef {object} UnifiedFieldSchema
 * @property {string} name - Field name (e.g., 'email', 'created_at')
 * @property {UnifiedFieldType} type - Unified field type
 * @property {string} [label] - Human-readable label (e.g., 'Email Address')
 * @property {boolean} [required] - Whether field is required (default: false)
 * @property {boolean} [readOnly] - Whether field is read-only (default: false)
 * @property {boolean} [hidden] - Whether field should be hidden in UI (default: false)
 * @property {string} [format] - Original format hint from source (e.g., 'date-time', 'uri', 'email')
 * @property {string[]} [enum] - Allowed values for enumeration fields
 * @property {*} [default] - Default value for the field
 * @property {UnifiedFieldReference} [reference] - Relation to another entity
 * @property {Record<string, *>} [extensions] - Project-specific extensions
 *
 * @example
 * // Simple text field
 * const nameField = {
 *   name: 'name',
 *   type: 'text',
 *   label: 'Full Name',
 *   required: true
 * }
 *
 * @example
 * // Enum field with options
 * const statusField = {
 *   name: 'status',
 *   type: 'text',
 *   label: 'Status',
 *   enum: ['draft', 'published', 'archived'],
 *   default: 'draft'
 * }
 *
 * @example
 * // Foreign key with reference
 * const authorField = {
 *   name: 'author_id',
 *   type: 'number',
 *   label: 'Author',
 *   reference: {
 *     entity: 'users',
 *     labelField: 'username'
 *   }
 * }
 */

/**
 * Unified Entity Schema
 *
 * Common entity definition that abstracts OpenAPI path/schema, Pydantic model, or manual definition.
 * This is the primary contract between schema sources (connectors) and consumers (generators, runtime).
 *
 * @typedef {object} UnifiedEntitySchema
 * @property {string} name - Entity name, typically plural lowercase (e.g., 'users', 'blog_posts')
 * @property {string} endpoint - API endpoint path (e.g., '/users', '/api/v1/posts')
 * @property {string} [label] - Human-readable singular label (e.g., 'User', 'Blog Post')
 * @property {string} [labelPlural] - Human-readable plural label (e.g., 'Users', 'Blog Posts')
 * @property {string} [labelField] - Field used as display label (e.g., 'name', 'title')
 * @property {string} [routePrefix] - Route prefix for admin UI (e.g., 'user', 'blog-post')
 * @property {string} [idField] - Primary key field name (default: 'id')
 * @property {boolean} [readOnly] - Whether entity is read-only (no create/update/delete)
 * @property {Record<string, UnifiedFieldSchema>} fields - Field definitions keyed by field name
 * @property {Record<string, *>} [extensions] - Project-specific extensions
 *
 * @example
 * // Complete entity schema
 * const usersSchema = {
 *   name: 'users',
 *   endpoint: '/api/users',
 *   label: 'User',
 *   labelPlural: 'Users',
 *   labelField: 'username',
 *   routePrefix: 'user',
 *   idField: 'id',
 *   readOnly: false,
 *   fields: {
 *     id: { name: 'id', type: 'number', readOnly: true },
 *     username: { name: 'username', type: 'text', required: true },
 *     email: { name: 'email', type: 'email', required: true },
 *     created_at: { name: 'created_at', type: 'datetime', readOnly: true }
 *   }
 * }
 *
 * @example
 * // Read-only entity (external API)
 * const countriesSchema = {
 *   name: 'countries',
 *   endpoint: 'https://restcountries.com/v3.1/all',
 *   label: 'Country',
 *   labelPlural: 'Countries',
 *   labelField: 'name',
 *   idField: 'cca3',
 *   readOnly: true,
 *   fields: {
 *     cca3: { name: 'cca3', type: 'text', label: 'Code' },
 *     name: { name: 'name', type: 'text', label: 'Name' }
 *   }
 * }
 */

/**
 * Valid field types for UnifiedFieldSchema
 *
 * Used for validation and documentation. Maps to common UI input types:
 * - text: Single-line text input
 * - number: Numeric input
 * - boolean: Checkbox/toggle
 * - date: Date picker (date only)
 * - datetime: Date-time picker
 * - email: Email input with validation
 * - url: URL input with validation
 * - uuid: UUID text input
 * - array: Multi-value field (tags, list)
 * - object: Nested object (JSON editor or subform)
 *
 * @type {readonly UnifiedFieldType[]}
 */
export const UNIFIED_FIELD_TYPES = Object.freeze([
  'text',
  'number',
  'boolean',
  'date',
  'datetime',
  'email',
  'url',
  'uuid',
  'array',
  'object'
])

/**
 * Check if a type is a valid UnifiedFieldType
 *
 * @param {string} type - Type to validate
 * @returns {type is UnifiedFieldType} - True if valid
 *
 * @example
 * isValidFieldType('text')     // true
 * isValidFieldType('string')   // false (OpenAPI type, not unified)
 */
export function isValidFieldType(type) {
  return UNIFIED_FIELD_TYPES.includes(type)
}

/**
 * Create a minimal field schema with defaults
 *
 * @param {string} name - Field name
 * @param {UnifiedFieldType} type - Field type
 * @param {Partial<UnifiedFieldSchema>} [overrides] - Additional field properties
 * @returns {UnifiedFieldSchema} - Complete field schema
 *
 * @example
 * const field = createFieldSchema('email', 'email', { required: true })
 * // { name: 'email', type: 'email', required: true }
 */
export function createFieldSchema(name, type, overrides = {}) {
  return {
    name,
    type,
    ...overrides
  }
}

/**
 * Create a minimal entity schema with defaults
 *
 * @param {string} name - Entity name
 * @param {string} endpoint - API endpoint
 * @param {Record<string, UnifiedFieldSchema>} fields - Field definitions
 * @param {Partial<UnifiedEntitySchema>} [overrides] - Additional entity properties
 * @returns {UnifiedEntitySchema} - Complete entity schema
 *
 * @example
 * const schema = createEntitySchema('users', '/api/users', {
 *   id: createFieldSchema('id', 'number', { readOnly: true }),
 *   name: createFieldSchema('name', 'text', { required: true })
 * })
 */
export function createEntitySchema(name, endpoint, fields, overrides = {}) {
  return {
    name,
    endpoint,
    fields,
    ...overrides
  }
}
