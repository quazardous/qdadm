/**
 * RolesManager as the `roles` system entity, on an app's own storage (#2406).
 *
 * The supported way to keep roles behind your API is the manager with your
 * storage. What must survive that swap: the entity stays a system entity, the
 * admin gate holds, and the protected roles stay undeletable — even when the
 * app's rows key roles on another field than `name`.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { RolesManager } from '../../src/security/RolesManager'
import { MockApiStorage } from '../../src/entity/storage/MockApiStorage'

const admin = (granted = ['security:roles:manage']) => ({
  hasSecurityChecker: () => true,
  isGranted: (permission) => granted.includes(permission),
})

const onApi = (options = {}) =>
  new RolesManager({
    storage: new MockApiStorage({ entityName: 'roles', storageKey: `roles_${Math.random()}`, initialData: [] }),
    authAdapter: admin(),
    ...options,
  })

describe('RolesManager on your own storage (#2406)', () => {
  it('stays a system entity: the manager makes it one, not the app', () => {
    expect(onApi().system).toBe(true)
  })

  it('uses the storage it is given', () => {
    const storage = new MockApiStorage({ entityName: 'roles', storageKey: 'roles_given', initialData: [] })
    expect(new RolesManager({ storage, authAdapter: admin() }).storage).toBe(storage)
  })

  it('puts every action behind the one admin permission', () => {
    const reader = onApi({ authAdapter: admin(['entity:roles:read']) })
    // A plain entity would follow entity:roles:read; this one does not, by design.
    expect(reader.canRead()).toBe(false)
    expect(onApi().canRead()).toBe(true)
    expect(onApi({ adminPermission: 'users:manage', authAdapter: admin(['users:manage']) }).canDelete()).toBe(true)
  })

  describe('protected roles cannot be deleted', () => {
    it("in qdadm's own shape, keyed on name", () => {
      const roles = onApi()
      expect(roles.canDelete({ name: 'ROLE_ANONYMOUS' })).toBe(false)
      expect(roles.canDelete({ name: 'ROLE_EDITOR' })).toBe(true)
    })

    it('when the app keys roles on another field — the guard used to stop matching', () => {
      const roles = onApi({ idField: 'id' })
      expect(roles.canDelete({ id: 'ROLE_ANONYMOUS' })).toBe(false)
      expect(roles.canDelete({ id: 'ROLE_EDITOR' })).toBe(true)
    })

    it('when idField is a database id and the code still sits in name', () => {
      const roles = onApi({ idField: 'id' })
      expect(roles.canDelete({ id: 7, name: 'ROLE_ANONYMOUS' })).toBe(false)
    })

    it('and only an admin may delete anything', () => {
      expect(onApi({ authAdapter: admin([]) }).canDelete({ name: 'ROLE_EDITOR' })).toBe(false)
    })
  })
})
