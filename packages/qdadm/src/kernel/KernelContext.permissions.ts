/**
 * Patch KernelContext prototype with permission registration methods:
 *   - permissions(namespace, perms, options)   — generic registration
 *   - entityPermissions(entity, perms)         — shorthand for entity-scoped
 */

import type { PermissionMeta, PermissionOptions } from './KernelContext.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Self = any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyPermissionMethods(KernelContextClass: { prototype: any }): void {
  const proto = KernelContextClass.prototype as Self

  proto.permissions = function (
    this: Self,
    namespace: string,
    permissions: Record<string, string | PermissionMeta>,
    options: PermissionOptions = {}
  ): Self {
    if (this._kernel.permissionRegistry) {
      this._kernel.permissionRegistry.register(namespace, permissions, {
        ...options,
        module: (this._module?.constructor as { name?: string })?.name || 'unknown',
      })
    }
    return this
  }

  proto.entityPermissions = function (
    this: Self,
    entity: string,
    permissions: Record<string, string | PermissionMeta>
  ): Self {
    return this.permissions(entity, permissions, { isEntity: true })
  }
}
