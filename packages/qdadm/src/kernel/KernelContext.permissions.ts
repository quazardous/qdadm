/**
 * Patch KernelContext prototype with permission registration methods:
 *   - permissions(namespace, perms, options)   — generic registration
 *   - entityPermissions(entity, perms)         — shorthand for entity-scoped
 */

import type { PermissionMeta, PermissionOptions } from './KernelContext.types'
import type { KernelContext } from './KernelContext'

// #1196 Phase B — this-typing against the real KernelContext shape (was Self = any)
type Self = KernelContext

export function applyPermissionMethods(KernelContextClass: { prototype: KernelContext }): void {
  const proto = KernelContextClass.prototype

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
