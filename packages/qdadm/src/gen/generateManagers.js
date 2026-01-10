/**
 * Build-time Manager File Generation
 *
 * Generates individual EntityManager files for each entity in the configuration.
 * This enables better IDE support and static analysis by creating explicit files
 * rather than relying on runtime factory creation.
 *
 * @module gen/generateManagers
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'

/**
 * Default output directory for generated managers
 * @type {string}
 */
const DEFAULT_OUTPUT_DIR = 'src/generated/managers/'

/**
 * Configuration for generateManagers
 *
 * @typedef {object} GenerateManagersConfig
 * @property {string} [output] - Output directory (default: 'src/generated/managers/')
 * @property {boolean} [classMode] - Generate classes instead of instances (for extension pattern)
 * @property {Record<string, GenerateManagersEntityConfig>} entities - Entity configurations keyed by entity name
 */

/**
 * Entity configuration for generation
 *
 * @typedef {object} GenerateManagersEntityConfig
 * @property {import('./schema.js').UnifiedEntitySchema} schema - Entity schema
 * @property {string} endpoint - API endpoint path (e.g., '/users')
 * @property {string} storageImport - Import path for storage (e.g., 'qdadm' or './storage')
 * @property {string} storageClass - Storage class name (e.g., 'ApiStorage')
 * @property {object} [storageOptions] - Additional storage constructor options
 * @property {object} [decorators] - Field decorators to apply
 * @property {boolean} [classMode] - Generate class instead of instance (for extension)
 */

/**
 * Convert entity name to PascalCase for class name
 *
 * @param {string} name - Entity name (e.g., 'users', 'blog_posts')
 * @returns {string} PascalCase name (e.g., 'Users', 'BlogPosts')
 * @private
 */
function toPascalCase(name) {
  return name
    .split(/[_-]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/**
 * Serialize a value to JavaScript source code
 *
 * @param {*} value - Value to serialize
 * @param {number} [indent=0] - Current indentation level
 * @returns {string} JavaScript source code
 * @private
 */
function serializeValue(value, indent = 0) {
  const spaces = '  '.repeat(indent)
  const innerSpaces = '  '.repeat(indent + 1)

  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map(v => serializeValue(v, indent + 1))
    return `[\n${innerSpaces}${items.join(`,\n${innerSpaces}`)}\n${spaces}]`
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value)
    if (keys.length === 0) return '{}'
    const entries = keys.map(key => {
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
      return `${innerSpaces}${safeKey}: ${serializeValue(value[key], indent + 1)}`
    })
    return `{\n${entries.join(',\n')}\n${spaces}}`
  }
  return String(value)
}

/**
 * Generate the source code for a single entity manager file
 *
 * @param {string} entityName - Entity name
 * @param {GenerateManagersEntityConfig} entityConfig - Entity configuration
 * @param {object} [globalOptions] - Global generation options
 * @param {boolean} [globalOptions.classMode] - Generate class instead of instance
 * @returns {string} Generated JavaScript source code
 * @private
 */
function generateManagerSource(entityName, entityConfig, globalOptions = {}) {
  const { schema, endpoint, storageImport, storageClass, storageOptions = {}, decorators } = entityConfig
  const classMode = entityConfig.classMode ?? globalOptions.classMode ?? false
  const className = toPascalCase(entityName)

  // Build storage options object
  const fullStorageOptions = {
    endpoint,
    ...storageOptions
  }

  // Apply decorators to schema if provided
  let finalSchema = schema
  if (decorators?.fields) {
    // Create decorated fields inline
    const decoratedFields = {}
    for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
      const decorator = decorators.fields[fieldName]
      if (decorator) {
        decoratedFields[fieldName] = { ...fieldSchema, ...decorator }
      } else {
        decoratedFields[fieldName] = { ...fieldSchema }
      }
    }
    finalSchema = { ...schema, fields: decoratedFields }
  }

  // Build EntityManager options
  const managerOptions = {
    name: finalSchema.name,
    idField: finalSchema.idField || 'id',
    label: finalSchema.label,
    labelPlural: finalSchema.labelPlural,
    labelField: finalSchema.labelField,
    routePrefix: finalSchema.routePrefix,
    readOnly: finalSchema.readOnly,
    fields: finalSchema.fields
  }

  // Remove undefined values
  for (const key of Object.keys(managerOptions)) {
    if (managerOptions[key] === undefined) {
      delete managerOptions[key]
    }
  }

  // Class-based template for extension pattern
  if (classMode) {
    return `/**
 * Generated${className}Manager - Auto-generated base class
 *
 * Generated by qdadm/gen/generateManagers
 * DO NOT EDIT MANUALLY - Changes will be overwritten
 *
 * Extend this class for custom logic.
 *
 * Entity: ${entityName}
 * Endpoint: ${endpoint}
 */

import { EntityManager } from 'qdadm'
import { ${storageClass} } from '${storageImport}'

/**
 * Generated base manager for ${entityName}
 *
 * @extends EntityManager
 */
export class Generated${className}Manager extends EntityManager {
  constructor(options = {}) {
    super({
      ...${serializeValue(managerOptions, 2)},
      storage: new ${storageClass}(${serializeValue(fullStorageOptions, 2)}),
      ...options
    })
  }
}
`
  }

  // Instance-based template (default)
  return `/**
 * ${className}Manager - Auto-generated EntityManager
 *
 * Generated by qdadm/gen/generateManagers
 * DO NOT EDIT MANUALLY - Changes will be overwritten
 *
 * Entity: ${entityName}
 * Endpoint: ${endpoint}
 */

import { EntityManager } from 'qdadm'
import { ${storageClass} } from '${storageImport}'

/**
 * Schema definition for ${entityName}
 * @type {import('qdadm/gen').UnifiedEntitySchema}
 */
export const ${entityName}Schema = ${serializeValue(finalSchema, 0)}

/**
 * Storage options for ${entityName}
 */
const storageOptions = ${serializeValue(fullStorageOptions, 0)}

/**
 * ${className}Manager instance
 *
 * Provides CRUD operations for ${entityName} entity.
 *
 * @type {EntityManager}
 */
export const ${entityName}Manager = new EntityManager({
  ...${serializeValue(managerOptions, 0)},
  storage: new ${storageClass}(storageOptions)
})
`
}

