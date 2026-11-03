/**
 * A module brings its own grants (#4694): `ctx.grant(role, permissions)`
 * adds default grants; a role saved from the Roles screen keeps its own list
 * and still gets the defaults added since it was saved, while a grant the
 * user removed stays removed.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { PersistableRoleProvider, createLocalStorageRolesProvider } from '../../src/security/PersistableRolesProvider'
import { StaticRoleProvider } from '../../src/security/StaticRolesProvider'
import { KernelContext } from '../../src/kernel/KernelContext'

const defaults = {
  role_permissions: {
    ROLE_USER: ['entity:*:read', 'entity:*:list', 'entity:books:update'],
    ROLE_ADMIN: ['entity:*:*'],
  },
}

describe('default grants from a module (#4694)', () => {
  it('join the defaults of a role nobody saved', () => {
    const provider = new PersistableRoleProvider({ defaults })
    provider.addDefaultGrants('ROLE_USER', ['entity:suppliers:create', 'entity:*:read'])
    expect(provider.getPermissions('ROLE_USER')).toEqual(['entity:*:read', 'entity:*:list', 'entity:books:update', 'entity:suppliers:create'])
  })

  it('a static provider takes them too', () => {
    const provider = new StaticRoleProvider({ role_permissions: { ROLE_USER: ['a'] } })
    provider.addDefaultGrants('ROLE_USER', ['b'])
    expect(provider.getPermissions('ROLE_USER')).toEqual(['a', 'b'])
  })

  it('ctx.grant reaches the kernel\'s roles provider', () => {
    const provider = new PersistableRoleProvider({ defaults })
    const ctx = new KernelContext({ rolesProvider: provider, options: {} }, null)
    ctx.grant('ROLE_USER', 'entity:suppliers:update')
    expect(provider.getPermissions('ROLE_USER')).toContain('entity:suppliers:update')
  })
})

describe('roles saved from the Roles screen (#4694)', () => {
  beforeEach(() => localStorage.clear())

  it('a grant added since the save reaches the role; one the user removed stays removed', async () => {
    const first = createLocalStorageRolesProvider({ key: 'roles', defaults })
    // The user removes entity:books:update from ROLE_USER, then saves
    first._applyData({ role_permissions: { ...first._permissions, ROLE_USER: ['entity:*:read', 'entity:*:list'] } })
    first._permissions = { ...first._permissions, ROLE_USER: ['entity:*:read', 'entity:*:list'] }
    await first.persist()
    expect(JSON.parse(localStorage.getItem('roles')).defaults_snapshot.ROLE_USER).toContain('entity:books:update')

    // Next load: a module grants suppliers:create
    const next = createLocalStorageRolesProvider({ key: 'roles', defaults })
    next.addDefaultGrants('ROLE_USER', ['entity:suppliers:create'])
    const perms = next.getPermissions('ROLE_USER')
    expect(perms).toContain('entity:suppliers:create')
    expect(perms).not.toContain('entity:books:update')
  })

  it('a save from before the snapshot keeps its list as it is', () => {
    localStorage.setItem('roles', JSON.stringify({ role_permissions: { ROLE_USER: ['entity:*:read'] } }))
    const provider = createLocalStorageRolesProvider({ key: 'roles', defaults })
    provider.addDefaultGrants('ROLE_USER', ['entity:suppliers:create'])
    expect(provider.getPermissions('ROLE_USER')).toEqual(['entity:*:read'])
  })
})
