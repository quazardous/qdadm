/**
 * Unit tests for SecurityChecker
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import {
  SecurityChecker,
  createSecurityChecker,
  RoleHierarchy
} from '../../../src/entity/auth/index.js'

describe('SecurityChecker', () => {
  const createChecker = (user = null, config = {}) => {
    return new SecurityChecker({
      roleHierarchy: new RoleHierarchy(config.role_hierarchy || {
        ROLE_ADMIN: ['ROLE_USER']
      }),
      rolePermissions: config.role_permissions || {
        ROLE_USER: ['entity:read', 'entity:list'],
        ROLE_ADMIN: ['entity:create', 'entity:update', 'entity:delete', 'user:manage']
      },
      getCurrentUser: () => user
    })
  }

  describe('isGranted - no user', () => {
    it('returns false when no user', () => {
      const checker = createChecker(null)
      expect(checker.isGranted('ROLE_USER')).toBe(false)
      expect(checker.isGranted('entity:read')).toBe(false)
    })
  })

  describe('isGranted - role checks', () => {
    it('grants role when user has it', () => {
      const checker = createChecker({ role: 'ROLE_USER' })
      expect(checker.isGranted('ROLE_USER')).toBe(true)
    })

    it('grants inherited role', () => {
      const checker = createChecker({ role: 'ROLE_ADMIN' })
      expect(checker.isGranted('ROLE_USER')).toBe(true)
    })

    it('denies role user does not have', () => {
      const checker = createChecker({ role: 'ROLE_USER' })
      expect(checker.isGranted('ROLE_ADMIN')).toBe(false)
    })

    it('works with roles array', () => {
      const checker = createChecker({ roles: ['ROLE_USER'] })
      expect(checker.isGranted('ROLE_USER')).toBe(true)
    })
  })

  describe('isGranted - permission checks', () => {
    it('grants permission from role', () => {
      const checker = createChecker({ role: 'ROLE_USER' })
      expect(checker.isGranted('entity:read')).toBe(true)
      expect(checker.isGranted('entity:list')).toBe(true)
    })

    it('grants inherited permissions', () => {
      const checker = createChecker({ role: 'ROLE_ADMIN' })
      expect(checker.isGranted('entity:read')).toBe(true)  // From ROLE_USER
      expect(checker.isGranted('entity:delete')).toBe(true)  // From ROLE_ADMIN
    })

    it('denies permission user does not have', () => {
      const checker = createChecker({ role: 'ROLE_USER' })
      expect(checker.isGranted('entity:delete')).toBe(false)
    })

    it('grants wildcard permission', () => {
      const checker = createChecker({ role: 'ROLE_SUPER' }, {
        role_hierarchy: {},
        role_permissions: { ROLE_SUPER: ['*'] }
      })
      expect(checker.isGranted('any:permission')).toBe(true)
      expect(checker.isGranted('entity:delete')).toBe(true)
    })

    it('grants user-specific permissions', () => {
      const checker = createChecker({
        role: 'ROLE_USER',
        permissions: ['special:action']
      })
      expect(checker.isGranted('special:action')).toBe(true)
    })
  })

  describe('getUserPermissions', () => {
    it('collects permissions from role', () => {
      const checker = createChecker({ role: 'ROLE_USER' })
      const perms = checker.getUserPermissions({ role: 'ROLE_USER' })
      expect(perms).toContain('entity:read')
      expect(perms).toContain('entity:list')
    })

    it('collects permissions from inherited roles', () => {
      const checker = createChecker({ role: 'ROLE_ADMIN' })
      const perms = checker.getUserPermissions({ role: 'ROLE_ADMIN' })
      expect(perms).toContain('entity:read')  // From ROLE_USER
      expect(perms).toContain('entity:delete')  // From ROLE_ADMIN
    })

    it('includes user-specific permissions', () => {
      const checker = createChecker({})
      const perms = checker.getUserPermissions({
        role: 'ROLE_USER',
        permissions: ['extra:perm']
      })
      expect(perms).toContain('extra:perm')
    })

    it('handles null role gracefully', () => {
      const checker = createChecker({})
      const perms = checker.getUserPermissions({ roles: [null] })
      expect(perms).toEqual([])
    })
  })

  describe('canAssignRole', () => {
    it('allows assigning role when has permission and role', () => {
      const checker = createChecker({ role: 'ROLE_ADMIN' }, {
        role_hierarchy: { ROLE_ADMIN: ['ROLE_USER'] },
        role_permissions: {
          ROLE_ADMIN: ['role:assign']
        }
      })
      expect(checker.canAssignRole('ROLE_USER')).toBe(true)
    })

    it('denies when no role:assign permission', () => {
      const checker = createChecker({ role: 'ROLE_ADMIN' })
      expect(checker.canAssignRole('ROLE_USER')).toBe(false)
    })

    it('denies assigning role user does not have', () => {
      const checker = createChecker({ role: 'ROLE_USER' }, {
        role_hierarchy: {},
        role_permissions: { ROLE_USER: ['role:assign'] }
      })
      expect(checker.canAssignRole('ROLE_ADMIN')).toBe(false)
    })
  })

  describe('getAssignableRoles', () => {
    it('returns empty when no role:assign permission', () => {
      const checker = createChecker({ role: 'ROLE_ADMIN' })
      expect(checker.getAssignableRoles()).toEqual([])
    })

    it('returns reachable roles when has permission', () => {
      const checker = createChecker({ role: 'ROLE_ADMIN' }, {
        role_hierarchy: { ROLE_ADMIN: ['ROLE_USER'] },
        role_permissions: { ROLE_ADMIN: ['role:assign'] }
      })
      const assignable = checker.getAssignableRoles()
      expect(assignable).toContain('ROLE_ADMIN')
      expect(assignable).toContain('ROLE_USER')
    })

    it('returns empty when no user', () => {
      const checker = createChecker(null, {
        role_hierarchy: {},
        role_permissions: { ROLE_ADMIN: ['role:assign'] }
      })
      expect(checker.getAssignableRoles()).toEqual([])
    })
  })
})

describe('createSecurityChecker', () => {
  it('creates SecurityChecker from config', () => {
    const checker = createSecurityChecker({
      role_hierarchy: { ROLE_ADMIN: ['ROLE_USER'] },
      role_permissions: { ROLE_USER: ['entity:read'] },
      getCurrentUser: () => ({ role: 'ROLE_USER' })
    })
    expect(checker).toBeInstanceOf(SecurityChecker)
    expect(checker.isGranted('entity:read')).toBe(true)
  })

  it('handles empty config', () => {
    const checker = createSecurityChecker({
      getCurrentUser: () => null
    })
    expect(checker).toBeInstanceOf(SecurityChecker)
  })
})
