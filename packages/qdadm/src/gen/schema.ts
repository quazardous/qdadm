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
 */
export type UnifiedFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'email'
  | 'url'
  | 'uuid'
  | 'array'
  | 'object'

/**
 * Reference Definition
 *
 * Describes a relation to another entity for foreign key fields.
 */
export interface UnifiedFieldReference {
  /** Target entity name (e.g., 'users', 'categories') */
  entity: string
  /** Field to display as label (e.g., 'name', 'title') */
  labelField?: string
}

/**
 * Unified Field Schema
 *
 * Common field definition that abstracts OpenAPI property, Pydantic field, or manual definition.
 * Connectors transform their source-specific formats into this common shape.
 *
 * @example
 * // Simple text field
 * const nameField: UnifiedFieldSchema = {
 *   name: 'name',
 *   type: 'text',
 *   label: 'Full Name',
 *   required: true
 * }
 *
 * @example
 * // Enum field with options
 * const statusField: UnifiedFieldSchema = {
 *   name: 'status',
 *   type: 'text',
 *   label: 'Status',
 *   enum: ['draft', 'published', 'archived'],
 *   default: 'draft'
 * }
 *
 * @example
 * // Foreign key with reference
 * const authorField: UnifiedFieldSchema = {
 *   name: 'author_id',
 *   type: 'number',
 *   label: 'Author',
 *   reference: {
 *     entity: 'users',
 *     labelField: 'username'
 *   }
 * }
 */
export interface UnifiedFieldSchema {
  /** Field name (e.g., 'email', 'created_at') */
  name: string
  /** Unified field type */
  type: UnifiedFieldType
  /** Human-readable label (e.g., 'Email Address') */
  label?: string
  /** Whether field is required (default: false) */
  required?: boolean
  /** Whether field is read-only (default: false) */
  readOnly?: boolean
  /** Whether field should be hidden in UI (default: false) */
  hidden?: boolean
  /** Original format hint from source (e.g., 'date-time', 'uri', 'email') */
  format?: string
  /** Allowed values for enumeration fields */
  enum?: string[]
  /** Default value for the field */
  default?: unknown
  /** Relation to another entity */
  reference?: UnifiedFieldReference
  /** Project-specific extensions */
  extensions?: Record<string, unknown>
  /** Field display order */
  order?: number
  /** Additional properties */
  [key: string]: unknown
}

/**
 * Unified Entity Schema
 *
 * Common entity definition that abstracts OpenAPI path/schema, Pydantic model, or manual definition.
 * This is the primary contract between schema sources (connectors) and consumers (generators, runtime).
 *
 * @example
 * // Complete entity schema
 * const usersSchema: UnifiedEntitySchema = {
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
 */
export interface UnifiedEntitySchema {
  /** Entity name, typically plural lowercase (e.g., 'users', 'blog_posts') */
  name: string
  /** API endpoint path (e.g., '/users', '/api/v1/posts') */
  endpoint: string
  /** Human-readable singular label (e.g., 'User', 'Blog Post') */
  label?: string
  /** Human-readable plural label (e.g., 'Users', 'Blog Posts') */
  labelPlural?: string
  /** Field used as display label (e.g., 'name', 'title') */
  labelField?: string
  /** Route prefix for admin UI (e.g., 'user', 'blog-post') */
  routePrefix?: string
  /** Primary key field name (default: 'id') */
  idField?: string
  /** Whether entity is read-only (no create/update/delete) */
  readOnly?: boolean
  /** Field definitions keyed by field name */
  fields: Record<string, UnifiedFieldSchema>
  /** Project-specific extensions */
  extensions?: Record<string, unknown>
}

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
 */
export const UNIFIED_FIELD_TYPES = [
  'text',
  'number',
  'boolean',
  'date',
  'datetime',
  'email',
  'url',
  'uuid',
  'array',
  'object',
] as const

/**
 * Check if a type is a valid UnifiedFieldType
 *
 * @param type - Type to validate
 * @returns True if valid
 *
 * @example
 * isValidFieldType('text')     // true
 * isValidFieldType('string')   // false (OpenAPI type, not unified)
 */
export function isValidFieldType(type: string): type is UnifiedFieldType {
  return (UNIFIED_FIELD_TYPES as readonly string[]).includes(type)
}

/**
 * Create a minimal field schema with defaults
 *
 * @param name - Field name
 * @param type - Field type
 * @param overrides - Additional field properties
 * @returns Complete field schema
 *
 * @example
 * const field = createFieldSchema('email', 'email', { required: true })
 * // { name: 'email', type: 'email', required: true }
 */
export function createFieldSchema(
  name: string,
  type: UnifiedFieldType,
  overrides: Partial<UnifiedFieldSchema> = {}
): UnifiedFieldSchema {
  return {
    name,
    type,
    ...overrides,
  }
}

/**
 * Create a minimal entity schema with defaults
 *
 * @param name - Entity name
 * @param endpoint - API endpoint
 * @param fields - Field definitions
 * @param overrides - Additional entity properties
 * @returns Complete entity schema
 *
 * @example
 * const schema = createEntitySchema('users', '/api/users', {
 *   id: createFieldSchema('id', 'number', { readOnly: true }),
 *   name: createFieldSchema('name', 'text', { required: true })
 * })
 */
export function createEntitySchema(
  name: string,
  endpoint: string,
  fields: Record<string, UnifiedFieldSchema>,
  overrides: Partial<UnifiedEntitySchema> = {}
): UnifiedEntitySchema {
  return {
    name,
    endpoint,
    fields,
    ...overrides,
  }
}
