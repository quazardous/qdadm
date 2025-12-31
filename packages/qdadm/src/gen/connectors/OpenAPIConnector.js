/**
 * OpenAPI Connector
 *
 * Parses OpenAPI 3.x specifications into UnifiedEntitySchema format.
 * Configurable path patterns, data wrapper, and operation filtering.
 *
 * @module gen/connectors/OpenAPIConnector
 */

import { BaseConnector } from './BaseConnector.js'
import { getDefaultType } from '../FieldMapper.js'

/**
 * Default path patterns for entity extraction
 * Matches common REST patterns: /api/entities and /api/entities/{id}
 *
 * @type {RegExp[]}
 */
const DEFAULT_PATH_PATTERNS = [
  /^\/api\/([a-z-]+)\/?$/,           // /api/users/ or /api/users
  /^\/api\/([a-z-]+)\/\{[^}]+\}$/    // /api/users/{id}
]

/**
 * HTTP methods that indicate CRUD operations
 *
 * @type {Readonly<Record<string, string>>}
 */
const CRUD_METHODS = Object.freeze({
  get: 'read',
  post: 'create',
  put: 'update',
  patch: 'update',
  delete: 'delete'
})

/**
 * OpenAPI Connector options
 *
 * @typedef {import('./BaseConnector.js').ConnectorOptions & OpenAPIConnectorOptions} OpenAPIConnectorFullOptions
 */

/**
 * @typedef {object} OpenAPIConnectorOptions
 * @property {RegExp[]} [pathPatterns] - Path patterns to match entities (default: DEFAULT_PATH_PATTERNS)
 * @property {string} [dataWrapper] - Property name wrapping response data (default: 'data')
 * @property {OperationFilter} [operationFilter] - Filter function for operations
 * @property {import('../FieldMapper.js').CustomMappings} [customMappings] - Custom type mappings for FieldMapper
 */

/**
 * Filter function for OpenAPI operations
 *
 * @callback OperationFilter
 * @param {string} path - API path
 * @param {string} method - HTTP method (lowercase)
 * @param {object} operation - OpenAPI operation object
 * @returns {boolean} - True to include, false to skip
 */

/**
 * OpenAPI Connector for parsing OpenAPI 3.x specs into UnifiedEntitySchema.
 *
 * @extends BaseConnector
 *
 * @example
 * // Basic usage with defaults
 * const connector = new OpenAPIConnector()
 * const schemas = connector.parse(openapiSpec)
 *
 * @example
 * // Custom path patterns for versioned API
 * const connector = new OpenAPIConnector({
 *   pathPatterns: [
 *     /^\/api\/v1\/([a-z-]+)\/?$/,
 *     /^\/api\/v1\/([a-z-]+)\/\{[^}]+\}$/
 *   ]
 * })
 *
 * @example
 * // Filter to only public operations
 * const connector = new OpenAPIConnector({
 *   operationFilter: (path, method, op) => !op.tags?.includes('internal')
 * })
 */
export class OpenAPIConnector extends BaseConnector {
  /**
   * Create a new OpenAPI connector
   *
   * @param {OpenAPIConnectorFullOptions} [options={}] - Connector options
   */
  constructor(options = {}) {
    super(options)

    /** @type {RegExp[]} */
    this.pathPatterns = options.pathPatterns || DEFAULT_PATH_PATTERNS

    /** @type {string} */
    this.dataWrapper = options.dataWrapper ?? 'data'

    /** @type {OperationFilter|null} */
    this.operationFilter = options.operationFilter || null

    /** @type {import('../FieldMapper.js').CustomMappings} */
    this.customMappings = options.customMappings || {}
  }

  /**
   * Parse OpenAPI spec into UnifiedEntitySchema array
   *
   * @param {object} source - OpenAPI 3.x specification object
   * @returns {import('../schema.js').UnifiedEntitySchema[]} - Parsed entity schemas
   * @throws {Error} - If source is invalid or parsing fails in strict mode
   *
   * @example
   * const schemas = connector.parse({
   *   openapi: '3.0.0',
   *   paths: { '/api/users': { get: { ... } } }
   * })
   */
  parse(source) {
    this._validateSource(source)
    const entities = this._extractEntities(source)
    return Array.from(entities.values())
  }

