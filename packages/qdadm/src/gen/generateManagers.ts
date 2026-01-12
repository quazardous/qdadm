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
import { join } from 'node:path'

import type { UnifiedEntitySchema, UnifiedFieldSchema } from './schema'
import type { EntityDecorator } from './decorators'

/**
 * Default output directory for generated managers
 */
const DEFAULT_OUTPUT_DIR = 'src/generated/managers/'

/**
 * Entity configuration for generation
 */
export interface GenerateManagersEntityConfig {
  /** Entity schema */
  schema: UnifiedEntitySchema
  /** API endpoint path (e.g., '/users') */
  endpoint: string
  /** Import path for storage (e.g., 'qdadm' or './storage') */
  storageImport: string
  /** Storage class name (e.g., 'ApiStorage') */
  storageClass: string
  /** Additional storage constructor options */
  storageOptions?: Record<string, unknown>
  /** Field decorators to apply */
  decorators?: EntityDecorator
  /** Generate class instead of instance (for extension) */
  classMode?: boolean
}

/**
 * Configuration for generateManagers
 */
export interface GenerateManagersConfig {
  /** Output directory (default: 'src/generated/managers/') */
  output?: string
  /** Generate classes instead of instances (for extension pattern) */
  classMode?: boolean
  /** Entity configurations keyed by entity name */
  entities: Record<string, GenerateManagersEntityConfig>
}

/**
 * Convert entity name to PascalCase for class name
 *
 * @param name - Entity name (e.g., 'users', 'blog_posts')
 * @returns PascalCase name (e.g., 'Users', 'BlogPosts')
 */
function toPascalCase(name: string): string {
  return name
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/**
 * Serialize a value to JavaScript source code
 *
 * @param value - Value to serialize
 * @param indent - Current indentation level
 * @returns JavaScript source code
 */
function serializeValue(value: unknown, indent: number = 0): string {
  const spaces = '  '.repeat(indent)
  const innerSpaces = '  '.repeat(indent + 1)

  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map((v) => serializeValue(v, indent + 1))
    return `[\n${innerSpaces}${items.join(`,\n${innerSpaces}`)}\n${spaces}]`
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    if (keys.length === 0) return '{}'
    const entries = keys.map((key) => {
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
      return `${innerSpaces}${safeKey}: ${serializeValue(obj[key], indent + 1)}`
    })
    return `{\n${entries.join(',\n')}\n${spaces}}`
  }
  return String(value)
}

/**
 * Manager options for EntityManager constructor
 */
interface ManagerOptions {
  name: string
  idField: string
  label?: string
  labelPlural?: string
  labelField?: string
  routePrefix?: string
  readOnly?: boolean
  fields: Record<string, UnifiedFieldSchema>
}

/**
 * Generate the source code for a single entity manager file
 *
 * @param entityName - Entity name
 * @param entityConfig - Entity configuration
 * @param globalOptions - Global generation options
 * @returns Generated JavaScript source code
 */
function generateManagerSource(
  entityName: string,
  entityConfig: GenerateManagersEntityConfig,
  globalOptions: { classMode?: boolean } = {}
): string {
  const { schema, endpoint, storageImport, storageClass, storageOptions = {}, decorators } = entityConfig
  const classMode = entityConfig.classMode ?? globalOptions.classMode ?? false
  const className = toPascalCase(entityName)

  // Build storage options object
  const fullStorageOptions: Record<string, unknown> = {
    endpoint,
    ...storageOptions,
  }

  // Apply decorators to schema if provided
  let finalSchema = schema
  if (decorators?.fields) {
    // Create decorated fields inline
    const decoratedFields: Record<string, UnifiedFieldSchema> = {}
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
  const managerOptions: Record<string, unknown> = {
    name: finalSchema.name,
    idField: finalSchema.idField || 'id',
    label: finalSchema.label,
    labelPlural: finalSchema.labelPlural,
    labelField: finalSchema.labelField,
    routePrefix: finalSchema.routePrefix,
    readOnly: finalSchema.readOnly,
    fields: finalSchema.fields,
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
 * @param config - Configuration object
 * @returns List of generated file paths
 * @throws If config is invalid or file operations fail
 *
 * @example
 * ```ts
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
 * ```
 */
export async function generateManagers(config: GenerateManagersConfig): Promise<string[]> {
  // Validate config
  if (!config || typeof config !== 'object') {
    throw new Error('generateManagers: config is required and must be an object')
  }

  if (!config.entities || typeof config.entities !== 'object') {
    throw new Error('generateManagers: config.entities is required and must be an object')
  }

  const outputDir = config.output || DEFAULT_OUTPUT_DIR
  const globalOptions = { classMode: config.classMode ?? false }
  const generatedFiles: string[] = []

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
