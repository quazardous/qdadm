/**
 * Sample Configuration Fixtures for Gen Module Tests
 *
 * Reusable configurations for testing createManagers, decorators,
 * and generateManagers.
 *
 * @module tests/gen/__fixtures__/sample-config
 */

import { ManualConnector } from '../../../src/gen/connectors/ManualConnector.js'
import { MemoryStorage } from '../../../src/entity/storage/MemoryStorage'

/**
 * Sample users schema definition
 * @type {import('../../../src/gen/connectors/ManualConnector.js').ManualEntityInput}
 */
export const usersEntityInput = {
  name: 'users',
  endpoint: '/api/users',
  label: 'User',
  labelPlural: 'Users',
  labelField: 'name',
  idField: 'id',
  fields: {
    id: { name: 'id', type: 'number', readOnly: true },
    name: { name: 'name', type: 'text', required: true, label: 'Full Name' },
    email: { name: 'email', type: 'email', required: true, label: 'Email' },
    role: { name: 'role', type: 'text', enum: ['admin', 'user', 'guest'], default: 'user' },
    active: { name: 'active', type: 'boolean', default: true },
    password: { name: 'password', type: 'text', hidden: false },
    created_at: { name: 'created_at', type: 'datetime', readOnly: true }
  }
}

/**
 * Sample posts schema definition
 * @type {import('../../../src/gen/connectors/ManualConnector.js').ManualEntityInput}
 */
export const postsEntityInput = {
  name: 'posts',
  endpoint: '/api/posts',
  label: 'Post',
  labelPlural: 'Posts',
  labelField: 'title',
  fields: {
    id: { name: 'id', type: 'number', readOnly: true },
    title: { name: 'title', type: 'text', required: true, label: 'Title' },
    content: { name: 'content', type: 'text', label: 'Content' },
    author_id: {
      name: 'author_id',
      type: 'number',
      reference: { entity: 'users', field: 'id' },
      label: 'Author'
    },
    status: {
      name: 'status',
      type: 'text',
      enum: ['draft', 'published', 'archived'],
      default: 'draft'
    },
    published_at: { name: 'published_at', type: 'datetime' }
  }
}

/**
 * Sample categories schema definition
 * @type {import('../../../src/gen/connectors/ManualConnector.js').ManualEntityInput}
 */
export const categoriesEntityInput = {
  name: 'categories',
  endpoint: '/api/categories',
  label: 'Category',
  labelPlural: 'Categories',
  labelField: 'name',
  fields: {
    id: { name: 'id', type: 'number', readOnly: true },
    name: { name: 'name', type: 'text', required: true },
    slug: { name: 'slug', type: 'text', required: true },
    description: { name: 'description', type: 'textarea' }
  }
}

/**
 * Sample settings schema (read-only)
 * @type {import('../../../src/gen/connectors/ManualConnector.js').ManualEntityInput}
 */
export const settingsEntityInput = {
  name: 'settings',
  endpoint: '/api/settings',
  label: 'Setting',
  labelPlural: 'Settings',
  labelField: 'key',
  readOnly: true,
  fields: {
    key: { name: 'key', type: 'text', readOnly: true },
    value: { name: 'value', type: 'text' },
    type: { name: 'type', type: 'text', enum: ['string', 'number', 'boolean', 'json'] }
  }
}

/**
 * Create parsed schemas using ManualConnector
 * @returns {import('../../../src/gen/schema.js').UnifiedEntitySchema[]}
 */
export function createParsedSchemas() {
  const connector = new ManualConnector()
  return connector.parse([
    usersEntityInput,
    postsEntityInput,
    categoriesEntityInput,
    settingsEntityInput
  ])
}

/**
 * Create a MemoryStorage profile factory
 * @returns {import('../../../src/gen/StorageProfileFactory.js').StorageProfileFactory}
 */
export function createMemoryStorageFactory() {
  return (endpoint, options = {}) => {
    return new MemoryStorage({
      idField: options.idField || 'id',
      initialData: options.initialData || []
    })
  }
}

