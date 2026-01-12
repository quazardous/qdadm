/**
 * Hooks Module
 *
 * Drupal-inspired hook system for extensibility.
 * Built on QuarKernel signal bus.
 */

export { HookRegistry, createHookRegistry, HOOK_PRIORITY } from './HookRegistry'
export type {
  HookHandler,
  HookRegistrationOptions,
  HookRegistryOptions,
  InvokeOptions,
  AlterOptions,
} from './HookRegistry'
