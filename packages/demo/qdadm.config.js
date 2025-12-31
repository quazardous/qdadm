/**
 * qdadm Configuration - JSONPlaceholder Storage Profile
 *
 * Configures qdadm to use JSONPlaceholder API as a read-only data source.
 * Uses ManualConnector for inline schema definitions and ApiStorage for REST calls.
 *
 * @module qdadm.config
 */

// Import browser-compatible gen modules directly to avoid Node.js-specific generateManagers
import { createManagers } from 'qdadm/src/gen/createManagers.js'
import { ManualConnector } from 'qdadm/src/gen/connectors/ManualConnector.js'
import { ApiStorage } from 'qdadm'
import axios from 'axios'

// ============================================================================
// AXIOS CLIENT
// ============================================================================
// JSONPlaceholder is a free fake REST API for testing and prototyping.
// All responses are JSON, no authentication required.

const jsonPlaceholderClient = axios.create({
  baseURL: 'https://jsonplaceholder.typicode.com'
})

// ============================================================================
// STORAGE PROFILE FACTORY
// ============================================================================
// Creates ApiStorage instances for each entity endpoint.
// JSONPlaceholder returns arrays directly, not { items, total } format,
// so we configure responseItemsKey to handle this.

/**
 * JSONPlaceholder storage profile factory
 *
 * @param {string} endpoint - Entity endpoint (e.g., '/users')
 * @param {object} options - Per-entity options
 * @returns {ApiStorage} Storage instance configured for JSONPlaceholder
 */
const jsonPlaceholderProfile = (endpoint, options = {}) => {
  return new ApiStorage({
    endpoint,
    client: jsonPlaceholderClient,
    // JSONPlaceholder returns array directly, not { items: [], total: n }
    // ApiStorage handles this by using the array as items and its length as total
    ...options
  })
}

// ============================================================================
// MANUAL CONNECTOR - SCHEMA DEFINITIONS
// ============================================================================
// Define entity schemas inline using ManualConnector.
// These match JSONPlaceholder's data structure.

const connector = new ManualConnector({ strict: true })

const schemas = connector.parse([
  // Users entity
  {
    name: 'users',
    endpoint: '/users',
    label: 'User',
    labelPlural: 'Users',
    labelField: 'name',
    idField: 'id',
    readOnly: true, // JSONPlaceholder doesn't persist changes
    fields: {
      id: { name: 'id', type: 'number', readOnly: true },
      name: { name: 'name', type: 'text', label: 'Full Name', required: true },
      username: { name: 'username', type: 'text', label: 'Username', required: true },
      email: { name: 'email', type: 'email', label: 'Email', required: true },
      phone: { name: 'phone', type: 'text', label: 'Phone' },
      website: { name: 'website', type: 'url', label: 'Website' }
    }
  },

  // Posts entity
  {
    name: 'posts',
    endpoint: '/posts',
    label: 'Post',
    labelPlural: 'Posts',
    labelField: 'title',
    idField: 'id',
    readOnly: true,
    fields: {
      id: { name: 'id', type: 'number', readOnly: true },
      title: { name: 'title', type: 'text', label: 'Title', required: true },
      body: { name: 'body', type: 'text', label: 'Body', required: true },
      userId: {
        name: 'userId',
        type: 'number',
        label: 'Author',
        required: true,
        reference: {
          entity: 'users',
          labelField: 'name'
        }
      }
    }
  },

  // Todos entity
  {
    name: 'todos',
    endpoint: '/todos',
    label: 'Todo',
    labelPlural: 'Todos',
    labelField: 'title',
    idField: 'id',
    readOnly: true,
    fields: {
      id: { name: 'id', type: 'number', readOnly: true },
      title: { name: 'title', type: 'text', label: 'Title', required: true },
      completed: { name: 'completed', type: 'boolean', label: 'Completed' },
      userId: {
        name: 'userId',
        type: 'number',
        label: 'Assigned To',
        required: true,
        reference: {
          entity: 'users',
          labelField: 'name'
        }
      }
    }
  }
])

// ============================================================================
// CREATE MANAGERS
// ============================================================================
// Wire schemas and storage profiles into EntityManager instances.

/**
 * Create entity managers for JSONPlaceholder entities.
 *
 * @returns {Map<string, EntityManager>} Map of entity name to EntityManager
 *
 * @example
 * import { createJsonPlaceholderManagers } from './qdadm.config.js'
 *
 * const managers = createJsonPlaceholderManagers()
 * const usersManager = managers.get('users')
 * const users = await usersManager.list()
 */
export function createJsonPlaceholderManagers() {
  return createManagers({
    schemas: {
      jsonplaceholder: schemas
    },
    storages: {
      jsonplaceholder: jsonPlaceholderProfile
    },
    entities: {
      users: { schema: 'jsonplaceholder', storage: 'jsonplaceholder', endpoint: '/users' },
      posts: { schema: 'jsonplaceholder', storage: 'jsonplaceholder', endpoint: '/posts' },
      todos: { schema: 'jsonplaceholder', storage: 'jsonplaceholder', endpoint: '/todos' }
    }
  })
}

// ============================================================================
// EXPORTS
// ============================================================================

export { schemas, jsonPlaceholderProfile, jsonPlaceholderClient }

// Default export for Vite plugin integration
export default {
  schemas: { jsonplaceholder: schemas },
  storages: { jsonplaceholder: jsonPlaceholderProfile },
  entities: {
    users: { schema: 'jsonplaceholder', storage: 'jsonplaceholder', endpoint: '/users' },
    posts: { schema: 'jsonplaceholder', storage: 'jsonplaceholder', endpoint: '/posts' },
    todos: { schema: 'jsonplaceholder', storage: 'jsonplaceholder', endpoint: '/todos' }
  }
}
