import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  PersistableRoleGranterAdapter,
  createLocalStorageRoleGranter
} from '../../src/security/PersistableRoleGranterAdapter.js'

describe('PersistableRoleGranterAdapter', () => {
  describe('constructor', () => {
    it('initializes with defaults', () => {
      const adapter = new PersistableRoleGranterAdapter({
        defaults: {
          role_permissions: { ROLE_USER: ['entity:*:read'] },
          role_hierarchy: { ROLE_ADMIN: ['ROLE_USER'] },
          role_labels: { ROLE_USER: 'User' }
        }
      })

      expect(adapter.getPermissions('ROLE_USER')).toEqual(['entity:*:read'])
      expect(adapter.getHierarchy()).toEqual({ ROLE_ADMIN: ['ROLE_USER'] })
      expect(adapter.getLabels()).toEqual({ ROLE_USER: 'User' })
    })

    it('returns empty array for unknown role', () => {
      const adapter = new PersistableRoleGranterAdapter()
      expect(adapter.getPermissions('ROLE_UNKNOWN')).toEqual([])
    })

    it('starts not loaded when no load function', () => {
      const adapter = new PersistableRoleGranterAdapter()
      expect(adapter.isLoaded).toBe(false)
    })
  })

  describe('load', () => {
    it('loads data from callback', async () => {
      const loadFn = vi.fn().mockResolvedValue({
        role_permissions: { ROLE_ADMIN: ['admin:**'] }
      })

      const adapter = new PersistableRoleGranterAdapter({
        load: loadFn,
        autoLoad: false
      })

      await adapter.load()

      expect(loadFn).toHaveBeenCalled()
      expect(adapter.getPermissions('ROLE_ADMIN')).toEqual(['admin:**'])
      expect(adapter.isLoaded).toBe(true)
    })

    it('handles sync load function', async () => {
      const adapter = new PersistableRoleGranterAdapter({
        load: () => ({ role_permissions: { ROLE_TEST: ['test:*'] } }),
        autoLoad: false
      })

      await adapter.load()

      expect(adapter.getPermissions('ROLE_TEST')).toEqual(['test:*'])
    })

    it('handles null from load (uses defaults)', async () => {
      const adapter = new PersistableRoleGranterAdapter({
        load: () => null,
        defaults: { role_permissions: { ROLE_USER: ['default:*'] } },
        autoLoad: false
      })

      await adapter.load()

      expect(adapter.getPermissions('ROLE_USER')).toEqual(['default:*'])
    })

    it('handles load error gracefully', async () => {
      const adapter = new PersistableRoleGranterAdapter({
        load: () => { throw new Error('Load failed') },
        defaults: { role_permissions: { ROLE_USER: ['fallback:*'] } },
        autoLoad: false
      })

      await adapter.load()

      expect(adapter.getPermissions('ROLE_USER')).toEqual(['fallback:*'])
      expect(adapter.isLoaded).toBe(true)
    })

    it('prevents concurrent loads', async () => {
      let loadCount = 0
      const adapter = new PersistableRoleGranterAdapter({
        load: async () => {
          loadCount++
          await new Promise(r => setTimeout(r, 10))
          return { role_permissions: { ROLE_USER: ['test:*'] } }
        },
        autoLoad: false
      })

      // Start two loads concurrently
      const p1 = adapter.load()
      const p2 = adapter.load()

      await Promise.all([p1, p2])

      expect(loadCount).toBe(1)
    })
  })

  describe('merge strategies', () => {
    const defaults = {
      role_permissions: { ROLE_USER: ['default:read'], ROLE_GUEST: ['guest:*'] },
      role_hierarchy: { ROLE_USER: ['ROLE_GUEST'] },
      role_labels: { ROLE_USER: 'Default User' }
    }

    const loaded = {
      role_permissions: { ROLE_USER: ['loaded:write'], ROLE_ADMIN: ['admin:*'] },
      role_hierarchy: { ROLE_ADMIN: ['ROLE_USER'] },
      role_labels: { ROLE_USER: 'Loaded User', ROLE_ADMIN: 'Admin' }
    }

    it('extend strategy merges loaded over defaults', async () => {
      const adapter = new PersistableRoleGranterAdapter({
        load: () => loaded,
        defaults,
        mergeStrategy: 'extend',
        autoLoad: false
      })

      await adapter.load()

      // Loaded takes priority for ROLE_USER
      expect(adapter.getPermissions('ROLE_USER')).toEqual(['loaded:write'])
      // Default ROLE_GUEST preserved
      expect(adapter.getPermissions('ROLE_GUEST')).toEqual(['guest:*'])
      // New ROLE_ADMIN from loaded
      expect(adapter.getPermissions('ROLE_ADMIN')).toEqual(['admin:*'])
      // Labels merged
      expect(adapter.getLabels()).toEqual({
        ROLE_USER: 'Loaded User',
        ROLE_ADMIN: 'Admin'
      })
    })

    it('replace strategy uses only loaded data', async () => {
      const adapter = new PersistableRoleGranterAdapter({
        load: () => loaded,
        defaults,
        mergeStrategy: 'replace',
        autoLoad: false
      })

      await adapter.load()

      // Only loaded data
      expect(adapter.getPermissions('ROLE_USER')).toEqual(['loaded:write'])
      expect(adapter.getPermissions('ROLE_GUEST')).toEqual([]) // Gone!
      expect(adapter.getPermissions('ROLE_ADMIN')).toEqual(['admin:*'])
    })

    it('defaults-only strategy ignores loaded data', async () => {
      const adapter = new PersistableRoleGranterAdapter({
        load: () => loaded,
        defaults,
        mergeStrategy: 'defaults-only',
        autoLoad: false
      })

      await adapter.load()

      // Only defaults
      expect(adapter.getPermissions('ROLE_USER')).toEqual(['default:read'])
      expect(adapter.getPermissions('ROLE_GUEST')).toEqual(['guest:*'])
      expect(adapter.getPermissions('ROLE_ADMIN')).toEqual([]) // Ignored
    })
  })

  describe('fixed permissions', () => {
    it('always includes fixed permissions regardless of loaded data', async () => {
      const adapter = new PersistableRoleGranterAdapter({
        fixed: {
          role_permissions: {
            ROLE_USER: ['auth:authenticated', 'auth:logout']
          }
        },
        defaults: {
          role_permissions: {
            ROLE_USER: ['default:read']
          }
        },
        load: () => ({
          role_permissions: {
            ROLE_USER: ['loaded:write']
          }
        }),
        autoLoad: false
      })

      // Before load: defaults + fixed
      expect(adapter.getPermissions('ROLE_USER')).toContain('default:read')
      expect(adapter.getPermissions('ROLE_USER')).toContain('auth:authenticated')
      expect(adapter.getPermissions('ROLE_USER')).toContain('auth:logout')

      // After load: loaded + fixed (loaded replaces defaults in extend mode)
      await adapter.load()
      expect(adapter.getPermissions('ROLE_USER')).toContain('loaded:write')
      expect(adapter.getPermissions('ROLE_USER')).toContain('auth:authenticated')
      expect(adapter.getPermissions('ROLE_USER')).toContain('auth:logout')
      expect(adapter.getPermissions('ROLE_USER')).not.toContain('default:read')
    })

    it('fixed permissions survive replace merge strategy', async () => {
      const adapter = new PersistableRoleGranterAdapter({
        fixed: {
          role_permissions: {
            ROLE_ANONYMOUS: ['auth:login']
          }
        },
        load: () => ({
          role_permissions: {
            ROLE_USER: ['user:perm']
          }
        }),
        mergeStrategy: 'replace',
        autoLoad: false
      })

      await adapter.load()

      // ROLE_ANONYMOUS only has fixed permissions
      expect(adapter.getPermissions('ROLE_ANONYMOUS')).toEqual(['auth:login'])
      // ROLE_USER only has loaded permissions
      expect(adapter.getPermissions('ROLE_USER')).toEqual(['user:perm'])
    })

    it('getRoles includes roles from fixed', () => {
      const adapter = new PersistableRoleGranterAdapter({
        fixed: {
          role_permissions: { ROLE_ANONYMOUS: ['auth:login'] }
        },
        defaults: {
          role_permissions: { ROLE_USER: ['default:*'] }
        }
      })

      const roles = adapter.getRoles()
      expect(roles).toContain('ROLE_ANONYMOUS')
      expect(roles).toContain('ROLE_USER')
    })

    it('getHierarchy merges fixed hierarchy', () => {
      const adapter = new PersistableRoleGranterAdapter({
        fixed: {
          role_hierarchy: { ROLE_SYSTEM: ['ROLE_ROOT'] }
        },
        defaults: {
          role_hierarchy: { ROLE_ADMIN: ['ROLE_USER'] }
        }
      })

      const hierarchy = adapter.getHierarchy()
      expect(hierarchy).toEqual({
        ROLE_ADMIN: ['ROLE_USER'],
        ROLE_SYSTEM: ['ROLE_ROOT']
      })
    })

    it('getLabels merges fixed labels', () => {
      const adapter = new PersistableRoleGranterAdapter({
        fixed: {
          role_labels: { ROLE_ANONYMOUS: 'Anonymous' }
        },
        defaults: {
          role_labels: { ROLE_USER: 'User' }
        }
      })

      const labels = adapter.getLabels()
      expect(labels).toEqual({
        ROLE_USER: 'User',
        ROLE_ANONYMOUS: 'Anonymous'
      })
    })

    it('deduplicates permissions when fixed overlaps with loaded', async () => {
      const adapter = new PersistableRoleGranterAdapter({
        fixed: {
          role_permissions: { ROLE_USER: ['auth:logout', 'shared:perm'] }
        },
        load: () => ({
          role_permissions: { ROLE_USER: ['shared:perm', 'loaded:perm'] }
        }),
        autoLoad: false
      })

      await adapter.load()
      const perms = adapter.getPermissions('ROLE_USER')

      // Should not have duplicates
      expect(perms.filter(p => p === 'shared:perm').length).toBe(1)
      expect(perms).toContain('auth:logout')
      expect(perms).toContain('loaded:perm')
    })
  })

  describe('persist', () => {
    it('calls persist callback with current data', async () => {
      const persistFn = vi.fn()
      const adapter = new PersistableRoleGranterAdapter({
        persist: persistFn,
        defaults: {
          role_permissions: { ROLE_USER: ['entity:*:read'] }
        }
      })

      await adapter.persist()

      expect(persistFn).toHaveBeenCalledWith({
        role_hierarchy: {},
        role_permissions: { ROLE_USER: ['entity:*:read'] },
        role_labels: {}
      })
    })

    it('clears dirty flag after persist', async () => {
      const adapter = new PersistableRoleGranterAdapter({
        persist: vi.fn()
      })

      adapter.setRolePermissions('ROLE_TEST', ['test:*'])
      expect(adapter.isDirty).toBe(true)

      await adapter.persist()
      expect(adapter.isDirty).toBe(false)
    })

    it('throws on persist error', async () => {
      const adapter = new PersistableRoleGranterAdapter({
        persist: () => { throw new Error('Persist failed') }
      })

      await expect(adapter.persist()).rejects.toThrow('Persist failed')
    })
  })

  describe('mutation methods', () => {
    let adapter

    beforeEach(() => {
      adapter = new PersistableRoleGranterAdapter({
        defaults: {
          role_permissions: { ROLE_USER: ['read', 'list'] }
        }
      })
    })

    it('setRolePermissions replaces permissions', () => {
      adapter.setRolePermissions('ROLE_USER', ['new:perm'])
      expect(adapter.getPermissions('ROLE_USER')).toEqual(['new:perm'])
      expect(adapter.isDirty).toBe(true)
    })

    it('addRolePermissions adds new permissions', () => {
      adapter.addRolePermissions('ROLE_USER', ['create', 'list'])
      expect(adapter.getPermissions('ROLE_USER')).toEqual(['read', 'list', 'create'])
    })

    it('removeRolePermissions removes permissions', () => {
      adapter.removeRolePermissions('ROLE_USER', ['list'])
      expect(adapter.getPermissions('ROLE_USER')).toEqual(['read'])
    })

    it('setRoleHierarchy sets hierarchy', () => {
      adapter.setRoleHierarchy('ROLE_ADMIN', ['ROLE_USER'])
      expect(adapter.getHierarchy()).toEqual({ ROLE_ADMIN: ['ROLE_USER'] })
    })

    it('setRoleLabel sets label', () => {
      adapter.setRoleLabel('ROLE_USER', 'Standard User')
      expect(adapter.getLabels()).toEqual({ ROLE_USER: 'Standard User' })
    })

    it('deleteRole removes all role data', () => {
      adapter.setRoleHierarchy('ROLE_USER', ['ROLE_GUEST'])
      adapter.setRoleLabel('ROLE_USER', 'User')

      adapter.deleteRole('ROLE_USER')

      expect(adapter.getPermissions('ROLE_USER')).toEqual([])
      expect(adapter.getHierarchy()).toEqual({})
      expect(adapter.getLabels()).toEqual({})
    })

    it('reset restores defaults', () => {
      adapter.setRolePermissions('ROLE_USER', ['modified'])
      adapter.setRolePermissions('ROLE_NEW', ['new:perm'])

      adapter.reset()

      expect(adapter.getPermissions('ROLE_USER')).toEqual(['read', 'list'])
      expect(adapter.getPermissions('ROLE_NEW')).toEqual([])
    })

    it('methods are chainable', () => {
      const result = adapter
        .setRolePermissions('ROLE_ADMIN', ['admin:*'])
        .setRoleHierarchy('ROLE_ADMIN', ['ROLE_USER'])
        .setRoleLabel('ROLE_ADMIN', 'Administrator')

      expect(result).toBe(adapter)
    })
  })

  describe('getRoles', () => {
    it('returns all defined roles', () => {
      const adapter = new PersistableRoleGranterAdapter({
        defaults: {
          role_permissions: {
            ROLE_USER: ['read'],
            ROLE_ADMIN: ['admin:*']
          }
        }
      })

      expect(adapter.getRoles()).toEqual(['ROLE_USER', 'ROLE_ADMIN'])
    })
  })

  describe('toJSON', () => {
    it('returns current config as object', () => {
      const adapter = new PersistableRoleGranterAdapter({
        defaults: {
          role_permissions: { ROLE_USER: ['read'] },
          role_hierarchy: { ROLE_ADMIN: ['ROLE_USER'] },
          role_labels: { ROLE_USER: 'User' }
        }
      })

      expect(adapter.toJSON()).toEqual({
        role_permissions: { ROLE_USER: ['read'] },
        role_hierarchy: { ROLE_ADMIN: ['ROLE_USER'] },
        role_labels: { ROLE_USER: 'User' }
      })
    })
  })

  describe('anonymousRole', () => {
    it('always returns ROLE_ANONYMOUS (convention)', () => {
      const adapter = new PersistableRoleGranterAdapter()
      expect(adapter.getAnonymousRole()).toBe('ROLE_ANONYMOUS')
    })

    it('works with fixed permissions for ROLE_ANONYMOUS', () => {
      const adapter = new PersistableRoleGranterAdapter({
        fixed: {
          role_permissions: {
            ROLE_ANONYMOUS: ['auth:login', 'auth:register']
          }
        }
      })

      expect(adapter.getAnonymousRole()).toBe('ROLE_ANONYMOUS')
      expect(adapter.getPermissions('ROLE_ANONYMOUS')).toEqual(['auth:login', 'auth:register'])
      expect(adapter.getRoles()).toContain('ROLE_ANONYMOUS')
    })
  })

  describe('ensureReady', () => {
    it('loads if not loaded and autoLoad enabled', async () => {
      const loadFn = vi.fn().mockResolvedValue({
        role_permissions: { ROLE_USER: ['loaded:*'] }
      })

      const adapter = new PersistableRoleGranterAdapter({
        load: loadFn,
        autoLoad: true
      })

      await adapter.ensureReady()

      expect(loadFn).toHaveBeenCalled()
      expect(adapter.isLoaded).toBe(true)
    })

    it('returns self for chaining', async () => {
      const adapter = new PersistableRoleGranterAdapter()
      const result = await adapter.ensureReady()
      expect(result).toBe(adapter)
    })
  })
})

describe('createLocalStorageRoleGranter', () => {
  beforeEach(() => {
    // Mock localStorage
    const store = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(k => store[k] || null),
      setItem: vi.fn((k, v) => { store[k] = v }),
      removeItem: vi.fn(k => { delete store[k] })
    })
  })

  it('creates adapter with localStorage callbacks', async () => {
    const adapter = createLocalStorageRoleGranter({
      key: 'test_roles',
      defaults: { role_permissions: { ROLE_USER: ['default:*'] } }
    })

    expect(adapter).toBeInstanceOf(PersistableRoleGranterAdapter)

    await adapter.load()
    expect(localStorage.getItem).toHaveBeenCalledWith('test_roles')
  })

  it('persists to localStorage', async () => {
    const adapter = createLocalStorageRoleGranter({
      key: 'test_roles'
    })

    adapter.setRolePermissions('ROLE_ADMIN', ['admin:**'])
    await adapter.persist()

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'test_roles',
      expect.stringContaining('ROLE_ADMIN')
    )
  })

  it('uses default key qdadm_roles', () => {
    const adapter = createLocalStorageRoleGranter()
    adapter.load()
    expect(localStorage.getItem).toHaveBeenCalledWith('qdadm_roles')
  })
})