  /**
   * Parse with warnings for detailed feedback
   *
   * @param {object} source - OpenAPI 3.x specification object
   * @returns {import('./BaseConnector.js').ParseResult} - Schemas and warnings
   */
  parseWithWarnings(source) {
    /** @type {import('./BaseConnector.js').ParseWarning[]} */
    const warnings = []

    this._validateSource(source)
    const entities = this._extractEntities(source, warnings)

    return {
      schemas: Array.from(entities.values()),
      warnings
    }
  }

  /**
   * Validate OpenAPI source object
   *
   * @private
   * @param {object} source - Source to validate
   * @throws {Error} - If source is invalid
   */
  _validateSource(source) {
    if (!source || typeof source !== 'object') {
      throw new Error(`${this.name}: source must be an object`)
    }
    if (!source.paths || typeof source.paths !== 'object') {
      throw new Error(`${this.name}: source must have paths object`)
    }
  }

  /**
   * Extract all entities from OpenAPI spec
   *
   * @private
   * @param {object} source - OpenAPI spec
   * @param {import('./BaseConnector.js').ParseWarning[]} [warnings=[]] - Warning collector
   * @returns {Map<string, import('../schema.js').UnifiedEntitySchema>} - Entity map
   */
  _extractEntities(source, warnings = []) {
    /** @type {Map<string, EntityWorkingData>} */
    const entityData = new Map()

    for (const [path, pathItem] of Object.entries(source.paths)) {
      const entityName = this._extractEntityName(path)
      if (!entityName) continue

      if (!entityData.has(entityName)) {
        entityData.set(entityName, {
          name: entityName,
          endpoint: this._buildEndpoint(path),
          rawSchema: null,
          fields: new Map()
        })
      }

      const data = entityData.get(entityName)
      this._processPath(source, path, pathItem, data, warnings)
    }

    // Convert working data to UnifiedEntitySchema
    return this._convertToSchemas(entityData)
  }

  /**
   * Extract entity name from path using configured patterns
   *
   * @private
   * @param {string} path - API path
   * @returns {string|null} - Entity name or null
   */
  _extractEntityName(path) {
    for (const pattern of this.pathPatterns) {
      const match = path.match(pattern)
      if (match) {
        return match[1]
      }
    }
    return null
  }

