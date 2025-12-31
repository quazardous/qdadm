/**
 * Gen Module - Code generation utilities
 *
 * Provides UnifiedSchema and FieldMapper for generating admin interfaces
 * from database schemas.
 *
 * @module gen
 */

// T00309: UnifiedSchema types and helpers
export {
  UNIFIED_FIELD_TYPES,
  isValidFieldType,
  createFieldSchema,
  createEntitySchema
} from './schema.js'

// Re-export types for IDE support
// (JSDoc @typedef are automatically available when importing from this module)

// T00310: FieldMapper - JSON Schema to UnifiedFieldSchema type conversion
export {
  BASE_TYPE_MAPPINGS,
  FORMAT_MAPPINGS,
  getDefaultType
} from './FieldMapper.js'

// T00312: BaseConnector - Abstract base for schema connectors
export { BaseConnector } from './connectors/index.js'

// T00313: ManualConnector - Inline entity/field definitions
export { ManualConnector } from './connectors/index.js'

// T00316: StorageProfileFactory - Type definitions for storage profile pattern
// JSDoc types available when importing this module (no runtime exports)
import './StorageProfileFactory.js'

// T00317: createManagers - Runtime factory for EntityManager creation
export { createManagers } from './createManagers.js'

// T00318: Decorators - Per-entity field customization layer
export { applyDecorators } from './decorators.js'

// T00319: generateManagers - Build-time file generation for EntityManagers
export { generateManagers } from './generateManagers.js'
