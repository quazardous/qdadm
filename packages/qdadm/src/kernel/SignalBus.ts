/**
 * SignalBus - qdadm wiring.
 *
 * The dispatcher itself now lives in `@quazardous/qdcore` so it can be shared
 * with qdcms. This module re-exports the generic API and adds the qdadm
 * application-level signal-name registry (`SIGNALS`).
 *
 * Signal naming conventions (qdadm flavor):
 * - Generic CRUD: entity:created, entity:updated, entity:deleted
 * - Entity-specific: {entityName}:created, etc. — built via `buildSignal()`
 * - Auth: auth:login, auth:logout, auth:expired
 * - API: api:error
 *
 * Wildcard subscriptions are inherited from QuarKernel:
 * - 'entity:*' matches entity:created/updated/deleted
 * - '*:created' matches any creation
 */

export {
  SignalBus,
  createSignalBus,
  buildSignal,
  SIGNAL_ACTIONS,
} from '@quazardous/qdcore'
export type {
  SignalBusOptions,
  SignalAction,
  EntitySignalPayload,
} from '@quazardous/qdcore'

/**
 * qdadm signal-name registry.
 * Application-level convention; kept in qdadm because qdcore is naming-agnostic.
 */
export const SIGNALS = {
  // Generic entity lifecycle signals
  ENTITY_CREATED: 'entity:created',
  ENTITY_UPDATED: 'entity:updated',
  ENTITY_DELETED: 'entity:deleted',

  // Auth lifecycle signals
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_EXPIRED: 'auth:expired', // Emitted on 401/403 API responses

  // API error signals
  API_ERROR: 'api:error', // Emitted on any API error { status, message, url }
} as const
