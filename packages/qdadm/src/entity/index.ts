/**
 * Entity Module
 *
 * EntityManager and storage adapters for data abstraction.
 */

// EntityManager
export {
  EntityManager,
  createEntityManager,
  type EntityManagerOptions,
  type RoutingContext,
  type PresaveContext,
  type PostsaveContext,
  type PredeleteContext,
  type QueryOptions,
  type WhitelistContext,
  type CacheInfo
} from './EntityManager'

// Re-export types from types module
export type {
  EntityRecord,
  ListParams,
  ListResult,
  FieldConfig,
  ChildConfig,
  ParentConfig,
  RelationConfig,
  NavConfig,
  StorageCapabilities
} from '../types'

// Manager Factory
export {
  managerFactory,
  defaultManagerResolver,
  createManagerFactory,
  createManagers,
  type ManagerConfig,
  type ManagerFactoryContext,
  type ManagerResolver
} from './factory'

// Storage adapters
export * from './storage/index'

// Auth adapters
export * from './auth'
