/**
 * Base Connector Interface
 *
 * Abstract base class for schema connectors. Connectors parse various sources
 * (OpenAPI specs, manual definitions, etc.) into UnifiedEntitySchema format.
 *
 * Subclasses must implement the `parse(source)` method with source-specific logic.
 *
 * @module gen/connectors/BaseConnector
 */

import type { UnifiedEntitySchema } from '../schema'

/**
 * Connector options for customizing parsing behavior
 */
export interface ConnectorOptions {
  /** Connector instance name for debugging */
  name?: string
  /** Throw on validation errors instead of warning (default: false) */
  strict?: boolean
  /** Custom extension data passed to output schemas */
  extensions?: Record<string, unknown>
}

/**
 * Warning encountered during parsing
 */
export interface ParseWarning {
  /** Location in source where issue occurred */
  path: string
  /** Description of the issue */
  message: string
  /** Warning code for programmatic handling */
  code?: string
}

/**
 * Parse result with parsed schemas and any encountered issues
 */
export interface ParseResult {
  /** Parsed entity schemas */
  schemas: UnifiedEntitySchema[]
  /** Non-fatal issues encountered during parsing */
  warnings: ParseWarning[]
}

/**
 * Base connector class for parsing schema sources into UnifiedEntitySchema format.
 *
 * @abstract
 * @example
 * // Extending BaseConnector
 * class ManualConnector extends BaseConnector {
 *   parse(source) {
 *     // Parse inline definitions
 *     return source.entities.map(e => this.transformEntity(e))
 *   }
 * }
 *
 * @example
 * // Using a connector
 * const connector = new ManualConnector({ strict: true })
 * const schemas = connector.parse(manualDefinitions)
 */
export abstract class BaseConnector {
  /** Connector instance name */
  name: string

  /** Whether to throw on validation errors */
  strict: boolean

  /** Custom extension data */
  extensions: Record<string, unknown>

  /**
   * Create a new connector instance
   *
   * @param options - Connector configuration options
   */
  constructor(options: ConnectorOptions = {}) {
    this.name = options.name || this.constructor.name
    this.strict = options.strict ?? false
    this.extensions = options.extensions || {}
  }

  /**
   * Parse a schema source into UnifiedEntitySchema format.
   *
   * This method must be implemented by subclasses to handle source-specific
   * parsing logic. The source parameter format depends on the connector type:
   * - ManualConnector: Object with entity/field definitions
   * - OpenAPIConnector: OpenAPI 3.x specification object
   *
   * @abstract
   * @param source - Source data to parse (format depends on connector type)
   * @returns Parsed entity schemas
   * @throws If parsing fails (in strict mode) or source is invalid
   *
   * @example
   * // ManualConnector source format
   * connector.parse({
   *   entities: [
   *     { name: 'users', endpoint: '/api/users', fields: { ... } }
   *   ]
   * })
   *
   * @example
   * // OpenAPIConnector source format
   * connector.parse({
   *   openapi: '3.0.0',
   *   paths: { '/api/users': { ... } },
   *   components: { schemas: { ... } }
   * })
   */
  abstract parse(source: unknown): UnifiedEntitySchema[]

  /**
   * Parse with detailed result including warnings
   *
   * Alternative to `parse()` that returns warnings along with schemas.
   * Useful when you want to handle non-fatal issues without strict mode.
   *
   * Default implementation wraps `parse()` with empty warnings array.
   * Subclasses can override for more detailed reporting.
   *
   * @param source - Source data to parse
   * @returns Schemas and any warnings encountered
   */
  parseWithWarnings(source: unknown): ParseResult {
    return {
      schemas: this.parse(source),
      warnings: [],
    }
  }

  /**
   * Validate connector is properly configured before parsing
   *
   * Override in subclasses to add custom validation.
   *
   * @returns True if connector is valid
   * @throws If connector configuration is invalid
   */
  validate(): boolean {
    return true
  }
}

export default BaseConnector