  /**
   * Build endpoint from path (use collection path, not item path)
   *
   * @private
   * @param {string} path - API path
   * @returns {string} - Collection endpoint
   */
  _buildEndpoint(path) {
    // Remove path parameter suffix to get collection endpoint
    return path.replace(/\/\{[^}]+\}$/, '')
  }

  /**
   * Process a path and extract schema info
   *
   * @private
   * @param {object} spec - Full OpenAPI spec (for $ref resolution)
   * @param {string} path - API path
   * @param {object} pathItem - OpenAPI path item
   * @param {EntityWorkingData} entity - Working entity data
   * @param {import('./BaseConnector.js').ParseWarning[]} warnings - Warning collector
   */
  _processPath(spec, path, pathItem, entity, warnings) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!CRUD_METHODS[method]) continue
      if (typeof operation !== 'object') continue

      // Apply operation filter
      if (this.operationFilter && !this.operationFilter(path, method, operation)) {
        continue
      }

      const isList = this._isListOperation(path, method, operation, spec)

      // Extract response schema
      const responseSchema = this._extractResponseSchema(operation, spec)
      if (responseSchema) {
        const itemSchema = isList
          ? this._extractArrayItemSchema(responseSchema, spec)
          : responseSchema

        if (itemSchema) {
          entity.rawSchema = this._mergeSchemas(entity.rawSchema, itemSchema)
          this._extractFields(itemSchema, entity.fields, spec, warnings, path)
        }
      }

      // Extract request body schema
      if (operation.requestBody) {
        const requestSchema = this._extractRequestSchema(operation, spec)
        if (requestSchema) {
          this._extractFields(requestSchema, entity.fields, spec, warnings, path)
        }
      }
    }
  }

  /**
   * Check if operation returns a list
   *
   * @private
   * @param {string} path - API path
   * @param {string} method - HTTP method
   * @param {object} operation - OpenAPI operation
   * @param {object} spec - Full spec for ref resolution
   * @returns {boolean} - True if list operation
   */
  _isListOperation(path, method, operation, spec) {
    // GET on collection path (no path parameter) is typically list
    if (method === 'get' && !path.includes('{')) {
      return true
    }

    // Check if response schema is array
    const schema = this._extractResponseSchema(operation, spec)
    if (schema?.type === 'array') {
      return true
    }

    // Check for pagination indicators in full response
    const fullSchema = this._extractFullResponseSchema(operation, spec)
    if (fullSchema?.properties?.pagination || fullSchema?.properties?.meta) {
      return true
    }

    return false
  }

  /**
   * Extract response schema (unwrap from data wrapper)
   *
   * @private
   * @param {object} operation - OpenAPI operation
   * @param {object} spec - Full spec for ref resolution
   * @returns {object|null} - Extracted schema
   */
  _extractResponseSchema(operation, spec) {
    const fullSchema = this._extractFullResponseSchema(operation, spec)
    if (!fullSchema) return null

    // Unwrap from configured data wrapper
    if (this.dataWrapper && fullSchema.properties?.[this.dataWrapper]) {
      const wrapped = fullSchema.properties[this.dataWrapper]
      return wrapped.$ref ? this._resolveRef(wrapped.$ref, spec) : wrapped
    }

    return fullSchema
  }

  /**
   * Extract full response schema without unwrapping
   *
   * @private
   * @param {object} operation - OpenAPI operation
   * @param {object} spec - Full spec for ref resolution
   * @returns {object|null} - Full response schema
   */
  _extractFullResponseSchema(operation, spec) {
    const response = operation.responses?.['200'] || operation.responses?.['201']
    if (!response) return null

    const content = response.content?.['application/json']
    if (!content) return null

    if (content.schema?.$ref) {
      return this._resolveRef(content.schema.$ref, spec)
    }

    return content.schema || null
  }

  /**
   * Extract request body schema
   *
   * @private
   * @param {object} operation - OpenAPI operation
   * @param {object} spec - Full spec for ref resolution
   * @returns {object|null} - Request schema
   */
  _extractRequestSchema(operation, spec) {
    const content = operation.requestBody?.content?.['application/json']
    if (!content) return null

    if (content.schema?.$ref) {
      return this._resolveRef(content.schema.$ref, spec)
    }

    return content.schema || null
  }

  /**
   * Resolve a $ref to its schema
   *
   * @private
   * @param {string} ref - Reference string (e.g., '#/components/schemas/User')
   * @param {object} spec - Full spec
   * @returns {object|null} - Resolved schema
   */
  _resolveRef(ref, spec) {
    if (!ref.startsWith('#/')) return null

    const parts = ref.slice(2).split('/')
    let current = spec

    for (const part of parts) {
      if (!current || typeof current !== 'object') return null
      current = current[part]
    }

    return current || null
  }

  /**
   * Extract item schema from array schema
   *
   * @private
   * @param {object} schema - Array schema
   * @param {object} spec - Full spec for ref resolution
   * @returns {object|null} - Item schema
   */
  _extractArrayItemSchema(schema, spec) {
    if (schema.type === 'array' && schema.items) {
      if (schema.items.$ref) {
        return this._resolveRef(schema.items.$ref, spec)
      }
      return schema.items
    }
    return schema
  }

  /**
   * Extract fields from JSON Schema and add to field map
   *
   * @private
   * @param {object} schema - JSON Schema object
   * @param {Map<string, import('../schema.js').UnifiedFieldSchema>} fields - Field map to populate
   * @param {object} spec - Full spec for ref resolution
   * @param {import('./BaseConnector.js').ParseWarning[]} warnings - Warning collector
   * @param {string} sourcePath - Source path for warnings
   * @param {string} [prefix=''] - Prefix for nested field names
   */
  _extractFields(schema, fields, spec, warnings, sourcePath, prefix = '') {
    if (!schema || !schema.properties) {
      return
    }

    const required = new Set(schema.required || [])

    for (const [name, propSchema] of Object.entries(schema.properties)) {
      const fieldName = prefix ? `${prefix}.${name}` : name

      // Resolve $ref in property schema
      const resolvedSchema = propSchema.$ref
        ? this._resolveRef(propSchema.$ref, spec)
        : propSchema

      if (!resolvedSchema) {
        warnings.push({
          path: `${sourcePath}#${fieldName}`,
          message: `Could not resolve schema for field: ${fieldName}`,
          code: 'UNRESOLVED_REF'
        })
        continue
      }

      // Use FieldMapper for type conversion
      const type = getDefaultType(resolvedSchema, this.customMappings)

      /** @type {import('../schema.js').UnifiedFieldSchema} */
      const field = {
        name: fieldName,
        type,
        required: required.has(name),
        readOnly: resolvedSchema.readOnly || false
      }

      // Add optional properties
      if (resolvedSchema.description) {
        field.label = resolvedSchema.description
      }
      if (resolvedSchema.format) {
        field.format = resolvedSchema.format
      }
      if (resolvedSchema.enum) {
        field.enum = resolvedSchema.enum
      }
      if (resolvedSchema.default !== undefined) {
        field.default = resolvedSchema.default
      }

      // Merge with existing field (may have more info from other operations)
      if (fields.has(fieldName)) {
        const existing = fields.get(fieldName)
        this._mergeField(existing, field)
      } else {
        fields.set(fieldName, field)
      }

      // Handle nested objects (one level only to avoid complexity)
      if (resolvedSchema.type === 'object' && resolvedSchema.properties && !prefix) {
        this._extractFields(resolvedSchema, fields, spec, warnings, sourcePath, fieldName)
      }
    }
  }

  /**
   * Merge field info from secondary source into primary
   *
   * @private
   * @param {import('../schema.js').UnifiedFieldSchema} primary - Primary field to merge into
   * @param {import('../schema.js').UnifiedFieldSchema} secondary - Secondary field with additional info
   */
  _mergeField(primary, secondary) {
    if (!primary.label && secondary.label) {
      primary.label = secondary.label
    }
    if (!primary.enum && secondary.enum) {
      primary.enum = secondary.enum
    }
    if (!primary.required && secondary.required) {
      primary.required = true
    }
    if (primary.default === undefined && secondary.default !== undefined) {
      primary.default = secondary.default
    }
  }

  /**
   * Merge two JSON Schemas
   *
   * @private
   * @param {object|null} base - Base schema
   * @param {object} other - Schema to merge
   * @returns {object} - Merged schema
   */
  _mergeSchemas(base, other) {
    if (!base) return other
    if (!other) return base

    const merged = { ...base }

    if (other.properties) {
      merged.properties = {
        ...(base.properties || {}),
        ...other.properties
      }
    }

    if (other.required) {
      merged.required = [...new Set([...(base.required || []), ...other.required])]
    }

    return merged
  }

  /**
   * Convert working entity data to UnifiedEntitySchema
   *
   * @private
   * @param {Map<string, EntityWorkingData>} entityData - Working data
   * @returns {Map<string, import('../schema.js').UnifiedEntitySchema>} - Final schemas
   */
  _convertToSchemas(entityData) {
    /** @type {Map<string, import('../schema.js').UnifiedEntitySchema>} */
    const schemas = new Map()

    for (const [name, data] of entityData) {
      /** @type {import('../schema.js').UnifiedEntitySchema} */
      const schema = {
        name: data.name,
        endpoint: data.endpoint,
        fields: Object.fromEntries(data.fields)
      }

      // Add extensions if configured
      if (Object.keys(this.extensions).length > 0) {
        schema.extensions = { ...this.extensions }
      }

      schemas.set(name, schema)
    }

    return schemas
  }
}

/**
 * Working data structure for entity extraction
 *
 * @typedef {object} EntityWorkingData
 * @property {string} name - Entity name
 * @property {string} endpoint - Collection endpoint
 * @property {object|null} rawSchema - Merged raw JSON Schema
 * @property {Map<string, import('../schema.js').UnifiedFieldSchema>} fields - Extracted fields
 */

export default OpenAPIConnector
