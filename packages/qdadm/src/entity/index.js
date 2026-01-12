/**
 * Entity Module
 *
 * EntityManager and storage adapters for data abstraction.
 */

// EntityManager
export { EntityManager, createEntityManager } from './EntityManager'

// Manager Factory
export {
  managerFactory,
  defaultManagerResolver,
  createManagerFactory,
  createManagers
} from './factory.js'

// Storage adapters
export * from './storage/index'

// Auth adapters
export * from './auth'
