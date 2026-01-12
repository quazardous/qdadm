/**
 * Manual Connector
 *
 * Parses inline entity/field definitions into UnifiedEntitySchema format.
 * Used when schemas are defined directly in configuration rather than
 * extracted from OpenAPI specs or other sources.
 *
 * @module gen/connectors/ManualConnector
 */

import { BaseConnector, type ConnectorOptions, type ParseResult, type ParseWarning } from './BaseConnector'
import {
  UNIFIED_FIELD_TYPES,
  isValidFieldType,
  type UnifiedEntitySchema,
  type UnifiedFieldSchema,
  type UnifiedFieldReference,
  type UnifiedFieldType,
} from '../schema'

/**
 * Manual field definition input
 */
export interface ManualFieldInput {
  /** Field name (required) */
  name: string
  /** Field type (required, must be valid UnifiedFieldType) */
  type: string
  /** Human-readable label */
  label?: string
  /** Whether field is required */
  required?: boolean
  /** Whether field is read-only */
  readOnly?: boolean
  /** Whether field should be hidden in UI */
  hidden?: boolean
  /** Original format hint */
  format?: string
  /** Allowed values for enumeration */
  enum?: string[]
  /** Default value */
  default?: unknown
  /** Relation to another entity */
  reference?: UnifiedFieldReference
  /** Project-specific extensions */
  extensions?: Record<string, unknown>
}

/**
 * Manual entity definition input
 */
export interface ManualEntityInput {
  /** Entity name (required) */
  name: string
  /** API endpoint path (required) */
  endpoint: string
  /** Human-readable singular label */
  label?: string
  /** Human-readable plural label */
  labelPlural?: string
  /** Field used as display label */
  labelField?: string
  /** Route prefix for admin UI */
  routePrefix?: string
  /** Primary key field name */
  idField?: string
  /** Whether entity is read-only */
  readOnly?: boolean
  /** Field definitions */
  fields?: Record<string, ManualFieldInput>
  /** Project-specific extensions */
  extensions?: Record<string, unknown>
}

/**
 * Manual source input - array of entities or single entity
 */
export type ManualSourceInput =
  | ManualEntityInput[]
  | ManualEntityInput
  | { entities: ManualEntityInput[] }

/**
 * Manual Connector for parsing inline entity/field definitions.
 *
 * Accepts entity definitions in various formats:
 * - Single entity object
 * - Array of entity objects
 * - Object with `entities` array
 *
 * @extends BaseConnector
 *
 * @example
 * // Parse a single entity
 * const connector = new ManualConnector()
 * const schemas = connector.parse({
 *   name: 'users',
 *   endpoint: '/api/users',
 *   fields: {
 *     id: { name: 'id', type: 'number', readOnly: true },
 *     email: { name: 'email', type: 'email', required: true }
 *   }
 * })
 *
 * @example
 * // Parse multiple entities
 * const schemas = connector.parse([
 *   { name: 'users', endpoint: '/api/users', fields: { ... } },
 *   { name: 'posts', endpoint: '/api/posts', fields: { ... } }
 * ])
 *
 * @example
 * // Strict mode throws on validation errors
 * const connector = new ManualConnector({ strict: true })
 * connector.parse({ name: 'users' }) // throws: missing 'endpoint'
 */
export class ManualConnector extends BaseConnector {
  constructor(options: ConnectorOptions = {}) {
    super(options)
  }

  /**
   * Parse manual entity definitions into UnifiedEntitySchema format
   *
   * @param source - Manual entity definitions
   * @returns Parsed entity schemas
   * @throws If validation fails (always in strict mode, on critical errors otherwise)
   */
  parse(source: ManualSourceInput): UnifiedEntitySchema[] {
    const entities = this._normalizeSource(source)
    const results: UnifiedEntitySchema[] = []

    for (const entity of entities) {
      const validated = this._validateEntity(entity)
      if (validated) {
        results.push(this._transformEntity(validated))
      }
    }

    return results
  }

