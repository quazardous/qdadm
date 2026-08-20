/**
 * Chain Module - Active navigation stack management
 *
 * Provides:
 * - ActiveStack: Sync container for navigation context (entity, param, foreignKey, id)
 * - StackHydrator: Async layer for entity data and labels
 * - useActiveStack: Composable to build and access the sync stack
 * - useStackHydrator: Composable to access hydrated data
 *
 * @experimental Navigation-stack plumbing that happens to be exported: the
 * level shape and the hydration payloads may change in a minor release. The
 * parent/child routing built on top of it is stable — see
 * docs/API_STABILITY.md.
 *
 * @module chain
 */

// Sync stack (context only)
export {
  ActiveStack,
  type StackLevel,
  type EntityStackLevel,
  type EntityStackLevelInput,
  type StackChangePayload,
} from './ActiveStack'
export { useActiveStack, type UseActiveStackReturn } from './useActiveStack'

// Async hydration (data + labels)
export { StackHydrator, type HydratedLevel, type HydratedPayload } from './StackHydrator'
export { useStackHydrator, type StackHydratorReturn } from './useStackHydrator'
