/**
 * Why a permission is granted or denied (#2363): explainGrant tells the path SecurityChecker.isGranted takes, and
 * never disagrees with it.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { SecurityChecker } from '../../src/entity/auth/SecurityChecker'
import { explainGrant } from '../../src/security/explainGrant'

function checkerFor(user, { grant } = {}) {
  return new SecurityChecker({
    roleHierarchy: { ROLE_ADMIN: ['ROLE_USER'], ROLE_USER: [] },
    rolePermissions: {
      ROLE_USER: ['entity:books:read', 'entity:*:update'],
      ROLE_ADMIN: ['entity:books:delete'],
    },
    getCurrentUser: () => user,
    ...(grant ? { grant } : {}),
  })
}

describe('explainGrant (#2363)', () => {
  it('names the role and its exact grant', () => {
    expect(explainGrant(checkerFor({ roles: ['ROLE_USER'] }), 'entity:books:read')).toEqual({
      granted: true,
      decidedBy: 'grant',
      role: 'ROLE_USER',
      grant: 'entity:books:read',
      roles: ['ROLE_USER'],
    })
  })

  it('names the wildcard that covers the key', () => {
    expect(explainGrant(checkerFor({ roles: ['ROLE_USER'] }), 'entity:loans:update')).toMatchObject({
      granted: true,
      role: 'ROLE_USER',
      grant: 'entity:*:update',
    })
  })

  it('names the inherited role that brings the grant, nearest first', () => {
    const admin = checkerFor({ roles: ['ROLE_ADMIN'] })

    expect(explainGrant(admin, 'entity:books:delete')).toMatchObject({ granted: true, role: 'ROLE_ADMIN', grant: 'entity:books:delete' })
    expect(explainGrant(admin, 'entity:books:read')).toMatchObject({ granted: true, role: 'ROLE_USER', grant: 'entity:books:read' })
  })

  it("a user's own permission has no role", () => {
    const checker = checkerFor({ roles: ['ROLE_USER'], permissions: ['entity:books:delete'] })

    expect(explainGrant(checker, 'entity:books:delete')).toMatchObject({ granted: true, role: null, grant: 'entity:books:delete' })
  })

  it('a denied key lists the roles that were looked at', () => {
    expect(explainGrant(checkerFor({ roles: ['ROLE_USER'] }), 'entity:books:delete')).toEqual({
      granted: false,
      decidedBy: 'grant',
      roles: ['ROLE_USER'],
    })
  })

  it("the app's judge decides first; one that throws denies; one that abstains falls through", () => {
    const user = { roles: ['ROLE_USER'] }
    expect(explainGrant(checkerFor(user, { grant: { isGranted: () => true } }), 'entity:books:delete')).toEqual({ granted: true, decidedBy: 'app' })

    vi.spyOn(console, 'error').mockImplementation(() => {})
    const throwing = { isGranted: () => { throw new Error('backend down') } }
    expect(explainGrant(checkerFor(user, { grant: throwing }), 'entity:books:read')).toEqual({ granted: false, decidedBy: 'app' })

    const abstaining = { isGranted: () => undefined }
    expect(explainGrant(checkerFor(user, { grant: abstaining }), 'entity:books:read')).toMatchObject({ decidedBy: 'grant', granted: true })
    vi.restoreAllMocks()
  })

  it('a ROLE_* attribute goes through the role hierarchy; no user denies', () => {
    expect(explainGrant(checkerFor({ roles: ['ROLE_ADMIN'] }), 'ROLE_USER')).toEqual({ granted: true, decidedBy: 'role-hierarchy', roles: ['ROLE_ADMIN'] })
    expect(explainGrant(checkerFor(null), 'entity:books:read')).toEqual({ granted: false, decidedBy: 'no-user' })
  })

  it('never disagrees with isGranted', () => {
    const users = [{ roles: ['ROLE_USER'] }, { roles: ['ROLE_ADMIN'] }, { roles: ['ROLE_USER'], permissions: ['entity:loans:delete'] }, { role: 'ROLE_USER' }]
    const keys = ['entity:books:read', 'entity:books:list', 'entity:books:update', 'entity:books:delete', 'entity:loans:update', 'entity:loans:delete', 'ROLE_ADMIN', 'ROLE_USER']
    for (const user of users) {
      const checker = checkerFor(user)
      for (const key of keys) {
        expect(explainGrant(checker, key).granted, `${JSON.stringify(user)} ${key}`).toBe(checker.isGranted(key))
      }
    }
  })
})
