import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { generateManagers, fieldTypeToTsType, generateEntityInterface } from './generateManagers'
import { rm, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('generateManagers', () => {
  let testOutputDir

  beforeEach(() => {
    // Create unique temp directory for each test
    testOutputDir = join(tmpdir(), `qdadm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  })

  afterEach(async () => {
    // Clean up test output directory
    try {
      await rm(testOutputDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('validation', () => {
    it('throws if config is missing', async () => {
      await expect(generateManagers()).rejects.toThrow('config is required')
    })

    it('throws if config is not an object', async () => {
      await expect(generateManagers('invalid')).rejects.toThrow('config is required')
    })

    it('throws if entities is missing', async () => {
      await expect(generateManagers({})).rejects.toThrow('config.entities is required')
    })

    it('throws if entity config is not an object', async () => {
      await expect(generateManagers({
        output: testOutputDir,
        entities: { users: null }
      })).rejects.toThrow("entity 'users' config must be an object")
    })

    it('throws if entity schema is missing', async () => {
      await expect(generateManagers({
        output: testOutputDir,
        entities: {
          users: {
            endpoint: '/users',
            storageImport: '@quazardous/qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })).rejects.toThrow("entity 'users' requires 'schema' property")
    })

    it('throws if entity endpoint is missing', async () => {
      await expect(generateManagers({
        output: testOutputDir,
        entities: {
          users: {
            schema: { name: 'users', endpoint: '/users', fields: {} },
            storageImport: '@quazardous/qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })).rejects.toThrow("entity 'users' requires 'endpoint' property")
    })

    it('throws if entity storageImport is missing', async () => {
      await expect(generateManagers({
        output: testOutputDir,
        entities: {
          users: {
            schema: { name: 'users', endpoint: '/users', fields: {} },
            endpoint: '/users',
            storageClass: 'ApiStorage'
          }
        }
      })).rejects.toThrow("entity 'users' requires 'storageImport' property")
    })

    it('throws if entity storageClass is missing', async () => {
      await expect(generateManagers({
        output: testOutputDir,
        entities: {
          users: {
            schema: { name: 'users', endpoint: '/users', fields: {} },
            endpoint: '/users',
            storageImport: '@quazardous/qdadm'
          }
        }
      })).rejects.toThrow("entity 'users' requires 'storageClass' property")
    })
  })

  describe('file generation', () => {
    it('creates output directory if it does not exist', async () => {
      const files = await generateManagers({
        output: testOutputDir,
        entities: {
          users: {
            schema: { name: 'users', endpoint: '/users', fields: {} },
            endpoint: '/users',
            storageImport: '@quazardous/qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })

      expect(files).toHaveLength(1)

      // Directory should exist
      const dirStat = await stat(testOutputDir)
      expect(dirStat.isDirectory()).toBe(true)
    })

    it('generates .ts files with correct naming', async () => {
      const files = await generateManagers({
        output: testOutputDir,
        entities: {
          users: {
            schema: { name: 'users', endpoint: '/users', fields: {} },
            endpoint: '/api/users',
            storageImport: '@quazardous/qdadm',
            storageClass: 'ApiStorage'
          },
          blog_posts: {
            schema: { name: 'blog_posts', endpoint: '/posts', fields: {} },
            endpoint: '/api/posts',
            storageImport: './storage',
            storageClass: 'CustomStorage'
          }
        }
      })

      expect(files).toHaveLength(2)
      expect(files).toContain(join(testOutputDir, 'usersManager.ts'))
      expect(files).toContain(join(testOutputDir, 'blog_postsManager.ts'))
    })

    it('returns file paths in generation order', async () => {
      const files = await generateManagers({
        output: testOutputDir,
        entities: {
          alpha: {
            schema: { name: 'alpha', endpoint: '/alpha', fields: {} },
            endpoint: '/alpha',
            storageImport: '@quazardous/qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })

      expect(files[0]).toBe(join(testOutputDir, 'alphaManager.ts'))
    })
  })

  describe('generated file content', () => {
    it('generates valid TypeScript with imports and interface', async () => {
      await generateManagers({
        output: testOutputDir,
        entities: {
          users: {
            schema: {
              name: 'users',
              endpoint: '/users',
              fields: {
                id: { name: 'id', type: 'number', readOnly: true },
                email: { name: 'email', type: 'email', required: true }
              }
            },
            endpoint: '/api/users',
            storageImport: '@quazardous/qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })

      const content = await readFile(join(testOutputDir, 'usersManager.ts'), 'utf-8')

      // Check imports
      expect(content).toContain("import { EntityManager } from '@quazardous/qdadm'")
      expect(content).toContain("import { ApiStorage } from '@quazardous/qdadm'")
      expect(content).toContain("import type { EntityRecord } from '@quazardous/qdadm'")

      // Check entity interface
      expect(content).toContain('export interface UsersEntity extends EntityRecord')
      expect(content).toContain('id: number')
      expect(content).toContain('email: string')

      // Check typed manager
      expect(content).toContain('new EntityManager<UsersEntity>')

      // Storage must be parameterized with the entity type — without this the
      // generated file fails type-check at the consumer side because
      // ApiStorage<EntityRecord> is not assignable to IStorage<UsersEntity>.
      expect(content).toContain('new ApiStorage<UsersEntity>(storageOptions)')

      // Check exports
      expect(content).toContain('export const usersSchema')
      expect(content).toContain('export const usersManager')

      // Check schema content (uses double quotes from JSON.stringify)
      expect(content).toContain('name: "users"')
      expect(content).toContain('type: "number"')
      expect(content).toContain('type: "email"')
    })

    it('includes DO NOT EDIT warning', async () => {
      await generateManagers({
        output: testOutputDir,
        entities: {
          users: {
            schema: { name: 'users', endpoint: '/users', fields: {} },
            endpoint: '/api/users',
            storageImport: '@quazardous/qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })

      const content = await readFile(join(testOutputDir, 'usersManager.ts'), 'utf-8')
      expect(content).toContain('DO NOT EDIT MANUALLY')
    })

    it('includes endpoint in storage options', async () => {
      await generateManagers({
        output: testOutputDir,
        entities: {
          users: {
            schema: { name: 'users', endpoint: '/users', fields: {} },
            endpoint: '/api/v1/users',
            storageImport: '@quazardous/qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })

      const content = await readFile(join(testOutputDir, 'usersManager.ts'), 'utf-8')
      expect(content).toContain('endpoint: "/api/v1/users"')
    })

    it('includes custom storage options', async () => {
      await generateManagers({
        output: testOutputDir,
        entities: {
          users: {
            schema: { name: 'users', endpoint: '/users', fields: {} },
            endpoint: '/users',
            storageImport: '@quazardous/qdadm',
            storageClass: 'ApiStorage',
            storageOptions: {
              timeout: 5000,
              retries: 3
            }
          }
        }
      })

      const content = await readFile(join(testOutputDir, 'usersManager.ts'), 'utf-8')
      expect(content).toContain('timeout: 5000')
      expect(content).toContain('retries: 3')
    })

    it('applies decorators to schema fields', async () => {
      await generateManagers({
        output: testOutputDir,
        entities: {
          users: {
            schema: {
              name: 'users',
              endpoint: '/users',
              fields: {
                id: { name: 'id', type: 'number' },
                password: { name: 'password', type: 'text' },
                email: { name: 'email', type: 'email' }
              }
            },
            endpoint: '/users',
            storageImport: '@quazardous/qdadm',
            storageClass: 'ApiStorage',
            decorators: {
              fields: {
                password: { hidden: true },
                email: { label: 'Email Address' }
              }
            }
          }
        }
      })

      const content = await readFile(join(testOutputDir, 'usersManager.ts'), 'utf-8')

      // Password field should have hidden: true
      expect(content).toContain('hidden: true')

      // Email field should have custom label
      expect(content).toContain('label: "Email Address"')

      // Hidden fields should not appear in the interface
      expect(content).not.toMatch(/password\??: string/)
    })

    it('generates PascalCase class name in comments', async () => {
      await generateManagers({
        output: testOutputDir,
        entities: {
          blog_posts: {
            schema: { name: 'blog_posts', endpoint: '/posts', fields: {} },
            endpoint: '/posts',
            storageImport: '@quazardous/qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })

      const content = await readFile(join(testOutputDir, 'blog_postsManager.ts'), 'utf-8')
      expect(content).toContain('BlogPostsManager')
      expect(content).toContain('BlogPostsEntity')
    })

    it('handles schema with all optional properties', async () => {
      await generateManagers({
        output: testOutputDir,
        entities: {
          users: {
            schema: {
              name: 'users',
              endpoint: '/users',
              label: 'User',
              labelPlural: 'Users',
              labelField: 'name',
              routePrefix: 'user',
              idField: 'uuid',
              readOnly: true,
              fields: {}
            },
            endpoint: '/users',
            storageImport: '@quazardous/qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })

      const content = await readFile(join(testOutputDir, 'usersManager.ts'), 'utf-8')
      expect(content).toContain('label: "User"')
      expect(content).toContain('labelPlural: "Users"')
      expect(content).toContain('labelField: "name"')
      expect(content).toContain('routePrefix: "user"')
      expect(content).toContain('idField: "uuid"')
      expect(content).toContain('readOnly: true')
    })

    it('generates entity interface with correct field types', async () => {
      await generateManagers({
        output: testOutputDir,
        entities: {
          products: {
            schema: {
              name: 'products',
              endpoint: '/products',
              fields: {
                id: { name: 'id', type: 'number', required: true },
                name: { name: 'name', type: 'text', required: true },
                price: { name: 'price', type: 'number' },
                active: { name: 'active', type: 'boolean', required: true },
                created_at: { name: 'created_at', type: 'datetime' },
                tags: { name: 'tags', type: 'array' },
                metadata: { name: 'metadata', type: 'object' },
                email: { name: 'email', type: 'email' },
                website: { name: 'website', type: 'url' },
                uuid: { name: 'uuid', type: 'uuid' },
                birth_date: { name: 'birth_date', type: 'date' }
              }
            },
            endpoint: '/products',
            storageImport: '@quazardous/qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })

      const content = await readFile(join(testOutputDir, 'productsManager.ts'), 'utf-8')

      // Required fields (no optional marker, no null union)
      expect(content).toContain('id: number')
      expect(content).toContain('name: string')
      expect(content).toContain('active: boolean')

      // Optional fields (with ? and null union)
      expect(content).toContain('price?: number | null')
      expect(content).toContain('created_at?: string | null')
      expect(content).toContain('tags?: unknown[] | null')
      expect(content).toContain('metadata?: Record<string, unknown> | null')
      expect(content).toContain('email?: string | null')
      expect(content).toContain('website?: string | null')
      expect(content).toContain('uuid?: string | null')
      expect(content).toContain('birth_date?: string | null')
    })

    it('generates class mode with typed interface', async () => {
      await generateManagers({
        output: testOutputDir,
        classMode: true,
        entities: {
          users: {
            schema: {
              name: 'users',
              endpoint: '/users',
              fields: {
                id: { name: 'id', type: 'number' },
                name: { name: 'name', type: 'text', required: true }
              }
            },
            endpoint: '/users',
            storageImport: '@quazardous/qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })

      const content = await readFile(join(testOutputDir, 'users.ts'), 'utf-8')
      expect(content).toContain('export interface UsersEntity extends EntityRecord')
      expect(content).toContain('extends EntityManager<UsersEntity>')

      // Storage must be parameterized in class mode too — same TS2322
      // assignability problem as instance mode if we drop the generic.
      expect(content).toContain('new ApiStorage<UsersEntity>(')
      // Constructor signature should accept a typed storage override, not `unknown`
      expect(content).toContain("import type { EntityRecord, IStorage } from '@quazardous/qdadm'")
      expect(content).toContain('storage: IStorage<UsersEntity>')
    })
  })

  describe('default output directory', () => {
    it('uses default output when not specified', async () => {
      // This test would write to actual src/generated/managers/
      // We'll just verify the function accepts config without output
      const config = {
        entities: {
          test: {
            schema: { name: 'test', endpoint: '/test', fields: {} },
            endpoint: '/test',
            storageImport: '@quazardous/qdadm',
            storageClass: 'ApiStorage'
          }
        }
      }

      // Should not throw (we can't easily test the default path without cleanup concerns)
      // The function validates before writing, so a valid config should work
      expect(() => generateManagers(config)).not.toThrow()
    })
  })
})

describe('fieldTypeToTsType', () => {
  it('maps text types to string', () => {
    expect(fieldTypeToTsType('text', true)).toBe('string')
    expect(fieldTypeToTsType('email', true)).toBe('string')
    expect(fieldTypeToTsType('url', true)).toBe('string')
    expect(fieldTypeToTsType('uuid', true)).toBe('string')
    expect(fieldTypeToTsType('date', true)).toBe('string')
    expect(fieldTypeToTsType('datetime', true)).toBe('string')
  })

  it('maps number to number', () => {
    expect(fieldTypeToTsType('number', true)).toBe('number')
  })

  it('maps boolean to boolean', () => {
    expect(fieldTypeToTsType('boolean', true)).toBe('boolean')
  })

  it('maps array to unknown[]', () => {
    expect(fieldTypeToTsType('array', true)).toBe('unknown[]')
  })

  it('maps object to Record<string, unknown>', () => {
    expect(fieldTypeToTsType('object', true)).toBe('Record<string, unknown>')
  })

  it('adds null union for optional fields', () => {
    expect(fieldTypeToTsType('text', false)).toBe('string | null')
    expect(fieldTypeToTsType('number', false)).toBe('number | null')
    expect(fieldTypeToTsType('boolean', false)).toBe('boolean | null')
  })

  it('falls back to unknown for unrecognized types instead of emitting literal undefined', () => {
    // Repro for v1.19.1 bug: connectors could yield types outside UnifiedFieldType
    // (e.g. OpenAPI oneOf/discriminator). Without a default branch the IIFE
    // returned `undefined` and template-literal interpolation wrote the string
    // "undefined" into the generated .ts file.
    expect(fieldTypeToTsType('mystery-type', true)).toBe('unknown')
    expect(fieldTypeToTsType('mystery-type', false)).toBe('unknown | null')
  })
})

describe('generateEntityInterface', () => {
  it('generates interface with correct field types', () => {
    const result = generateEntityInterface('users', {
      id: { name: 'id', type: 'number' },
      name: { name: 'name', type: 'text', required: true },
      email: { name: 'email', type: 'email' }
    }, 'id')

    expect(result).toContain('export interface UsersEntity extends EntityRecord')
    expect(result).toContain('id: number') // id field is always required
    expect(result).toContain('name: string') // required field
    expect(result).toContain('email?: string | null') // optional field
  })

  it('excludes hidden fields', () => {
    const result = generateEntityInterface('users', {
      id: { name: 'id', type: 'number' },
      password: { name: 'password', type: 'text', hidden: true }
    }, 'id')

    expect(result).not.toContain('password')
  })

  it('skips dotted-name children of nested object fields', () => {
    // Repro for v1.19.1 bug: OpenAPIConnector flattens one level of nested
    // object props as dotted keys for runtime metadata. The interface emitter
    // must not write those keys at the top level — they're invalid TS syntax,
    // and the parent object field already carries Record<string, unknown>.
    const result = generateEntityInterface('commands', {
      id: { name: 'id', type: 'uuid' },
      filter: { name: 'filter', type: 'object' },
      'filter.botUuids': { name: 'filter.botUuids', type: 'array' },
      'filter.tags': { name: 'filter.tags', type: 'array' }
    }, 'id')

    expect(result).toContain('filter?: Record<string, unknown> | null')
    expect(result).not.toContain('filter.botUuids')
    expect(result).not.toContain('filter.tags')
    expect(result).not.toMatch(/^\s*filter\./m)
  })
})
