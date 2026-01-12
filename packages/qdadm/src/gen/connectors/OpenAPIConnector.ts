/**
 * OpenAPI Connector
 *
 * Parses OpenAPI 3.x specifications into UnifiedEntitySchema format.
 * Configurable path patterns, data wrapper, and operation filtering.
 *
 * @module gen/connectors/OpenAPIConnector
 */

import { BaseConnector, type ConnectorOptions, type ParseResult, type ParseWarning } from './BaseConnector'
import { getDefaultType, type CustomMappings } from '../FieldMapper'
import type { UnifiedEntitySchema, UnifiedFieldSchema, UnifiedFieldType } from '../schema'

/**
 * Default path patterns for entity extraction
 * Matches common REST patterns: /api/entities and /api/entities/{id}
 */
const DEFAULT_PATH_PATTERNS: RegExp[] = [
  /^\/api\/([a-z-]+)\/?$/, // /api/users/ or /api/users
  /^\/api\/([a-z-]+)\/\{[^}]+\}$/, // /api/users/{id}
]

/**
 * HTTP methods that indicate CRUD operations
 */
const CRUD_METHODS: Readonly<Record<string, string>> = Object.freeze({
  get: 'read',
  post: 'create',
  put: 'update',
  patch: 'update',
  delete: 'delete',
})

/**
 * Filter function for OpenAPI operations
 */
export type OperationFilter = (path: string, method: string, operation: OpenAPIOperation) => boolean

/**
 * OpenAPI Connector specific options
 */
export interface OpenAPIConnectorOptions extends ConnectorOptions {
  /** Path patterns to match entities (default: DEFAULT_PATH_PATTERNS) */
  pathPatterns?: RegExp[]
  /** Property name wrapping response data (default: 'data') */
  dataWrapper?: string
  /** Filter function for operations */
  operationFilter?: OperationFilter | null
  /** Custom type mappings for FieldMapper */
  customMappings?: CustomMappings
}

/**
 * Working data structure for entity extraction
 */
interface EntityWorkingData {
  /** Entity name */
  name: string
  /** Collection endpoint */
  endpoint: string
  /** Detected ID field from path parameter */
  idField: string | null
  /** Merged raw JSON Schema */
  rawSchema: OpenAPISchema | null
  /** Extracted fields */
  fields: Map<string, UnifiedFieldSchema>
}

/**
 * OpenAPI schema type
 */
interface OpenAPISchema {
  type?: string
  format?: string
  properties?: Record<string, OpenAPISchema>
  items?: OpenAPISchema
  required?: string[]
  $ref?: string
  description?: string
  enum?: string[]
  default?: unknown
  readOnly?: boolean
  [key: string]: unknown
}

/**
 * OpenAPI operation type
 */
interface OpenAPIOperation {
  responses?: Record<
    string,
    {
      content?: Record<
        string,
        {
          schema?: OpenAPISchema
        }
      >
    }
  >
  requestBody?: {
    content?: Record<
      string,
      {
        schema?: OpenAPISchema
      }
    >
  }
  tags?: string[]
  [key: string]: unknown
}

/**
 * OpenAPI path item type
 */
interface OpenAPIPathItem {
  get?: OpenAPIOperation
  post?: OpenAPIOperation
  put?: OpenAPIOperation
  patch?: OpenAPIOperation
  delete?: OpenAPIOperation
  [key: string]: unknown
}

/**
 * OpenAPI specification type
 */
