import { describe, it, expect, beforeEach } from 'vitest'
import { PermissionRegistry } from '../../src/security/PermissionRegistry'

describe('PermissionRegistry', () => {
  let registry

  beforeEach(() => {
    registry = new PermissionRegistry()
  })

  describe('register', () => {
    it('registers permissions with string labels', () => {
      registry.register('auth', {
        impersonate: 'Impersonate users',
        logout: 'Force logout'
      })

      expect(registry.exists('auth:impersonate')).toBe(true)
      expect(registry.exists('auth:logout')).toBe(true)
      expect(registry.get('auth:impersonate').label).toBe('Impersonate users')
    })

    it('registers permissions with object meta', () => {
      registry.register('books', {
        checkout: {
          label: 'Checkout Book',
          description: 'Borrow a book from library'
        }
      }, { isEntity: true })

      const perm = registry.get('entity:books:checkout')
      expect(perm.label).toBe('Checkout Book')
      expect(perm.description).toBe('Borrow a book from library')
    })

    it('prefixes with entity: when isEntity=true', () => {
      registry.register('books', { read: 'Read' }, { isEntity: true })
      expect(registry.exists('entity:books:read')).toBe(true)
      expect(registry.exists('books:read')).toBe(false)
    })

    it('does NOT prefix when isEntity is not set', () => {
      registry.register('admin', { config: 'Config' })
      expect(registry.exists('admin:config')).toBe(true)
      expect(registry.exists('entity:admin:config')).toBe(false)
    })

    it('tracks module name', () => {
      registry.register('auth', { login: 'Login' }, { module: 'AuthModule' })
      expect(registry.get('auth:login').module).toBe('AuthModule')
    })
  })

  describe('registerEntity', () => {
    it('registers standard CRUD permissions', () => {
      registry.registerEntity('books')

      expect(registry.exists('entity:books:read')).toBe(true)
      expect(registry.exists('entity:books:list')).toBe(true)
      expect(registry.exists('entity:books:create')).toBe(true)
      expect(registry.exists('entity:books:update')).toBe(true)
      expect(registry.exists('entity:books:delete')).toBe(true)
    })

    it('generates descriptive labels', () => {
      registry.registerEntity('books')
      expect(registry.get('entity:books:read').label).toBe('Read books')
      expect(registry.get('entity:books:create').label).toBe('Create books')
    })

    it('tracks module name', () => {
      registry.registerEntity('books', { module: 'BooksModule' })
      expect(registry.get('entity:books:read').module).toBe('BooksModule')
    })

    it('allows custom actions', () => {
      registry.registerEntity('orders', { actions: ['read', 'process', 'cancel'] })
      expect(registry.exists('entity:orders:read')).toBe(true)
      expect(registry.exists('entity:orders:process')).toBe(true)
      expect(registry.exists('entity:orders:cancel')).toBe(true)
      expect(registry.exists('entity:orders:create')).toBe(false)
    })

    it('registers entity-own permissions when hasOwnership is true', () => {
      registry.registerEntity('loans', { hasOwnership: true })

      // Standard entity permissions
      expect(registry.exists('entity:loans:read')).toBe(true)
      expect(registry.exists('entity:loans:create')).toBe(true)

      // Ownership permissions (excludes list and create by default)
      expect(registry.exists('entity-own:loans:read')).toBe(true)
      expect(registry.exists('entity-own:loans:update')).toBe(true)
      expect(registry.exists('entity-own:loans:delete')).toBe(true)
      expect(registry.exists('entity-own:loans:list')).toBe(false)
      expect(registry.exists('entity-own:loans:create')).toBe(false)
    })

    it('generates descriptive labels for ownership permissions', () => {
      registry.registerEntity('loans', { hasOwnership: true })

      expect(registry.get('entity-own:loans:read').label).toBe('Read own loans')
      expect(registry.get('entity-own:loans:update').label).toBe('Update own loans')
    })

    it('allows custom ownActions', () => {
      registry.registerEntity('tasks', {
        hasOwnership: true,
        ownActions: ['read', 'update', 'close']
      })

      expect(registry.exists('entity-own:tasks:read')).toBe(true)
      expect(registry.exists('entity-own:tasks:update')).toBe(true)
      expect(registry.exists('entity-own:tasks:close')).toBe(true)
      expect(registry.exists('entity-own:tasks:delete')).toBe(false)
    })

    it('does not register entity-own permissions when hasOwnership is false', () => {
      registry.registerEntity('books', { hasOwnership: false })

      expect(registry.exists('entity:books:read')).toBe(true)
      expect(registry.exists('entity-own:books:read')).toBe(false)
    })
  })

  describe('query methods', () => {
    beforeEach(() => {
      registry.registerEntity('books', { module: 'BooksModule' })
      registry.registerEntity('loans', { module: 'LoansModule' })
      registry.register('auth', { impersonate: 'Impersonate' }, { module: 'AuthModule' })
      registry.register('admin:config', { view: 'View', edit: 'Edit' })
    })

    it('getAll returns all permissions', () => {
      const all = registry.getAll()
      expect(all.length).toBe(13) // 5 + 5 + 1 + 2
    })

    it('getKeys returns all keys', () => {
      const keys = registry.getKeys()
      expect(keys).toContain('entity:books:read')
      expect(keys).toContain('auth:impersonate')
      expect(keys).toContain('admin:config:view')
    })

    it('getGrouped groups by namespace', () => {
      const grouped = registry.getGrouped()
      expect(Object.keys(grouped)).toContain('entity:books')
      expect(Object.keys(grouped)).toContain('entity:loans')
      expect(Object.keys(grouped)).toContain('auth')
      expect(Object.keys(grouped)).toContain('admin:config')
      expect(grouped['entity:books'].length).toBe(5)
    })

    it('getByNamespace filters by namespace', () => {
      const entityPerms = registry.getByNamespace('entity')
      expect(entityPerms.length).toBe(10) // books + loans
    })

    it('getByModule filters by module', () => {
      const booksPerms = registry.getByModule('BooksModule')
      expect(booksPerms.length).toBe(5)
    })

    it('getEntityPermissions returns only entity perms', () => {
      const entityPerms = registry.getEntityPermissions()
      expect(entityPerms.length).toBe(10)
      expect(entityPerms.every(p => p.namespace.startsWith('entity:'))).toBe(true)
    })

    it('getSystemPermissions returns non-entity perms', () => {
      const systemPerms = registry.getSystemPermissions()
      expect(systemPerms.length).toBe(3)
      expect(systemPerms.every(p => !p.namespace.startsWith('entity:'))).toBe(true)
    })
  })

  describe('unregister', () => {
    it('removes all permissions for a namespace', () => {
      registry.registerEntity('books')
      expect(registry.size).toBe(5)

      registry.unregister('entity:books')
      expect(registry.size).toBe(0)
    })
  })

  describe('size', () => {
    it('returns count of registered permissions', () => {
      expect(registry.size).toBe(0)
      registry.registerEntity('books')
      expect(registry.size).toBe(5)
    })
  })
})
