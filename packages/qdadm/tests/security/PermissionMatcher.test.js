import { describe, it, expect } from 'vitest'
import { PermissionMatcher } from '../../src/security/PermissionMatcher.js'

describe('PermissionMatcher', () => {
  describe('matches - exact', () => {
    it('matches identical strings', () => {
      expect(PermissionMatcher.matches('entity:books:read', 'entity:books:read')).toBe(true)
    })

    it('rejects different strings', () => {
      expect(PermissionMatcher.matches('entity:books:read', 'entity:books:write')).toBe(false)
    })

    it('rejects partial matches', () => {
      expect(PermissionMatcher.matches('entity:books', 'entity:books:read')).toBe(false)
    })
  })

  describe('matches - single wildcard (*)', () => {
    it('* matches one segment', () => {
      expect(PermissionMatcher.matches('entity:*:read', 'entity:books:read')).toBe(true)
      expect(PermissionMatcher.matches('entity:*:read', 'entity:loans:read')).toBe(true)
    })

    it('* at end matches one segment', () => {
      expect(PermissionMatcher.matches('entity:books:*', 'entity:books:read')).toBe(true)
      expect(PermissionMatcher.matches('entity:books:*', 'entity:books:create')).toBe(true)
      expect(PermissionMatcher.matches('entity:books:*', 'entity:books:delete')).toBe(true)
    })

    it('* does NOT match zero segments', () => {
      expect(PermissionMatcher.matches('entity:*:read', 'entity:read')).toBe(false)
    })

    it('* does NOT match multiple segments', () => {
      expect(PermissionMatcher.matches('entity:*:read', 'entity:books:loans:read')).toBe(false)
    })

    it('multiple * wildcards', () => {
      expect(PermissionMatcher.matches('*:*:read', 'entity:books:read')).toBe(true)
      expect(PermissionMatcher.matches('*:*:*', 'a:b:c')).toBe(true)
      expect(PermissionMatcher.matches('*:*:*', 'a:b')).toBe(false)
    })
  })

  describe('matches - double wildcard (**)', () => {
    it('** alone matches everything', () => {
      expect(PermissionMatcher.matches('**', 'entity:books:read')).toBe(true)
      expect(PermissionMatcher.matches('**', 'anything')).toBe(true)
      expect(PermissionMatcher.matches('**', 'a:b:c:d:e')).toBe(true)
    })

    it('** at end matches remaining segments', () => {
      expect(PermissionMatcher.matches('entity:**', 'entity:books:read')).toBe(true)
      expect(PermissionMatcher.matches('entity:**', 'entity:loans:create')).toBe(true)
      expect(PermissionMatcher.matches('entity:**', 'entity:a:b:c:d')).toBe(true)
    })

    it('** matches zero segments at end', () => {
      // entity:** should match entity:x (one segment after entity:)
      expect(PermissionMatcher.matches('entity:**', 'entity:x')).toBe(true)
    })

    it('** does NOT match different prefix', () => {
      expect(PermissionMatcher.matches('entity:**', 'admin:config')).toBe(false)
    })

    it('prefix:** pattern', () => {
      expect(PermissionMatcher.matches('admin:**', 'admin:config:view')).toBe(true)
      expect(PermissionMatcher.matches('admin:**', 'admin:logs:purge')).toBe(true)
      expect(PermissionMatcher.matches('admin:**', 'entity:books:read')).toBe(false)
    })
  })

  describe('matches - mixed wildcards', () => {
    it('* followed by **', () => {
      expect(PermissionMatcher.matches('entity:*:**', 'entity:books:read')).toBe(true)
      expect(PermissionMatcher.matches('entity:*:**', 'entity:books:loans:create')).toBe(true)
    })
  })

  describe('any - multiple patterns', () => {
    it('returns true if any pattern matches', () => {
      const patterns = ['entity:*:read', 'entity:*:list']
      expect(PermissionMatcher.any(patterns, 'entity:books:read')).toBe(true)
      expect(PermissionMatcher.any(patterns, 'entity:books:list')).toBe(true)
    })

    it('returns false if no pattern matches', () => {
      const patterns = ['entity:*:read', 'entity:*:list']
      expect(PermissionMatcher.any(patterns, 'entity:books:delete')).toBe(false)
    })

    it('handles empty array', () => {
      expect(PermissionMatcher.any([], 'anything')).toBe(false)
    })

    it('handles null/undefined', () => {
      expect(PermissionMatcher.any(null, 'anything')).toBe(false)
      expect(PermissionMatcher.any(undefined, 'anything')).toBe(false)
    })

    it('super admin pattern matches everything', () => {
      const patterns = ['entity:*:read', '**']
      expect(PermissionMatcher.any(patterns, 'entity:books:delete')).toBe(true)
      expect(PermissionMatcher.any(patterns, 'admin:config:edit')).toBe(true)
    })
  })

  describe('filter', () => {
    it('filters permissions matching pattern', () => {
      const perms = ['entity:books:read', 'entity:books:create', 'auth:login']
      expect(PermissionMatcher.filter(perms, 'entity:books:*')).toEqual([
        'entity:books:read',
        'entity:books:create'
      ])
    })
  })

  describe('expand', () => {
    it('expands pattern against registered permissions', () => {
      const registry = [
        'entity:books:read',
        'entity:books:create',
        'entity:loans:read',
        'auth:login'
      ]
      expect(PermissionMatcher.expand('entity:*:read', registry)).toEqual([
        'entity:books:read',
        'entity:loans:read'
      ])
    })
  })

  describe('real-world scenarios', () => {
    it('ROLE_USER pattern', () => {
      const userPerms = ['entity:*:read', 'entity:*:list']
      expect(PermissionMatcher.any(userPerms, 'entity:books:read')).toBe(true)
      expect(PermissionMatcher.any(userPerms, 'entity:books:list')).toBe(true)
      expect(PermissionMatcher.any(userPerms, 'entity:books:create')).toBe(false)
      expect(PermissionMatcher.any(userPerms, 'admin:config:view')).toBe(false)
    })

    it('ROLE_ADMIN pattern', () => {
      const adminPerms = ['entity:**', 'admin:**']
      expect(PermissionMatcher.any(adminPerms, 'entity:books:read')).toBe(true)
      expect(PermissionMatcher.any(adminPerms, 'entity:books:delete')).toBe(true)
      expect(PermissionMatcher.any(adminPerms, 'admin:config:view')).toBe(true)
      expect(PermissionMatcher.any(adminPerms, 'auth:impersonate')).toBe(false)
    })

    it('ROLE_SUPER_ADMIN pattern', () => {
      const superAdminPerms = ['**']
      expect(PermissionMatcher.any(superAdminPerms, 'entity:books:read')).toBe(true)
      expect(PermissionMatcher.any(superAdminPerms, 'admin:config:edit')).toBe(true)
      expect(PermissionMatcher.any(superAdminPerms, 'auth:impersonate')).toBe(true)
      expect(PermissionMatcher.any(superAdminPerms, 'anything:at:all')).toBe(true)
    })
  })
})