  /**
   * Parse with detailed result including warnings
   *
   * @param source - Manual entity definitions
   * @returns Schemas and warnings
   */
  parseWithWarnings(source: ManualSourceInput): ParseResult {
    const warnings: ParseWarning[] = []
    const entities = this._normalizeSource(source)
    const results: UnifiedEntitySchema[] = []

    for (const entity of entities) {
      const entityWarnings = this._collectWarnings(entity)
      warnings.push(...entityWarnings)

      const validated = this._validateEntity(entity)
      if (validated) {
        results.push(this._transformEntity(validated))
      }
    }

    return { schemas: results, warnings }
  }

  /**
   * Normalize various source formats into entity array
   *
   * @private
   * @param source - Source in any supported format
   * @returns Normalized entity array
   */
  private _normalizeSource(source: ManualSourceInput): ManualEntityInput[] {
    if (!source) {
      return []
    }

    // Array of entities
    if (Array.isArray(source)) {
      return source
    }

    // Object with entities array
    if ('entities' in source && Array.isArray(source.entities)) {
      return source.entities
    }

    // Single entity object (may be missing name - validation will catch it)
    if (typeof source === 'object') {
      return [source as ManualEntityInput]
    }

    return []
  }

  /**
   * Validate entity definition
   *
   * @private
   * @param entity - Entity to validate
   * @returns Validated entity or null if invalid
   * @throws In strict mode, throws on validation error
   */
  private _validateEntity(entity: ManualEntityInput): ManualEntityInput | null {
    const entityName = entity.name || '(unnamed)'

    // Validate entity.name
    if (!entity.name || typeof entity.name !== 'string' || entity.name.trim() === '') {
      const message = `ManualConnector: entity ${entityName} missing required field 'name'`
      if (this.strict) {
        throw new Error(message)
      }
      return null
    }

    // Validate entity.endpoint
    if (!entity.endpoint || typeof entity.endpoint !== 'string' || entity.endpoint.trim() === '') {
      const message = `ManualConnector: entity '${entity.name}' missing required field 'endpoint'`
      if (this.strict) {
        throw new Error(message)
      }
      return null
    }

    // Validate fields if present
    if (entity.fields) {
      for (const [fieldKey, field] of Object.entries(entity.fields)) {
        if (!this._validateField(entity.name, fieldKey, field)) {
          if (this.strict) {
            // Error already thrown in strict mode by _validateField
            return null
          }
          // In non-strict mode, skip invalid fields by not adding them
        }
      }
    }

    return entity
  }

  /**
   * Validate field definition
   *
   * @private
   * @param entityName - Parent entity name for error context
   * @param fieldKey - Field key in fields object
   * @param field - Field to validate
   * @returns True if valid
   * @throws In strict mode, throws on validation error
   */
  private _validateField(entityName: string, fieldKey: string, field: ManualFieldInput): boolean {
    // Validate field.name
    if (!field.name || typeof field.name !== 'string' || field.name.trim() === '') {
      const message = `ManualConnector: entity '${entityName}' field '${fieldKey}' missing required property 'name'`
      if (this.strict) {
        throw new Error(message)
      }
      return false
    }

    // Validate field.type exists
    if (!field.type || typeof field.type !== 'string' || field.type.trim() === '') {
      const message = `ManualConnector: entity '${entityName}' field '${field.name}' missing required property 'type'`
      if (this.strict) {
        throw new Error(message)
      }
      return false
    }

    // Validate field.type is valid UnifiedFieldType
    if (!isValidFieldType(field.type)) {
      const validTypes = UNIFIED_FIELD_TYPES.join(', ')
      const message = `ManualConnector: entity '${entityName}' field '${field.name}' has invalid type '${field.type}'. Valid types: ${validTypes}`
      if (this.strict) {
        throw new Error(message)
      }
      return false
    }

    return true
  }

