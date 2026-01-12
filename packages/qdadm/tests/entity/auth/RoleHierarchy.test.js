/**
 * Unit tests for RoleHierarchy
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { RoleHierarchy, createRoleHierarchy } from '../../../src/entity/auth'

describe('RoleHierarchy', () => {
  describe('constructor', () => {
    it('accepts empty hierarchy', () => {
      const hierarchy = new RoleHierarchy()
      expect(hierarchy.map).toEqual({})
    })

    it('stores hierarchy map', () => {
      const config = { ROLE_ADMIN: ['ROLE_USER'] }
      const hierarchy = new RoleHierarchy(config)
      expect(hierarchy.map).toBe(config)
    })
  })

  describe('getReachableRoles', () => {
    it('returns role itself when no parents', () => {
      const hierarchy = new RoleHierarchy({})
      const reachable = hierarchy.getReachableRoles('ROLE_USER')
      expect(reachable).toEqual(['ROLE_USER'])
    })

    it('includes parent roles', () => {
      const hierarchy = new RoleHierarchy({
        ROLE_ADMIN: ['ROLE_USER']
      })
      const reachable = hierarchy.getReachableRoles('ROLE_ADMIN')
      expect(reachable).toContain('ROLE_ADMIN')
      expect(reachable).toContain('ROLE_USER')
      expect(reachable).toHaveLength(2)
    })

    it('resolves multi-level hierarchy', () => {
      const hierarchy = new RoleHierarchy({
        ROLE_SUPER_ADMIN: ['ROLE_ADMIN'],
        ROLE_ADMIN: ['ROLE_USER']
      })
      const reachable = hierarchy.getReachableRoles('ROLE_SUPER_ADMIN')
      expect(reachable).toContain('ROLE_SUPER_ADMIN')
      expect(reachable).toContain('ROLE_ADMIN')
      expect(reachable).toContain('ROLE_USER')
      expect(reachable).toHaveLength(3)
    })

    it('handles multiple parents', () => {
      const hierarchy = new RoleHierarchy({
        ROLE_SUPER_ADMIN: ['ROLE_ADMIN', 'ROLE_MANAGER'],
        ROLE_ADMIN: ['ROLE_USER'],
        ROLE_MANAGER: ['ROLE_USER']
      })
      const reachable = hierarchy.getReachableRoles('ROLE_SUPER_ADMIN')
      expect(reachable).toContain('ROLE_SUPER_ADMIN')
      expect(reachable).toContain('ROLE_ADMIN')
      expect(reachable).toContain('ROLE_MANAGER')
      expect(reachable).toContain('ROLE_USER')
      // ROLE_USER appears once (deduplicated)
      expect(reachable).toHaveLength(4)
    })

    it('handles cycles gracefully', () => {
      const hierarchy = new RoleHierarchy({
        ROLE_A: ['ROLE_B'],
        ROLE_B: ['ROLE_A']  // Cycle!
      })
      // Should not infinite loop
      const reachable = hierarchy.getReachableRoles('ROLE_A')
      expect(reachable).toContain('ROLE_A')
      expect(reachable).toContain('ROLE_B')
    })
  })

  describe('isGrantedRole', () => {
    const hierarchy = new RoleHierarchy({
      ROLE_ADMIN: ['ROLE_USER'],
      ROLE_SUPER_ADMIN: ['ROLE_ADMIN']
    })

    it('grants role to itself', () => {
      expect(hierarchy.isGrantedRole(['ROLE_USER'], 'ROLE_USER')).toBe(true)
    })

    it('grants parent role to child', () => {
      expect(hierarchy.isGrantedRole(['ROLE_ADMIN'], 'ROLE_USER')).toBe(true)
    })

    it('does not grant child role to parent', () => {
      expect(hierarchy.isGrantedRole(['ROLE_USER'], 'ROLE_ADMIN')).toBe(false)
    })

    it('resolves multi-level inheritance', () => {
      expect(hierarchy.isGrantedRole(['ROLE_SUPER_ADMIN'], 'ROLE_USER')).toBe(true)
      expect(hierarchy.isGrantedRole(['ROLE_SUPER_ADMIN'], 'ROLE_ADMIN')).toBe(true)
    })

    it('accepts single role as string', () => {
      expect(hierarchy.isGrantedRole('ROLE_ADMIN', 'ROLE_USER')).toBe(true)
    })

    it('checks all user roles', () => {
      expect(hierarchy.isGrantedRole(['ROLE_GUEST', 'ROLE_ADMIN'], 'ROLE_USER')).toBe(true)
    })
  })

  describe('getRolesGranting', () => {
    const hierarchy = new RoleHierarchy({
      ROLE_ADMIN: ['ROLE_USER'],
      ROLE_SUPER_ADMIN: ['ROLE_ADMIN']
    })

    it('includes the target role itself', () => {
      const grantors = hierarchy.getRolesGranting('ROLE_USER')
      expect(grantors).toContain('ROLE_USER')
    })

    it('includes all roles that inherit the target', () => {
      const grantors = hierarchy.getRolesGranting('ROLE_USER')
      expect(grantors).toContain('ROLE_ADMIN')
      expect(grantors).toContain('ROLE_SUPER_ADMIN')
    })
  })

  describe('validate', () => {
    it('returns true for valid hierarchy', () => {
      const hierarchy = new RoleHierarchy({
        ROLE_ADMIN: ['ROLE_USER']
      })
      expect(hierarchy.validate()).toBe(true)
    })

    it('returns true for empty hierarchy', () => {
      const hierarchy = new RoleHierarchy({})
      expect(hierarchy.validate()).toBe(true)
    })

    it('returns false for cyclic hierarchy', () => {
      const hierarchy = new RoleHierarchy({
        ROLE_A: ['ROLE_B'],
        ROLE_B: ['ROLE_A']
      })
      expect(hierarchy.validate()).toBe(false)
    })

    it('returns false for self-reference', () => {
      const hierarchy = new RoleHierarchy({
        ROLE_A: ['ROLE_A']
      })
      expect(hierarchy.validate()).toBe(false)
    })
  })
})

describe('createRoleHierarchy', () => {
  it('returns RoleHierarchy instance', () => {
    const hierarchy = createRoleHierarchy({ ROLE_ADMIN: ['ROLE_USER'] })
    expect(hierarchy).toBeInstanceOf(RoleHierarchy)
  })

  it('accepts empty config', () => {
    const hierarchy = createRoleHierarchy()
    expect(hierarchy.map).toEqual({})
  })
})
