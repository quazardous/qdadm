/**
 * Runtime Factory for EntityManager Creation
 *
 * Creates EntityManager instances on-the-fly from configuration.
 * This is the core factory function that wires schemas, storage profiles,
 * and decorators together at runtime.
 *
 * @module gen/createManagers
 */

import { EntityManager } from '../entity/EntityManager'
import { applyDecorators } from './decorators.js'

/**
 * Entity configuration in the config.entities map
 *
 * @typedef {object} EntityConfig
 * @property {string} schema - Schema source name (key in config.schemas)
 * @property {string} storage - Storage profile name (key in config.storages)
 * @property {string} endpoint - API endpoint path (e.g., '/users')
 * @property {import('./StorageProfileFactory.js').StorageProfileOptions} [options] - Per-entity storage options
 */

/**
 * Configuration for createManagers factory
 *
 * @typedef {object} CreateManagersConfig
 * @property {Record<string, import('./schema.js').UnifiedEntitySchema[]>} schemas - Schema sources (connector results) keyed by name
 * @property {Record<string, import('./StorageProfileFactory.js').StorageProfileFactory>} storages - Storage profile factories keyed by name
 * @property {Record<string, EntityConfig>} entities - Entity configurations keyed by entity name
 * @property {Record<string, object>} [decorators] - Per-entity decorators (fields, labels, permissions)
 */

/**
 * Validate config structure early with clear error messages
 *
 * @param {CreateManagersConfig} config - Configuration to validate
 * @throws {Error} - If config is invalid
 * @private
 */
function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('createManagers: config is required and must be an object')
  }

  if (!config.schemas || typeof config.schemas !== 'object') {
    throw new Error('createManagers: config.schemas is required and must be an object')
  }

  if (!config.storages || typeof config.storages !== 'object') {
    throw new Error('createManagers: config.storages is required and must be an object')
  }

  if (!config.entities || typeof config.entities !== 'object') {
    throw new Error('createManagers: config.entities is required and must be an object')
  }

  // Validate each entity config
  for (const [entityName, entityConfig] of Object.entries(config.entities)) {
    if (!entityConfig || typeof entityConfig !== 'object') {
      throw new Error(`createManagers: entity '${entityName}' config must be an object`)
    }

    if (!entityConfig.schema || typeof entityConfig.schema !== 'string') {
      throw new Error(`createManagers: entity '${entityName}' requires 'schema' property`)
    }

    if (!entityConfig.storage || typeof entityConfig.storage !== 'string') {
      throw new Error(`createManagers: entity '${entityName}' requires 'storage' property`)
    }

    if (!entityConfig.endpoint || typeof entityConfig.endpoint !== 'string') {
      throw new Error(`createManagers: entity '${entityName}' requires 'endpoint' property`)
    }

    // Validate references exist
    if (!(entityConfig.schema in config.schemas)) {
      throw new Error(`createManagers: entity '${entityName}' references unknown schema '${entityConfig.schema}'`)
    }

    if (!(entityConfig.storage in config.storages)) {
      throw new Error(`createManagers: entity '${entityName}' references unknown storage '${entityConfig.storage}'`)
    }
  }
}

/**
 * Find schema for entity from connector result
 *
 * Connector results are arrays of UnifiedEntitySchema. This finds the schema
 * matching the entity name, or uses the first schema if none matches.
 *
 * @param {import('./schema.js').UnifiedEntitySchema[]} schemas - Connector result (array of schemas)
 * @param {string} entityName - Entity name to find
 * @param {string} schemaSourceName - Schema source name for error messages
 * @returns {import('./schema.js').UnifiedEntitySchema} - Found schema
 * @throws {Error} - If schema not found
 * @private
 */
function findSchemaForEntity(schemas, entityName, schemaSourceName) {
  if (!Array.isArray(schemas)) {
    throw new Error(`createManagers: schema source '${schemaSourceName}' must be an array of UnifiedEntitySchema`)
  }

  if (schemas.length === 0) {
    throw new Error(`createManagers: schema source '${schemaSourceName}' is empty`)
  }

  // Find by entity name
  const schema = schemas.find(s => s.name === entityName)
  if (schema) {
    return schema
  }

  // If only one schema in source, use it (common for single-entity sources)
  if (schemas.length === 1) {
    return schemas[0]
  }

  // Multiple schemas but none match
  const available = schemas.map(s => s.name).join(', ')
  throw new Error(`createManagers: entity '${entityName}' not found in schema source '${schemaSourceName}'. Available: ${available}`)
}

/**
 * Create EntityManager instances from configuration
 *
 * This is the runtime factory that wires schemas, storage profiles, and
 * decorators together at runtime without code generation.
 *
 * @param {CreateManagersConfig} config - Configuration object
 * @returns {Map<string, EntityManager>} - Map of entity name to EntityManager instance
 * @throws {Error} - If config is invalid or references missing schemas/storages
 *
 * @example
 * import { createManagers } from 'qdadm/gen'
 * import { ManualConnector } from 'qdadm/gen'
 * import { ApiStorage } from 'qdadm'
 * import axios from 'axios'
 *
 * // Define schemas using connectors
 * const connector = new ManualConnector()
 * const schemas = connector.parse([
 *   {
 *     name: 'users',
 *     endpoint: '/users',
 *     fields: {
 *       id: { name: 'id', type: 'number', readOnly: true },
 *       email: { name: 'email', type: 'email', required: true }
 *     }
 *   }
 * ])
 *
 * // Define storage profile factory
 * const apiClient = axios.create({ baseURL: 'https://api.example.com' })
 * const apiProfile = (endpoint, options) => new ApiStorage({
 *   endpoint,
 *   client: apiClient,
 *   ...options
 * })
 *
 * // Create managers
 * const managers = createManagers({
 *   schemas: { api: schemas },
 *   storages: { jsonplaceholder: apiProfile },
 *   entities: {
 *     users: { schema: 'api', storage: 'jsonplaceholder', endpoint: '/users' }
 *   },
 *   decorators: {
 *     users: { fields: { email: { hidden: true } } }
 *   }
 * })
 *
 * const usersManager = managers.get('users')
 * const users = await usersManager.list()
 */
export function createManagers(config) {
  // Validate config structure early
  validateConfig(config)

  /** @type {Map<string, EntityManager>} */
  const managers = new Map()

  // Process each entity configuration
  for (const [entityName, entityConfig] of Object.entries(config.entities)) {
    // 1. Get schema from connector result
    const schemaSource = config.schemas[entityConfig.schema]
    let schema = findSchemaForEntity(schemaSource, entityName, entityConfig.schema)

    // 2. Apply decorators if defined
    const decorator = config.decorators?.[entityName]
    schema = applyDecorators(schema, decorator)

    // 3. Get storage factory and create storage instance
    const storageFactory = config.storages[entityConfig.storage]
    if (typeof storageFactory !== 'function') {
      throw new Error(`createManagers: storage '${entityConfig.storage}' must be a factory function`)
    }

    const storageOptions = {
      entity: entityName,
      ...entityConfig.options
    }
    const storage = storageFactory(entityConfig.endpoint, storageOptions)

    // 4. Create EntityManager with schema + storage
    const manager = new EntityManager({
      name: schema.name,
      storage,
      idField: schema.idField || 'id',
      label: schema.label,
      labelPlural: schema.labelPlural,
      labelField: schema.labelField,
      routePrefix: schema.routePrefix,
      readOnly: schema.readOnly,
      fields: schema.fields
    })

    // 5. Store in result Map
    managers.set(entityName, manager)
  }

  return managers
}