  /**
   * Collect warnings for an entity without throwing
   *
   * @private
   * @param entity - Entity to check
   * @returns Collected warnings
   */
  private _collectWarnings(entity: ManualEntityInput): ParseWarning[] {
    const warnings: ParseWarning[] = []
    const entityName = entity.name || '(unnamed)'

    if (!entity.name || typeof entity.name !== 'string' || entity.name.trim() === '') {
      warnings.push({
        path: entityName,
        message: "Entity missing required field 'name'",
        code: 'MISSING_ENTITY_NAME',
      })
      return warnings // Can't validate further without name
    }

    if (!entity.endpoint || typeof entity.endpoint !== 'string' || entity.endpoint.trim() === '') {
      warnings.push({
        path: entity.name,
        message: "Entity missing required field 'endpoint'",
        code: 'MISSING_ENTITY_ENDPOINT',
      })
    }

    if (entity.fields) {
      for (const [fieldKey, field] of Object.entries(entity.fields)) {
        if (!field.name || typeof field.name !== 'string' || field.name.trim() === '') {
          warnings.push({
            path: `${entity.name}.fields.${fieldKey}`,
            message: "Field missing required property 'name'",
            code: 'MISSING_FIELD_NAME',
          })
          continue
        }

        if (!field.type || typeof field.type !== 'string' || field.type.trim() === '') {
          warnings.push({
            path: `${entity.name}.fields.${field.name}`,
            message: "Field missing required property 'type'",
            code: 'MISSING_FIELD_TYPE',
          })
        } else if (!isValidFieldType(field.type)) {
          warnings.push({
            path: `${entity.name}.fields.${field.name}`,
            message: `Invalid field type '${field.type}'`,
            code: 'INVALID_FIELD_TYPE',
          })
        }
      }
    }

    return warnings
  }

  /**
   * Transform validated entity input into UnifiedEntitySchema
   *
   * @private
   * @param entity - Validated entity input
   * @returns Transformed entity schema
   */
  private _transformEntity(entity: ManualEntityInput): UnifiedEntitySchema {
    const transformedFields: Record<string, UnifiedFieldSchema> = {}

    if (entity.fields) {
      for (const [fieldKey, field] of Object.entries(entity.fields)) {
        // Skip invalid fields in non-strict mode
        if (!this._validateField(entity.name, fieldKey, field)) {
          continue
        }
        transformedFields[fieldKey] = this._transformField(field)
      }
    }

    const schema: UnifiedEntitySchema = {
      name: entity.name,
      endpoint: entity.endpoint,
      fields: transformedFields,
    }

    // Add optional properties if provided
    if (entity.label !== undefined) schema.label = entity.label
    if (entity.labelPlural !== undefined) schema.labelPlural = entity.labelPlural
    if (entity.labelField !== undefined) schema.labelField = entity.labelField
    if (entity.routePrefix !== undefined) schema.routePrefix = entity.routePrefix
    if (entity.idField !== undefined) schema.idField = entity.idField
    if (entity.readOnly !== undefined) schema.readOnly = entity.readOnly

    // Merge extensions from connector options and entity
    if (this.extensions && Object.keys(this.extensions).length > 0) {
      schema.extensions = { ...this.extensions, ...entity.extensions }
    } else if (entity.extensions) {
      schema.extensions = entity.extensions
    }

    return schema
  }

  /**
   * Transform field input into UnifiedFieldSchema
   *
   * @private
   * @param field - Field input
   * @returns Transformed field schema
   */
  private _transformField(field: ManualFieldInput): UnifiedFieldSchema {
    const schema: UnifiedFieldSchema = {
      name: field.name,
      type: field.type as UnifiedFieldType,
    }

    // Add optional properties if provided
    if (field.label !== undefined) schema.label = field.label
    if (field.required !== undefined) schema.required = field.required
    if (field.readOnly !== undefined) schema.readOnly = field.readOnly
    if (field.hidden !== undefined) schema.hidden = field.hidden
    if (field.format !== undefined) schema.format = field.format
    if (field.enum !== undefined) schema.enum = field.enum
    if (field.default !== undefined) schema.default = field.default
    if (field.reference !== undefined) schema.reference = field.reference
    if (field.extensions !== undefined) schema.extensions = field.extensions

    return schema
  }
}

export default ManualConnector
