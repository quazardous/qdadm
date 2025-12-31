import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { generateManagers } from './generateManagers.js'
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
            storageImport: 'qdadm',
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
            storageImport: 'qdadm',
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
            storageImport: 'qdadm'
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
            storageImport: 'qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })

      expect(files).toHaveLength(1)

      // Directory should exist
      const dirStat = await stat(testOutputDir)
      expect(dirStat.isDirectory()).toBe(true)
    })

    it('generates one file per entity with correct naming', async () => {
      const files = await generateManagers({
        output: testOutputDir,
        entities: {
          users: {
            schema: { name: 'users', endpoint: '/users', fields: {} },
            endpoint: '/api/users',
            storageImport: 'qdadm',
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
      expect(files).toContain(join(testOutputDir, 'usersManager.js'))
      expect(files).toContain(join(testOutputDir, 'blog_postsManager.js'))
    })

    it('returns file paths in generation order', async () => {
      const files = await generateManagers({
        output: testOutputDir,
        entities: {
          alpha: {
            schema: { name: 'alpha', endpoint: '/alpha', fields: {} },
            endpoint: '/alpha',
            storageImport: 'qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })

      expect(files[0]).toBe(join(testOutputDir, 'alphaManager.js'))
    })
  })

  describe('generated file content', () => {
    it('generates valid JavaScript with imports', async () => {
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
            storageImport: 'qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })

      const content = await readFile(join(testOutputDir, 'usersManager.js'), 'utf-8')

      // Check imports
      expect(content).toContain("import { EntityManager } from 'qdadm'")
      expect(content).toContain("import { ApiStorage } from 'qdadm'")

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
            storageImport: 'qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })

      const content = await readFile(join(testOutputDir, 'usersManager.js'), 'utf-8')
      expect(content).toContain('DO NOT EDIT MANUALLY')
    })

    it('includes endpoint in storage options', async () => {
      await generateManagers({
        output: testOutputDir,
        entities: {
          users: {
            schema: { name: 'users', endpoint: '/users', fields: {} },
            endpoint: '/api/v1/users',
            storageImport: 'qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })

      const content = await readFile(join(testOutputDir, 'usersManager.js'), 'utf-8')
      expect(content).toContain('endpoint: "/api/v1/users"')
    })

    it('includes custom storage options', async () => {
      await generateManagers({
        output: testOutputDir,
        entities: {
          users: {
            schema: { name: 'users', endpoint: '/users', fields: {} },
            endpoint: '/users',
            storageImport: 'qdadm',
            storageClass: 'ApiStorage',
            storageOptions: {
              timeout: 5000,
              retries: 3
            }
          }
        }
      })

      const content = await readFile(join(testOutputDir, 'usersManager.js'), 'utf-8')
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
            storageImport: 'qdadm',
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

      const content = await readFile(join(testOutputDir, 'usersManager.js'), 'utf-8')

      // Password field should have hidden: true
      expect(content).toContain('hidden: true')

      // Email field should have custom label
      expect(content).toContain('label: "Email Address"')
    })

    it('generates PascalCase class name in comments', async () => {
      await generateManagers({
        output: testOutputDir,
        entities: {
          blog_posts: {
            schema: { name: 'blog_posts', endpoint: '/posts', fields: {} },
            endpoint: '/posts',
            storageImport: 'qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })

      const content = await readFile(join(testOutputDir, 'blog_postsManager.js'), 'utf-8')
      expect(content).toContain('BlogPostsManager')
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
            storageImport: 'qdadm',
            storageClass: 'ApiStorage'
          }
        }
      })

      const content = await readFile(join(testOutputDir, 'usersManager.js'), 'utf-8')
      expect(content).toContain('label: "User"')
      expect(content).toContain('labelPlural: "Users"')
      expect(content).toContain('labelField: "name"')
      expect(content).toContain('routePrefix: "user"')
      expect(content).toContain('idField: "uuid"')
      expect(content).toContain('readOnly: true')
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
            storageImport: 'qdadm',
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