/**
 * Generate EntityManager files from configuration
 *
 * Creates one JavaScript file per entity in the output directory.
 * Each file exports the entity's schema and a configured EntityManager instance.
 *
 * @param {GenerateManagersConfig} config - Configuration object
 * @returns {Promise<string[]>} List of generated file paths
 * @throws {Error} If config is invalid or file operations fail
 *
 * @example
 * import { generateManagers } from 'qdadm/gen'
 *
 * const generatedFiles = await generateManagers({
 *   output: 'src/generated/managers/',
 *   entities: {
 *     users: {
 *       schema: usersSchema,
 *       endpoint: '/api/users',
 *       storageImport: 'qdadm',
 *       storageClass: 'ApiStorage',
 *       storageOptions: { client: 'apiClient' },
 *       decorators: {
 *         fields: {
 *           password: { hidden: true }
 *         }
 *       }
 *     }
 *   }
 * })
 *
 * console.log('Generated:', generatedFiles)
 * // ['src/generated/managers/usersManager.js']
 */
export async function generateManagers(config) {
  // Validate config
  if (!config || typeof config !== 'object') {
    throw new Error('generateManagers: config is required and must be an object')
  }

  if (!config.entities || typeof config.entities !== 'object') {
    throw new Error('generateManagers: config.entities is required and must be an object')
  }

  const outputDir = config.output || DEFAULT_OUTPUT_DIR
  const globalOptions = { classMode: config.classMode ?? false }
  const generatedFiles = []

  // Validate each entity config
  for (const [entityName, entityConfig] of Object.entries(config.entities)) {
    if (!entityConfig || typeof entityConfig !== 'object') {
      throw new Error(`generateManagers: entity '${entityName}' config must be an object`)
    }

    if (!entityConfig.schema || typeof entityConfig.schema !== 'object') {
      throw new Error(`generateManagers: entity '${entityName}' requires 'schema' property`)
    }

    if (!entityConfig.endpoint || typeof entityConfig.endpoint !== 'string') {
      throw new Error(`generateManagers: entity '${entityName}' requires 'endpoint' property`)
    }

    if (!entityConfig.storageImport || typeof entityConfig.storageImport !== 'string') {
      throw new Error(`generateManagers: entity '${entityName}' requires 'storageImport' property`)
    }

    if (!entityConfig.storageClass || typeof entityConfig.storageClass !== 'string') {
      throw new Error(`generateManagers: entity '${entityName}' requires 'storageClass' property`)
    }
  }

  // Create output directory if it doesn't exist
  await mkdir(outputDir, { recursive: true })

  // Generate files for each entity
  for (const [entityName, entityConfig] of Object.entries(config.entities)) {
    const isClassMode = entityConfig.classMode ?? globalOptions.classMode
    // Use entity.js for classMode (matches existing pattern), entityManager.js for instance mode
    const fileName = isClassMode ? `${entityName}.js` : `${entityName}Manager.js`
    const filePath = join(outputDir, fileName)

    // Generate source code
    const source = generateManagerSource(entityName, entityConfig, globalOptions)

    // Write file
    await writeFile(filePath, source, 'utf-8')

    generatedFiles.push(filePath)
  }

  return generatedFiles
}
