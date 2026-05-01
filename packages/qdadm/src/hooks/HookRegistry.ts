/**
 * HookRegistry — qdadm re-export.
 *
 * The actual implementation now lives in `@quazardous/qdcore` so it can be
 * shared with qdcms. This module re-exports the public API to preserve
 * existing qdadm imports (`from '../hooks/HookRegistry'`).
 */

export { HookRegistry, createHookRegistry, HOOK_PRIORITY } from '@quazardous/qdcore'
export type {
  HookHandler,
  HookRegistrationOptions,
  HookRegistryOptions,
  InvokeOptions,
  AlterOptions,
} from '@quazardous/qdcore'
