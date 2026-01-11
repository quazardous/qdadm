/**
 * Chain Module - Active navigation stack management
 *
 * Provides:
 * - ActiveStack: Sync container for navigation context (entity, param, foreignKey, id)
 * - StackHydrator: Async layer for entity data and labels
 * - useActiveStack: Composable to build and access the sync stack
 * - useStackHydrator: Composable to access hydrated data
 *
 * @module chain
 */

// Sync stack (context only)
export { ActiveStack } from './ActiveStack.js'
export { useActiveStack } from './useActiveStack.js'

// Async hydration (data + labels)
export { StackHydrator } from './StackHydrator.js'
export { useStackHydrator } from './useStackHydrator.js'
