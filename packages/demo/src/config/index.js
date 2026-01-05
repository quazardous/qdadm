/**
 * Demo app configuration
 *
 * Central export for all config modules.
 *
 * Module-centric pattern: entities are defined in their own modules,
 * not in centralized config files.
 */

export { moduleDefs, modulesOptions, sectionOrder } from './modules'
export { registerHooks } from './hooks'
export { authCheck } from './storages'

// Re-export internal storages for cross-module use (login validation, enrichment)
export { usersStorageInternal } from '../modules/users/UsersModule'
export { booksStorageInternal } from '../modules/books/BooksModule'
