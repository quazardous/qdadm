/**
 * Patch KernelContext prototype with entity registration methods:
 *   - entity(name, config)   — generic EntityManager registration
 *   - userEntity(options)    — UsersManager registration with conventions
 */

import { managerFactory, type ManagerFactoryContext } from '../entity/factory.js'
import type { EntityManager } from '../entity/EntityManager'
import type { EntityRecord } from '../types'
import { UsersManager } from '../security/UsersManager'
import type { UserEntityOptions } from './KernelContext.types'
import type { KernelContext } from './KernelContext'

// #1196 Phase B — this-typing against the real KernelContext shape (was Self = any)
type Self = KernelContext

export function applyEntityMethods(KernelContextClass: { prototype: KernelContext }): void {
  const proto = KernelContextClass.prototype

  /**
   * Register an entity manager.
   *
   * Uses managerFactory to resolve config into a manager instance.
   * Registers with Orchestrator for CRUD operations.
   */
  proto.entity = function <T extends EntityRecord>(
    this: Self,
    name: string,
    config: string | Record<string, unknown> | EntityManager<T>
  ): Self {
    const factoryContext = {
      storageResolver: this._kernel.options.storageResolver,
      managerResolver: this._kernel.options.managerResolver,
      managerRegistry: this._kernel.options.managerRegistry || {},
    } as ManagerFactoryContext

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manager = managerFactory(config as any, name, factoryContext)

    if (this._kernel.orchestrator) {
      this._kernel.orchestrator.register(name, manager)
    }

    if (this._kernel.permissionRegistry) {
      this._kernel.permissionRegistry.registerEntity(name, {
        module: (this._module?.constructor as { name?: string })?.name || 'unknown',
        // Register entity-own:* permissions if manager has isOwn configured
        hasOwnership: !!(manager as unknown as { _isOwn?: unknown })._isOwn,
      })
    }

    // Track entity → module for the 'module' i18n key strategy
    if (this._kernel.i18nInstance) {
      const moduleName = (this._module?.constructor as { name?: string })?.name
      if (moduleName) {
        this._kernel.i18nInstance.registerEntityModule(name, moduleName)
      }
    }

    return this
  }

  /**
   * Register a users entity with standard fields and role linking.
   */
  proto.userEntity = function (this: Self, options: UserEntityOptions): Self {
    const manager = new UsersManager(options)

    if (this._kernel.orchestrator) {
      this._kernel.orchestrator.register('users', manager)
    }

    if (this._kernel.permissionRegistry) {
      this._kernel.permissionRegistry.registerEntity('users', {
        module: (this._module?.constructor as { name?: string })?.name || 'unknown',
      })
    }

    return this
  }
}