interface OpenAPISpec {
  openapi?: string
  paths: Record<string, OpenAPIPathItem>
  components?: {
    schemas?: Record<string, OpenAPISchema>
    [key: string]: unknown
  }
  [key: string]: unknown
}

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
  /** Path patterns to match entities */
  pathPatterns: RegExp[]

  /** Property name wrapping response data */
  dataWrapper: string

  /** Filter function for operations */
  operationFilter: OperationFilter | null

  /** Custom type mappings */
  customMappings: CustomMappings

  /**
   * Create a new OpenAPI connector
   *
   * @param options - Connector options
   */
  constructor(options: OpenAPIConnectorOptions = {}) {
    super(options)

    this.pathPatterns = options.pathPatterns || DEFAULT_PATH_PATTERNS
    this.dataWrapper = options.dataWrapper ?? 'data'
    this.operationFilter = options.operationFilter || null
    this.customMappings = options.customMappings || {}
  }

  /**
   * Parse OpenAPI spec into UnifiedEntitySchema array
   *
   * @param source - OpenAPI 3.x specification object
   * @returns Parsed entity schemas
   * @throws If source is invalid or parsing fails in strict mode
   *
   * @example
   * const schemas = connector.parse({
   *   openapi: '3.0.0',
   *   paths: { '/api/users': { get: { ... } } }
   * })
   */
  parse(source: unknown): UnifiedEntitySchema[] {
    const spec = source as OpenAPISpec
    this._validateSource(spec)
    const entities = this._extractEntities(spec)
    return Array.from(entities.values())
  }

  /**
   * Parse with warnings for detailed feedback
   *
   * @param source - OpenAPI 3.x specification object
   * @returns Schemas and warnings
   */
  parseWithWarnings(source: unknown): ParseResult {
    const warnings: ParseWarning[] = []
    const spec = source as OpenAPISpec

    this._validateSource(spec)
    const entities = this._extractEntities(spec, warnings)

    return {
      schemas: Array.from(entities.values()),
      warnings,
    }
  }

  /**
   * Validate OpenAPI source object
   *
   * @private
   * @param source - Source to validate
   * @throws If source is invalid
   */
  private _validateSource(source: OpenAPISpec): void {
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
   * @param source - OpenAPI spec
   * @param warnings - Warning collector
   * @returns Entity map
   */
  private _extractEntities(
    source: OpenAPISpec,
    warnings: ParseWarning[] = []
  ): Map<string, UnifiedEntitySchema> {
    const entityData: Map<string, EntityWorkingData> = new Map()

    for (const [path, pathItem] of Object.entries(source.paths)) {
      const entityName = this._extractEntityName(path)
      if (!entityName) continue

      if (!entityData.has(entityName)) {
        entityData.set(entityName, {
          name: entityName,
          endpoint: this._buildEndpoint(path),
          idField: null,
          rawSchema: null,
          fields: new Map(),
        })
      }

      // Detect idField from path parameter (e.g., /users/{uuid} → 'uuid')
      const data = entityData.get(entityName)!
      const detectedIdField = this._extractIdField(path)
      if (detectedIdField && !data.idField) {
        data.idField = detectedIdField
      }

      this._processPath(source, path, pathItem, data, warnings)
    }

    // Convert working data to UnifiedEntitySchema
    return this._convertToSchemas(entityData)
  }

  /**
   * Extract entity name from path using configured patterns
   *
   * @private
   * @param path - API path
   * @returns Entity name or null
   */
  private _extractEntityName(path: string): string | null {
    for (const pattern of this.pathPatterns) {
      const match = path.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }
    return null
  }

  /**
   * Build endpoint from path (use collection path, not item path)
   *
   * @private
   * @param path - API path
   * @returns Collection endpoint
   */
  private _buildEndpoint(path: string): string {
    // Remove path parameter suffix to get collection endpoint
    return path.replace(/\/\{[^}]+\}$/, '')
  }

  /**
   * Extract idField from path parameter (e.g., /users/{uuid} → 'uuid')
   *
   * @private
   * @param path - API path
   * @returns Parameter name or null
   */
  private _extractIdField(path: string): string | null {
    const match = path.match(/\/\{([^}]+)\}$/)
    return match?.[1] ?? null
  }

  /**
   * Process a path and extract schema info
   *
   * @private
   * @param spec - Full OpenAPI spec (for $ref resolution)
   * @param path - API path
   * @param pathItem - OpenAPI path item
   * @param entity - Working entity data
   * @param warnings - Warning collector
   */
  private _processPath(
    spec: OpenAPISpec,
    path: string,
    pathItem: OpenAPIPathItem,
    entity: EntityWorkingData,
    warnings: ParseWarning[]
  ): void {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!CRUD_METHODS[method]) continue
      if (typeof operation !== 'object') continue

      const op = operation as OpenAPIOperation

      // Apply operation filter
      if (this.operationFilter && !this.operationFilter(path, method, op)) {
        continue
      }

      const isList = this._isListOperation(path, method, op, spec)

      // Extract response schema
      const responseSchema = this._extractResponseSchema(op, spec)
      if (responseSchema) {
        const itemSchema = isList ? this._extractArrayItemSchema(responseSchema, spec) : responseSchema

        if (itemSchema) {
          entity.rawSchema = this._mergeSchemas(entity.rawSchema, itemSchema)
          this._extractFields(itemSchema, entity.fields, spec, warnings, path)
        }
      }

      // Extract request body schema
      if (op.requestBody) {
        const requestSchema = this._extractRequestSchema(op, spec)
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
   * @param path - API path
   * @param method - HTTP method
   * @param operation - OpenAPI operation
   * @param spec - Full spec for ref resolution
   * @returns True if list operation
   */
  private _isListOperation(
    path: string,
    method: string,
    operation: OpenAPIOperation,
    spec: OpenAPISpec
  ): boolean {
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
   * @param operation - OpenAPI operation
   * @param spec - Full spec for ref resolution
   * @returns Extracted schema
   */
  private _extractResponseSchema(
    operation: OpenAPIOperation,
    spec: OpenAPISpec
  ): OpenAPISchema | null {
    const fullSchema = this._extractFullResponseSchema(operation, spec)
    if (!fullSchema) return null

    // Unwrap from configured data wrapper
    if (this.dataWrapper) {
      const wrapped = fullSchema.properties?.[this.dataWrapper]
      if (wrapped) {
        return wrapped.$ref ? this._resolveRef(wrapped.$ref, spec) : wrapped
      }
    }

    return fullSchema
  }

  /**
   * Extract full response schema without unwrapping
   *
   * @private
   * @param operation - OpenAPI operation
   * @param spec - Full spec for ref resolution
   * @returns Full response schema
   */
  private _extractFullResponseSchema(
    operation: OpenAPIOperation,
    spec: OpenAPISpec
  ): OpenAPISchema | null {
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
   * @param operation - OpenAPI operation
   * @param spec - Full spec for ref resolution
   * @returns Request schema
   */
  private _extractRequestSchema(
    operation: OpenAPIOperation,
    spec: OpenAPISpec
  ): OpenAPISchema | null {
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
   * @param ref - Reference string (e.g., '#/components/schemas/User')
   * @param spec - Full spec
   * @returns Resolved schema
   */
  private _resolveRef(ref: string, spec: OpenAPISpec): OpenAPISchema | null {
    if (!ref.startsWith('#/')) return null

    const parts = ref.slice(2).split('/')
    let current: unknown = spec

    for (const part of parts) {
      if (!current || typeof current !== 'object') return null
      current = (current as Record<string, unknown>)[part]
    }

    return (current as OpenAPISchema) || null
  }

  /**
   * Extract item schema from array schema
   *
   * @private
   * @param schema - Array schema
   * @param spec - Full spec for ref resolution
   * @returns Item schema
   */
  private _extractArrayItemSchema(schema: OpenAPISchema, spec: OpenAPISpec): OpenAPISchema | null {
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
   * @param schema - JSON Schema object
   * @param fields - Field map to populate
   * @param spec - Full spec for ref resolution
   * @param warnings - Warning collector
   * @param sourcePath - Source path for warnings
   * @param prefix - Prefix for nested field names
   */
  private _extractFields(
    schema: OpenAPISchema,
    fields: Map<string, UnifiedFieldSchema>,
    spec: OpenAPISpec,
    warnings: ParseWarning[],
    sourcePath: string,
    prefix: string = ''
  ): void {
    if (!schema || !schema.properties) {
      return
    }

    const required = new Set(schema.required || [])

    for (const [name, propSchema] of Object.entries(schema.properties)) {
      const fieldName = prefix ? `${prefix}.${name}` : name

      // Resolve $ref in property schema
      const resolvedSchema = propSchema.$ref ? this._resolveRef(propSchema.$ref, spec) : propSchema

      if (!resolvedSchema) {
        warnings.push({
          path: `${sourcePath}#${fieldName}`,
          message: `Could not resolve schema for field: ${fieldName}`,
          code: 'UNRESOLVED_REF',
        })
        continue
      }

      // Use FieldMapper for type conversion
      const type = getDefaultType(resolvedSchema, this.customMappings)

      const field: UnifiedFieldSchema = {
        name: fieldName,
        type: type as UnifiedFieldType,
        required: required.has(name),
        readOnly: resolvedSchema.readOnly || false,
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
        const existing = fields.get(fieldName)!
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
   * @param primary - Primary field to merge into
   * @param secondary - Secondary field with additional info
   */
  private _mergeField(primary: UnifiedFieldSchema, secondary: UnifiedFieldSchema): void {
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
   * @param base - Base schema
   * @param other - Schema to merge
   * @returns Merged schema
   */
  private _mergeSchemas(base: OpenAPISchema | null, other: OpenAPISchema): OpenAPISchema {
    if (!base) return other
    if (!other) return base

    const merged: OpenAPISchema = { ...base }

    if (other.properties) {
      merged.properties = {
        ...(base.properties || {}),
        ...other.properties,
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
   * @param entityData - Working data
   * @returns Final schemas
   */
  private _convertToSchemas(
    entityData: Map<string, EntityWorkingData>
  ): Map<string, UnifiedEntitySchema> {
    const schemas: Map<string, UnifiedEntitySchema> = new Map()

    for (const [name, data] of entityData) {
      const schema: UnifiedEntitySchema = {
        name: data.name,
        endpoint: data.endpoint,
        fields: Object.fromEntries(data.fields),
      }

      // Add idField if detected from path parameter
      if (data.idField) {
        schema.idField = data.idField
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

export default OpenAPIConnector
