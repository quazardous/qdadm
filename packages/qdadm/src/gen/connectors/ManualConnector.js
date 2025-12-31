/**
 * Manual Connector
 *
 * Parses inline entity/field definitions into UnifiedEntitySchema format.
 * Used when schemas are defined directly in configuration rather than
 * extracted from OpenAPI specs or other sources.
 *
 * @module gen/connectors/ManualConnector
 */

import { BaseConnector } from './BaseConnector.js'
import { UNIFIED_FIELD_TYPES, isValidFieldType } from '../schema.js'

/**
 * Manual entity definition input
 *
 * @typedef {object} ManualEntityInput
 * @property {string} name - Entity name (required)
 * @property {string} endpoint - API endpoint path (required)
 * @property {string} [label] - Human-readable singular label
 * @property {string} [labelPlural] - Human-readable plural label
 * @property {string} [labelField] - Field used as display label
 * @property {string} [routePrefix] - Route prefix for admin UI
 * @property {string} [idField] - Primary key field name
 * @property {boolean} [readOnly] - Whether entity is read-only
 * @property {Record<string, ManualFieldInput>} [fields] - Field definitions
 * @property {Record<string, *>} [extensions] - Project-specific extensions
 */

/**
 * Manual field definition input
 *
 * @typedef {object} ManualFieldInput
 * @property {string} name - Field name (required)
 * @property {string} type - Field type (required, must be valid UnifiedFieldType)
 * @property {string} [label] - Human-readable label
 * @property {boolean} [required] - Whether field is required
 * @property {boolean} [readOnly] - Whether field is read-only
 * @property {boolean} [hidden] - Whether field should be hidden in UI
 * @property {string} [format] - Original format hint
 * @property {string[]} [enum] - Allowed values for enumeration
 * @property {*} [default] - Default value
 * @property {import('../schema.js').UnifiedFieldReference} [reference] - Relation to another entity
 * @property {Record<string, *>} [extensions] - Project-specific extensions
 */

/**
 * Manual source input - array of entities or single entity
 *
 * @typedef {ManualEntityInput[] | ManualEntityInput | { entities: ManualEntityInput[] }} ManualSourceInput
 */

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
  /**
   * Parse manual entity definitions into UnifiedEntitySchema format
   *
   * @param {ManualSourceInput} source - Manual entity definitions
   * @returns {import('../schema.js').UnifiedEntitySchema[]} - Parsed entity schemas
   * @throws {Error} - If validation fails (always in strict mode, on critical errors otherwise)
   */
  parse(source) {
    const entities = this._normalizeSource(source)
    const results = []

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
   * @param {ManualSourceInput} source - Manual entity definitions
   * @returns {import('./BaseConnector.js').ParseResult} - Schemas and warnings
   */
  parseWithWarnings(source) {
    /** @type {import('./BaseConnector.js').ParseWarning[]} */
    const warnings = []
    const entities = this._normalizeSource(source)
    const results = []

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
   * @param {ManualSourceInput} source - Source in any supported format
   * @returns {ManualEntityInput[]} - Normalized entity array
   */
  _normalizeSource(source) {
    if (!source) {
      return []
    }

    // Array of entities
    if (Array.isArray(source)) {
      return source
    }

    // Object with entities array
    if (source.entities && Array.isArray(source.entities)) {
      return source.entities
    }

    // Single entity object (may be missing name - validation will catch it)
    if (typeof source === 'object') {
      return [source]
    }

    return []
  }

  /**
   * Validate entity definition
   *
   * @private
   * @param {ManualEntityInput} entity - Entity to validate
   * @returns {ManualEntityInput | null} - Validated entity or null if invalid
   * @throws {Error} - In strict mode, throws on validation error
   */
  _validateEntity(entity) {
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
   * @param {string} entityName - Parent entity name for error context
   * @param {string} fieldKey - Field key in fields object
   * @param {ManualFieldInput} field - Field to validate
   * @returns {boolean} - True if valid
   * @throws {Error} - In strict mode, throws on validation error
   */
  _validateField(entityName, fieldKey, field) {
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
   * @param {ManualEntityInput} entity - Entity to check
   * @returns {import('./BaseConnector.js').ParseWarning[]} - Collected warnings
   */
  _collectWarnings(entity) {
    /** @type {import('./BaseConnector.js').ParseWarning[]} */
    const warnings = []
    const entityName = entity.name || '(unnamed)'

    if (!entity.name || typeof entity.name !== 'string' || entity.name.trim() === '') {
      warnings.push({
        path: entityName,
        message: "Entity missing required field 'name'",
        code: 'MISSING_ENTITY_NAME'
      })
      return warnings // Can't validate further without name
    }

    if (!entity.endpoint || typeof entity.endpoint !== 'string' || entity.endpoint.trim() === '') {
      warnings.push({
        path: entity.name,
        message: "Entity missing required field 'endpoint'",
        code: 'MISSING_ENTITY_ENDPOINT'
      })
    }

    if (entity.fields) {
      for (const [fieldKey, field] of Object.entries(entity.fields)) {
        if (!field.name || typeof field.name !== 'string' || field.name.trim() === '') {
          warnings.push({
            path: `${entity.name}.fields.${fieldKey}`,
            message: "Field missing required property 'name'",
            code: 'MISSING_FIELD_NAME'
          })
          continue
        }

        if (!field.type || typeof field.type !== 'string' || field.type.trim() === '') {
          warnings.push({
            path: `${entity.name}.fields.${field.name}`,
            message: "Field missing required property 'type'",
            code: 'MISSING_FIELD_TYPE'
          })
        } else if (!isValidFieldType(field.type)) {
          warnings.push({
            path: `${entity.name}.fields.${field.name}`,
            message: `Invalid field type '${field.type}'`,
            code: 'INVALID_FIELD_TYPE'
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
   * @param {ManualEntityInput} entity - Validated entity input
   * @returns {import('../schema.js').UnifiedEntitySchema} - Transformed entity schema
   */
  _transformEntity(entity) {
    /** @type {Record<string, import('../schema.js').UnifiedFieldSchema>} */
    const transformedFields = {}

    if (entity.fields) {
      for (const [fieldKey, field] of Object.entries(entity.fields)) {
        // Skip invalid fields in non-strict mode
        if (!this._validateField(entity.name, fieldKey, field)) {
          continue
        }
        transformedFields[fieldKey] = this._transformField(field)
      }
    }

    /** @type {import('../schema.js').UnifiedEntitySchema} */
    const schema = {
      name: entity.name,
      endpoint: entity.endpoint,
      fields: transformedFields
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
   * @param {ManualFieldInput} field - Field input
   * @returns {import('../schema.js').UnifiedFieldSchema} - Transformed field schema
   */
  _transformField(field) {
    /** @type {import('../schema.js').UnifiedFieldSchema} */
    const schema = {
      name: field.name,
      type: /** @type {import('../schema.js').UnifiedFieldType} */ (field.type)
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
