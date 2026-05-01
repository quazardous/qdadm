/**
 * EventRouter — qdadm re-export.
 *
 * The actual implementation now lives in `@quazardous/qdcore` so it can be
 * shared with qdcms. The legacy `orchestrator` constructor option (which was
 * never actually read by any callback in qdadm) has been dropped; callers
 * needing extras in `RouteContext` should use the new `context` option:
 *
 * ```ts
 * createEventRouter({ signals, context: { orchestrator }, routes })
 * // -> available inside callbacks as ctx.orchestrator
 * ```
 */

export { EventRouter, createEventRouter } from '@quazardous/qdcore'
export type {
  SignalTarget,
  RouteContext,
  RouteCallback,
  RouteTarget,
  RoutesConfig,
  EventRouterOptions,
} from '@quazardous/qdcore'
