/**
 * Schema Connectors
 *
 * Pluggable connectors that parse various schema sources into UnifiedEntitySchema format.
 *
 * @module gen/connectors
 */

export {
  BaseConnector,
  type ConnectorOptions,
  type ParseWarning,
  type ParseResult,
} from './BaseConnector'

export {
  ManualConnector,
  type ManualEntityInput,
  type ManualFieldInput,
  type ManualSourceInput,
} from './ManualConnector'

export {
  OpenAPIConnector,
  type OpenAPIConnectorOptions,
  type OperationFilter,
} from './OpenAPIConnector'
