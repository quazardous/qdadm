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
  createEntitySchema,
  type UnifiedFieldType,
  type UnifiedFieldReference,
  type UnifiedFieldSchema,
  type UnifiedEntitySchema,
} from './schema'

// T00310: FieldMapper - JSON Schema to UnifiedFieldSchema type conversion
export {
  BASE_TYPE_MAPPINGS,
  FORMAT_MAPPINGS,
  getDefaultType,
  type CustomMappings,
  type SchemaProperty,
} from './FieldMapper'

// T00312: BaseConnector - Abstract base for schema connectors
export {
  BaseConnector,
  type ConnectorOptions,
  type ParseWarning,
  type ParseResult,
} from './connectors'

// T00313: ManualConnector - Inline entity/field definitions
export {
  ManualConnector,
  type ManualEntityInput,
  type ManualFieldInput,
  type ManualSourceInput,
} from './connectors'

// OpenAPIConnector - Parse OpenAPI 3.x specifications
export { OpenAPIConnector, type OpenAPIConnectorOptions, type OperationFilter } from './connectors'

// T00316: StorageProfileFactory - Type definitions for storage profile pattern
export { type StorageProfileFactory, type StorageProfileOptions } from './StorageProfileFactory'

// T00317: createManagers - Runtime factory for EntityManager creation
export { createManagers, type CreateManagersConfig, type EntityConfig } from './createManagers'

// T00318: Decorators - Per-entity field customization layer
export { applyDecorators, type FieldDecorator, type EntityDecorator } from './decorators'

// T00319: generateManagers - Build-time file generation for EntityManagers
export {
  generateManagers,
  type GenerateManagersConfig,
  type GenerateManagersEntityConfig,
} from './generateManagers'
