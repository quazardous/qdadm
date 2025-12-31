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

/**
 * Connector options for customizing parsing behavior
 *
 * @typedef {object} ConnectorOptions
 * @property {string} [name] - Connector instance name for debugging
 * @property {boolean} [strict] - Throw on validation errors instead of warning (default: false)
 * @property {Record<string, *>} [extensions] - Custom extension data passed to output schemas
 */

/**
 * Parse result with parsed schemas and any encountered issues
 *
 * @typedef {object} ParseResult
 * @property {import('../schema.js').UnifiedEntitySchema[]} schemas - Parsed entity schemas
 * @property {ParseWarning[]} warnings - Non-fatal issues encountered during parsing
 */

/**
 * Warning encountered during parsing
 *
 * @typedef {object} ParseWarning
 * @property {string} path - Location in source where issue occurred
 * @property {string} message - Description of the issue
 * @property {string} [code] - Warning code for programmatic handling
 */

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
export class BaseConnector {
  /**
   * Create a new connector instance
   *
   * @param {ConnectorOptions} [options={}] - Connector configuration options
   */
  constructor(options = {}) {
    if (new.target === BaseConnector) {
      throw new Error('BaseConnector is abstract and cannot be instantiated directly')
    }

    /** @type {string} */
    this.name = options.name || this.constructor.name

    /** @type {boolean} */
    this.strict = options.strict ?? false

    /** @type {Record<string, *>} */
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
   * @param {*} source - Source data to parse (format depends on connector type)
   * @returns {import('../schema.js').UnifiedEntitySchema[]} - Parsed entity schemas
   * @throws {Error} - If parsing fails (in strict mode) or source is invalid
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
  parse(source) {
    throw new Error(`${this.name}.parse() must be implemented by subclass`)
  }

  /**
   * Parse with detailed result including warnings
   *
   * Alternative to `parse()` that returns warnings along with schemas.
   * Useful when you want to handle non-fatal issues without strict mode.
   *
   * Default implementation wraps `parse()` with empty warnings array.
   * Subclasses can override for more detailed reporting.
   *
   * @param {*} source - Source data to parse
   * @returns {ParseResult} - Schemas and any warnings encountered
   */
  parseWithWarnings(source) {
    return {
      schemas: this.parse(source),
      warnings: []
    }
  }

  /**
   * Validate connector is properly configured before parsing
   *
   * Override in subclasses to add custom validation.
   *
   * @returns {boolean} - True if connector is valid
   * @throws {Error} - If connector configuration is invalid
   */
  validate() {
    return true
  }
}

export default BaseConnector
