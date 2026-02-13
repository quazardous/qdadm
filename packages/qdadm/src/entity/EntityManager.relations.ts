import type { EntityRecord, ListParams, ListResult, ChildConfig, ParentConfig } from '../types'
import type { EntityManager } from './EntityManager'
import type { EntityManagerInternal } from './EntityManager.types'

type Self = EntityManagerInternal<any>

/**
 * Patch EntityManager prototype with relation-related methods.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyRelationsMethods(EntityManagerClass: { prototype: any }): void {
  const proto = EntityManagerClass.prototype as Self

  proto.getChildConfig = function (this: Self, childName: string): ChildConfig | undefined {
    return this._children[childName]
  }

  proto.getChildNames = function (this: Self): string[] {
    return Object.keys(this._children)
  }

  proto.getParentConfig = function (this: Self): ParentConfig | null {
    return this._parent
  }

  proto.listChildren = async function (
    this: Self,
    parentId: string | number,
    childName: string,
    params: ListParams = {}
  ): Promise<ListResult<EntityRecord>> {
    const childConfig = this._children[childName]
    if (!childConfig) {
      throw new Error(
        `[EntityManager:${this.name}] Unknown child relation "${childName}"`
      )
    }

    // Build endpoint path
    const childEndpoint = childConfig.endpoint || `${parentId}/${childName}`

    if (this.storage?.request) {
      return this.storage.request('GET', childEndpoint, {
        params,
      }) as Promise<ListResult<EntityRecord>>
    }

    throw new Error(
      `[EntityManager:${this.name}] listChildren() requires storage with request()`
    )
  }

  proto.getChild = async function (
    this: Self,
    parentId: string | number,
    childName: string,
    childId: string | number
  ): Promise<EntityRecord> {
    const childConfig = this._children[childName]
    if (!childConfig) {
      throw new Error(
        `[EntityManager:${this.name}] Unknown child relation "${childName}"`
      )
    }

    const childEndpoint = childConfig.endpoint || `${parentId}/${childName}`

    if (this.storage?.request) {
      return this.storage.request(
        'GET',
        `${childEndpoint}/${childId}`
      ) as Promise<EntityRecord>
    }

    throw new Error(
      `[EntityManager:${this.name}] getChild() requires storage with request()`
    )
  }

  proto.createChild = async function (
    this: Self,
    parentId: string | number,
    childName: string,
    data: Record<string, unknown>
  ): Promise<EntityRecord> {
    const childConfig = this._children[childName]
    if (!childConfig) {
      throw new Error(
        `[EntityManager:${this.name}] Unknown child relation "${childName}"`
      )
    }

    const childEndpoint = childConfig.endpoint || `${parentId}/${childName}`

    if (this.storage?.request) {
      return this.storage.request('POST', childEndpoint, {
        data,
      }) as Promise<EntityRecord>
    }

    throw new Error(
      `[EntityManager:${this.name}] createChild() requires storage with request()`
    )
  }

  proto.deleteChild = async function (
    this: Self,
    parentId: string | number,
    childName: string,
    childId: string | number
  ): Promise<void> {
    const childConfig = this._children[childName]
    if (!childConfig) {
      throw new Error(
        `[EntityManager:${this.name}] Unknown child relation "${childName}"`
      )
    }

    const childEndpoint = childConfig.endpoint || `${parentId}/${childName}`

    if (this.storage?.request) {
      await this.storage.request('DELETE', `${childEndpoint}/${childId}`)
      return
    }

    throw new Error(
      `[EntityManager:${this.name}] deleteChild() requires storage with request()`
    )
  }

  proto.getParentManager = function (this: Self): EntityManager<EntityRecord> | null {
    const parent = this._parent
    const orchestrator = this._orchestrator
    if (!parent || !orchestrator) return null
    return (
      orchestrator.get<EntityRecord>(parent.entity) ?? null
    )
  }

  proto.getChildManager = function (
    this: Self,
    childName: string
  ): EntityManager<EntityRecord> | null {
    const childConfig = this._children[childName]
    const orchestrator = this._orchestrator
    if (!childConfig || !orchestrator) return null
    return (
      orchestrator.get<EntityRecord>(childConfig.entity) ?? null
    )
  }
}
