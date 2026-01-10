import { describe, it, expect } from 'vitest'
import { OpenAPIConnector } from './OpenAPIConnector.js'
import sampleSpec from './__fixtures__/sample-openapi.json'

describe('OpenAPIConnector', () => {
  describe('parse()', () => {
    describe('entity extraction', () => {
      it('extracts entities from standard REST paths', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const entityNames = result.map(e => e.name)
        expect(entityNames).toContain('users')
        expect(entityNames).toContain('posts')
        expect(entityNames).toContain('categories')
      })

      it('extracts correct endpoints for entities', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        const posts = result.find(e => e.name === 'posts')

        expect(users.endpoint).toBe('/api/users')
        expect(posts.endpoint).toBe('/api/posts')
      })

      it('does not extract non-matching paths', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        // /internal/metrics should not match default patterns
        const entityNames = result.map(e => e.name)
        expect(entityNames).not.toContain('internal')
        expect(entityNames).not.toContain('metrics')
      })

      it('extracts fields from response schemas', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields.id).toBeDefined()
        expect(users.fields.email).toBeDefined()
        expect(users.fields.name).toBeDefined()
        expect(users.fields.created_at).toBeDefined()
      })

      it('merges fields from multiple operations', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        // password comes from CreateUserRequest (POST)
        expect(users.fields.password).toBeDefined()
      })
    })

    describe('field type mapping', () => {
      it('maps string to text', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields.name.type).toBe('text')
      })

      it('maps integer to number', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields.id.type).toBe('number')
      })

      it('maps string with email format to email', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields.email.type).toBe('email')
      })

      it('maps string with date-time format to datetime', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields.created_at.type).toBe('datetime')
      })

      it('maps string with date format to date', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const posts = result.find(e => e.name === 'posts')
        expect(posts.fields.published_at.type).toBe('date')
      })

      it('maps string with uri format to url', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields.website.type).toBe('url')
      })

      it('maps string with uuid format to uuid', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields.uuid.type).toBe('uuid')
      })

      it('maps boolean to boolean', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields.active.type).toBe('boolean')
      })

      it('maps array to array', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields.tags.type).toBe('array')
      })

      it('maps object to object', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields.metadata.type).toBe('object')
      })

      it('maps enum fields to select', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields.role.type).toBe('select')
        expect(users.fields.role.enum).toEqual(['admin', 'user', 'guest'])
      })
    })

    describe('field properties', () => {
      it('extracts required fields', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields.email.required).toBe(true)
      })

      it('extracts readOnly flag', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields.id.readOnly).toBe(true)
        expect(users.fields.created_at.readOnly).toBe(true)
      })

      it('extracts description as label', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields.id.label).toBe('User ID')
        expect(users.fields.email.label).toBe('Email address')
      })

      it('extracts default values', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields.active.default).toBe(true)
        expect(users.fields.role.default).toBe('user')
      })

      it('extracts format property', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields.email.format).toBe('email')
        expect(users.fields.created_at.format).toBe('date-time')
      })

      it('extracts enum values', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const posts = result.find(e => e.name === 'posts')
        expect(posts.fields.status.enum).toEqual(['draft', 'published', 'archived'])
      })
    })

    describe('nested object handling', () => {
      it('extracts nested object fields with dot notation', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields['profile.bio']).toBeDefined()
        expect(users.fields['profile.avatar']).toBeDefined()
      })

      it('maps nested field types correctly', () => {
        const connector = new OpenAPIConnector()
        const result = connector.parse(sampleSpec)

        const users = result.find(e => e.name === 'users')
        expect(users.fields['profile.bio'].type).toBe('text')
        expect(users.fields['profile.avatar'].type).toBe('url')
      })
    })
  })

  describe('dataWrapper option', () => {
    it('unwraps data from default "data" property', () => {
      const connector = new OpenAPIConnector()
      const result = connector.parse(sampleSpec)

      const users = result.find(e => e.name === 'users')
      // Should have User fields, not "data" field
      expect(users.fields.id).toBeDefined()
      expect(users.fields.data).toBeUndefined()
    })

    it('respects custom dataWrapper', () => {
      const spec = {
        openapi: '3.0.0',
        paths: {
          '/api/items': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          result: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'integer' },
                                name: { type: 'string' }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      const connector = new OpenAPIConnector({ dataWrapper: 'result' })
      const result = connector.parse(spec)

      const items = result.find(e => e.name === 'items')
      expect(items.fields.id).toBeDefined()
      expect(items.fields.name).toBeDefined()
    })

    it('handles missing dataWrapper gracefully', () => {
      const spec = {
        openapi: '3.0.0',
        paths: {
          '/api/items': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          name: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      const connector = new OpenAPIConnector({ dataWrapper: 'data' })
      const result = connector.parse(spec)

      // Should fall back to full schema
      const items = result.find(e => e.name === 'items')
      expect(items.fields.id).toBeDefined()
      expect(items.fields.name).toBeDefined()
    })
  })

  describe('pathPatterns option', () => {
    it('uses custom path patterns', () => {
      const spec = {
        openapi: '3.0.0',
        paths: {
          '/v2/admin/users': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          data: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'integer' }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/v2/admin/users/{id}': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          data: {
                            type: 'object',
                            properties: {
                              id: { type: 'integer' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      const connector = new OpenAPIConnector({
        pathPatterns: [
          /^\/v2\/admin\/([a-z-]+)\/?$/,
          /^\/v2\/admin\/([a-z-]+)\/\{[^}]+\}$/
        ]
      })

      const result = connector.parse(spec)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('users')
      expect(result[0].endpoint).toBe('/v2/admin/users')
    })

    it('ignores paths that do not match patterns', () => {
      const spec = {
        openapi: '3.0.0',
        paths: {
          '/health': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      }

      const connector = new OpenAPIConnector()
      const result = connector.parse(spec)

      expect(result).toHaveLength(0)
    })
  })

  describe('operationFilter option', () => {
    it('filters operations based on custom function', () => {
      const connector = new OpenAPIConnector({
        operationFilter: (path, method, op) => !op.tags?.includes('internal')
      })

      const result = connector.parse(sampleSpec)

      const entityNames = result.map(e => e.name)
      expect(entityNames).not.toContain('metrics')
    })

    it('allows all operations when no filter provided', () => {
      // Add a spec with all operations having tags
      const spec = {
        openapi: '3.0.0',
        paths: {
          '/api/items': {
            get: {
              tags: ['public'],
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          data: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: { id: { type: 'integer' } }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      const connector = new OpenAPIConnector()
      const result = connector.parse(spec)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('items')
    })
  })

  describe('customMappings option', () => {
    it('uses custom format mappings', () => {
      const spec = {
        openapi: '3.0.0',
        paths: {
          '/api/items': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          data: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                phone: {
                                  type: 'string',
                                  format: 'phone'
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      const connector = new OpenAPIConnector({
        customMappings: {
          formats: { phone: 'text' }
        }
      })

      const result = connector.parse(spec)
      const items = result.find(e => e.name === 'items')

      expect(items.fields.phone.type).toBe('text')
    })
  })

  describe('validation', () => {
    it('throws for null source', () => {
      const connector = new OpenAPIConnector()
      expect(() => connector.parse(null)).toThrow('source must be an object')
    })

    it('throws for undefined source', () => {
      const connector = new OpenAPIConnector()
      expect(() => connector.parse(undefined)).toThrow('source must be an object')
    })

    it('throws for source without paths', () => {
      const connector = new OpenAPIConnector()
      expect(() => connector.parse({ openapi: '3.0.0' })).toThrow('source must have paths object')
    })

    it('throws for paths that is not an object', () => {
      const connector = new OpenAPIConnector()
      expect(() => connector.parse({ paths: 'invalid' })).toThrow('source must have paths object')
    })
  })

  describe('parseWithWarnings()', () => {
    it('returns schemas and warnings', () => {
      const connector = new OpenAPIConnector()
      const result = connector.parseWithWarnings(sampleSpec)

      expect(result.schemas).toBeDefined()
      expect(Array.isArray(result.schemas)).toBe(true)
      expect(result.warnings).toBeDefined()
      expect(Array.isArray(result.warnings)).toBe(true)
    })

    it('collects warnings for unresolved refs', () => {
      const spec = {
        openapi: '3.0.0',
        paths: {
          '/api/items': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          data: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                related: { $ref: '#/components/schemas/Missing' }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      const connector = new OpenAPIConnector()
      const result = connector.parseWithWarnings(spec)

      expect(result.warnings.some(w => w.code === 'UNRESOLVED_REF')).toBe(true)
    })
  })

  describe('extensions option', () => {
    it('adds extensions to all parsed entities', () => {
      const connector = new OpenAPIConnector({
        extensions: { source: 'openapi', custom: true }
      })

      const result = connector.parse(sampleSpec)

      for (const entity of result) {
        expect(entity.extensions).toEqual({ source: 'openapi', custom: true })
      }
    })

    it('does not add extensions when empty', () => {
      const connector = new OpenAPIConnector()
      const result = connector.parse(sampleSpec)

      for (const entity of result) {
        expect(entity.extensions).toBeUndefined()
      }
    })
  })

  describe('constructor options', () => {
    it('uses constructor name by default', () => {
      const connector = new OpenAPIConnector()
      expect(connector.name).toBe('OpenAPIConnector')
    })

    it('allows custom name', () => {
      const connector = new OpenAPIConnector({ name: 'MyOpenAPI' })
      expect(connector.name).toBe('MyOpenAPI')
    })

    it('defaults dataWrapper to "data"', () => {
      const connector = new OpenAPIConnector()
      expect(connector.dataWrapper).toBe('data')
    })

    it('treats null dataWrapper as default', () => {
      // null coalesces to 'data', use empty string to disable unwrapping
      const connector = new OpenAPIConnector({ dataWrapper: null })
      expect(connector.dataWrapper).toBe('data')
    })

    it('allows empty string dataWrapper to disable unwrapping', () => {
      const connector = new OpenAPIConnector({ dataWrapper: '' })
      expect(connector.dataWrapper).toBe('')
    })

    it('defaults to empty customMappings', () => {
      const connector = new OpenAPIConnector()
      expect(connector.customMappings).toEqual({})
    })

    it('defaults to no operationFilter', () => {
      const connector = new OpenAPIConnector()
      expect(connector.operationFilter).toBeNull()
    })

    it('uses default path patterns', () => {
      const connector = new OpenAPIConnector()
      expect(connector.pathPatterns).toHaveLength(2)
    })
  })

  describe('$ref resolution', () => {
    it('resolves component schema references', () => {
      const connector = new OpenAPIConnector()
      const result = connector.parse(sampleSpec)

      const users = result.find(e => e.name === 'users')
      // Fields from User schema via $ref
      expect(users.fields.email).toBeDefined()
      expect(users.fields.email.type).toBe('email')
    })

    it('resolves nested $ref in response content', () => {
      const spec = {
        openapi: '3.0.0',
        paths: {
          '/api/items': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        $ref: '#/components/schemas/ItemsResponse'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        components: {
          schemas: {
            ItemsResponse: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Item' }
                }
              }
            },
            Item: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' }
              }
            }
          }
        }
      }

      const connector = new OpenAPIConnector()
      const result = connector.parse(spec)

      const items = result.find(e => e.name === 'items')
      expect(items.fields.id).toBeDefined()
      expect(items.fields.name).toBeDefined()
    })
  })

  describe('list operation detection', () => {
    it('detects list operation from collection path', () => {
      const connector = new OpenAPIConnector()
      const result = connector.parse(sampleSpec)

      // Should extract array item schema, not the array itself
      const users = result.find(e => e.name === 'users')
      expect(users.fields.id).toBeDefined()
      expect(users.fields.id.type).toBe('number')
    })

    it('detects list operation from pagination indicators', () => {
      const connector = new OpenAPIConnector()
      const result = connector.parse(sampleSpec)

      // Posts have pagination in response
      const posts = result.find(e => e.name === 'posts')
      expect(posts.fields.id).toBeDefined()
    })
  })

  describe('idField detection', () => {
    it('detects idField from path parameter', () => {
      const spec = {
        openapi: '3.0.0',
        paths: {
          '/api/bots': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          data: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                uuid: { type: 'string' },
                                name: { type: 'string' }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/api/bots/{uuid}': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          data: {
                            type: 'object',
                            properties: {
                              uuid: { type: 'string' },
                              name: { type: 'string' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      const connector = new OpenAPIConnector()
      const result = connector.parse(spec)

      const bots = result.find(e => e.name === 'bots')
      expect(bots.idField).toBe('uuid')
    })

    it('defaults to no idField when path has no parameter', () => {
      const spec = {
        openapi: '3.0.0',
        paths: {
          '/api/stats': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          data: { type: 'object' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      const connector = new OpenAPIConnector()
      const result = connector.parse(spec)

      const stats = result.find(e => e.name === 'stats')
      expect(stats.idField).toBeUndefined()
    })
  })
})