/**
 * Create a complete configuration for createManagers
 * @returns {import('../../../src/gen/createManagers.js').CreateManagersConfig}
 */
export function createSampleConfig() {
  const schemas = createParsedSchemas()

  return {
    schemas: { api: schemas },
    storages: { memory: createMemoryStorageFactory() },
    entities: {
      users: { schema: 'api', storage: 'memory', endpoint: '/api/users' },
      posts: { schema: 'api', storage: 'memory', endpoint: '/api/posts' },
      categories: { schema: 'api', storage: 'memory', endpoint: '/api/categories' },
      settings: { schema: 'api', storage: 'memory', endpoint: '/api/settings' }
    }
  }
}

/**
 * Create configuration with decorators
 * @returns {import('../../../src/gen/createManagers.js').CreateManagersConfig}
 */
export function createConfigWithDecorators() {
  const config = createSampleConfig()
  config.decorators = {
    users: {
      fields: {
        password: { hidden: true },
        email: { label: 'Email Address' },
        name: { order: 1 },
        email: { order: 2 },
        role: { order: 3 }
      }
    },
    posts: {
      fields: {
        author_id: { label: 'Written By', readOnly: true }
      }
    }
  }
  return config
}

/**
 * Create configuration for generateManagers
 * @param {string} outputDir - Output directory path
 * @returns {import('../../../src/gen/generateManagers.js').GenerateManagersConfig}
 */
export function createGenerateConfig(outputDir) {
  const connector = new ManualConnector()
  const schemas = connector.parse([usersEntityInput, postsEntityInput])

  return {
    output: outputDir,
    entities: {
      users: {
        schema: schemas.find(s => s.name === 'users'),
        endpoint: '/api/users',
        storageImport: 'qdadm',
        storageClass: 'ApiStorage'
      },
      posts: {
        schema: schemas.find(s => s.name === 'posts'),
        endpoint: '/api/posts',
        storageImport: 'qdadm',
        storageClass: 'ApiStorage'
      }
    }
  }
}

/**
 * Create configuration for generateManagers with decorators
 * @param {string} outputDir - Output directory path
 * @returns {import('../../../src/gen/generateManagers.js').GenerateManagersConfig}
 */
export function createGenerateConfigWithDecorators(outputDir) {
  const config = createGenerateConfig(outputDir)

  config.entities.users.decorators = {
    fields: {
      password: { hidden: true },
      email: { label: 'Email Address' }
    }
  }

  return config
}

/**
 * Sample initial data for MemoryStorage testing
 */
export const sampleInitialData = {
  users: [
    { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin', active: true },
    { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user', active: true },
    { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'guest', active: false }
  ],
  posts: [
    { id: 1, title: 'First Post', content: 'Hello World', author_id: 1, status: 'published' },
    { id: 2, title: 'Draft Post', content: 'Work in progress', author_id: 2, status: 'draft' }
  ],
  categories: [
    { id: 1, name: 'Technology', slug: 'tech' },
    { id: 2, name: 'Science', slug: 'science' }
  ]
}

/**
 * Create configuration with pre-populated data
 * @returns {import('../../../src/gen/createManagers.js').CreateManagersConfig}
 */
export function createConfigWithData() {
  const schemas = createParsedSchemas()

  const dataStorageFactory = (endpoint, options = {}) => {
    const entityName = options.entity
    const initialData = sampleInitialData[entityName] || []
    return new MemoryStorage({
      idField: 'id',
      initialData
    })
  }

  return {
    schemas: { api: schemas },
    storages: { memory: dataStorageFactory },
    entities: {
      users: { schema: 'api', storage: 'memory', endpoint: '/api/users' },
      posts: { schema: 'api', storage: 'memory', endpoint: '/api/posts' },
      categories: { schema: 'api', storage: 'memory', endpoint: '/api/categories' }
    }
  }
}
