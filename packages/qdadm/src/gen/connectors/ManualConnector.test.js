import { describe, it, expect } from 'vitest'
import { ManualConnector } from './ManualConnector'

describe('ManualConnector', () => {
  describe('parse()', () => {
    describe('input normalization', () => {
      it('parses a single entity object', () => {
        const connector = new ManualConnector()
        const input = {
          name: 'users',
          endpoint: '/api/users',
          fields: {
            id: { name: 'id', type: 'number' },
            email: { name: 'email', type: 'email' }
          }
        }

        const result = connector.parse(input)

        expect(result).toHaveLength(1)
        expect(result[0].name).toBe('users')
        expect(result[0].endpoint).toBe('/api/users')
      })

      it('parses an array of entities', () => {
        const connector = new ManualConnector()
        const input = [
          { name: 'users', endpoint: '/api/users' },
          { name: 'posts', endpoint: '/api/posts' }
        ]

        const result = connector.parse(input)

        expect(result).toHaveLength(2)
        expect(result[0].name).toBe('users')
        expect(result[1].name).toBe('posts')
      })

      it('parses an object with entities array', () => {
        const connector = new ManualConnector()
        const input = {
          entities: [
            { name: 'users', endpoint: '/api/users' },
            { name: 'posts', endpoint: '/api/posts' }
          ]
        }

        const result = connector.parse(input)

        expect(result).toHaveLength(2)
        expect(result[0].name).toBe('users')
        expect(result[1].name).toBe('posts')
      })

      it('returns empty array for null source', () => {
        const connector = new ManualConnector()
        const result = connector.parse(null)
        expect(result).toEqual([])
      })

      it('returns empty array for undefined source', () => {
        const connector = new ManualConnector()
        const result = connector.parse(undefined)
        expect(result).toEqual([])
      })

      it('returns empty array for empty array source', () => {
        const connector = new ManualConnector()
        const result = connector.parse([])
        expect(result).toEqual([])
      })
    })

    describe('entity transformation', () => {
      it('transforms entity with all optional properties', () => {
        const connector = new ManualConnector()
        const input = {
          name: 'users',
          endpoint: '/api/users',
          label: 'User',
          labelPlural: 'Users',
          labelField: 'name',
          routePrefix: 'user',
          idField: 'user_id',
          readOnly: true,
          fields: {}
        }

        const result = connector.parse(input)

        expect(result[0].label).toBe('User')
        expect(result[0].labelPlural).toBe('Users')
        expect(result[0].labelField).toBe('name')
        expect(result[0].routePrefix).toBe('user')
        expect(result[0].idField).toBe('user_id')
        expect(result[0].readOnly).toBe(true)
      })

      it('preserves entity extensions', () => {
        const connector = new ManualConnector()
        const input = {
          name: 'users',
          endpoint: '/api/users',
          extensions: { customProp: 'value', nested: { a: 1 } }
        }

        const result = connector.parse(input)

        expect(result[0].extensions).toEqual({
          customProp: 'value',
          nested: { a: 1 }
        })
      })

      it('merges connector extensions with entity extensions', () => {
        const connector = new ManualConnector({
          extensions: { fromConnector: true }
        })
        const input = {
          name: 'users',
          endpoint: '/api/users',
          extensions: { fromEntity: true }
        }

        const result = connector.parse(input)

        expect(result[0].extensions).toEqual({
          fromConnector: true,
          fromEntity: true
        })
      })

      it('entity extensions override connector extensions', () => {
        const connector = new ManualConnector({
          extensions: { shared: 'connector' }
        })
        const input = {
          name: 'users',
          endpoint: '/api/users',
          extensions: { shared: 'entity' }
        }

        const result = connector.parse(input)

        expect(result[0].extensions.shared).toBe('entity')
      })
    })

    describe('field transformation', () => {
      it('transforms all field types correctly', () => {
        const connector = new ManualConnector()
        const input = {
          name: 'users',
          endpoint: '/api/users',
          fields: {
            id: { name: 'id', type: 'number' },
            name: { name: 'name', type: 'text' },
            email: { name: 'email', type: 'email' },
            website: { name: 'website', type: 'url' },
            uuid: { name: 'uuid', type: 'uuid' },
            active: { name: 'active', type: 'boolean' },
            birthdate: { name: 'birthdate', type: 'date' },
            created: { name: 'created', type: 'datetime' },
            tags: { name: 'tags', type: 'array' },
            meta: { name: 'meta', type: 'object' }
          }
        }

        const result = connector.parse(input)
        const fields = result[0].fields

        expect(fields.id.type).toBe('number')
        expect(fields.name.type).toBe('text')
        expect(fields.email.type).toBe('email')
        expect(fields.website.type).toBe('url')
        expect(fields.uuid.type).toBe('uuid')
        expect(fields.active.type).toBe('boolean')
        expect(fields.birthdate.type).toBe('date')
        expect(fields.created.type).toBe('datetime')
        expect(fields.tags.type).toBe('array')
        expect(fields.meta.type).toBe('object')
      })

      it('preserves all field optional properties', () => {
        const connector = new ManualConnector()
        const input = {
          name: 'users',
          endpoint: '/api/users',
          fields: {
            status: {
              name: 'status',
              type: 'text',
              label: 'Status',
              required: true,
              readOnly: false,
              hidden: true,
              format: 'custom-format',
              enum: ['active', 'inactive'],
              default: 'active',
              reference: { entity: 'statuses', labelField: 'name' },
              extensions: { width: 100 }
            }
          }
        }

        const result = connector.parse(input)
        const field = result[0].fields.status

        expect(field.label).toBe('Status')
        expect(field.required).toBe(true)
        expect(field.readOnly).toBe(false)
        expect(field.hidden).toBe(true)
        expect(field.format).toBe('custom-format')
        expect(field.enum).toEqual(['active', 'inactive'])
        expect(field.default).toBe('active')
        expect(field.reference).toEqual({ entity: 'statuses', labelField: 'name' })
        expect(field.extensions).toEqual({ width: 100 })
      })
    })
  })

  describe('validation in non-strict mode', () => {
    it('skips entity with missing name', () => {
      const connector = new ManualConnector({ strict: false })
      const input = [
        { endpoint: '/api/users' },
        { name: 'posts', endpoint: '/api/posts' }
      ]

      const result = connector.parse(input)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('posts')
    })

    it('skips entity with empty name', () => {
      const connector = new ManualConnector({ strict: false })
      const input = [
        { name: '', endpoint: '/api/users' },
        { name: 'posts', endpoint: '/api/posts' }
      ]

      const result = connector.parse(input)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('posts')
    })

    it('skips entity with missing endpoint', () => {
      const connector = new ManualConnector({ strict: false })
      const input = [
        { name: 'users' },
        { name: 'posts', endpoint: '/api/posts' }
      ]

      const result = connector.parse(input)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('posts')
    })

    it('skips entity with empty endpoint', () => {
      const connector = new ManualConnector({ strict: false })
      const input = [
        { name: 'users', endpoint: '' },
        { name: 'posts', endpoint: '/api/posts' }
      ]

      const result = connector.parse(input)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('posts')
    })

    it('skips invalid fields silently', () => {
      const connector = new ManualConnector({ strict: false })
      const input = {
        name: 'users',
        endpoint: '/api/users',
        fields: {
          valid: { name: 'valid', type: 'text' },
          noName: { type: 'text' },
          noType: { name: 'noType' },
          invalidType: { name: 'invalidType', type: 'invalid' }
        }
      }

      const result = connector.parse(input)

      expect(Object.keys(result[0].fields)).toEqual(['valid'])
    })
  })

  describe('validation in strict mode', () => {
    it('throws for entity with missing name', () => {
      const connector = new ManualConnector({ strict: true })
      const input = { endpoint: '/api/users' }

      expect(() => connector.parse(input)).toThrow("missing required field 'name'")
    })

    it('throws for entity with empty name', () => {
      const connector = new ManualConnector({ strict: true })
      const input = { name: '   ', endpoint: '/api/users' }

      expect(() => connector.parse(input)).toThrow("missing required field 'name'")
    })

    it('throws for entity with missing endpoint', () => {
      const connector = new ManualConnector({ strict: true })
      const input = { name: 'users' }

      expect(() => connector.parse(input)).toThrow("entity 'users' missing required field 'endpoint'")
    })

    it('throws for entity with empty endpoint', () => {
      const connector = new ManualConnector({ strict: true })
      const input = { name: 'users', endpoint: '   ' }

      expect(() => connector.parse(input)).toThrow("entity 'users' missing required field 'endpoint'")
    })

    it('throws for field with missing name', () => {
      const connector = new ManualConnector({ strict: true })
      const input = {
        name: 'users',
        endpoint: '/api/users',
        fields: {
          bad: { type: 'text' }
        }
      }

      expect(() => connector.parse(input)).toThrow("field 'bad' missing required property 'name'")
    })

    it('throws for field with missing type', () => {
      const connector = new ManualConnector({ strict: true })
      const input = {
        name: 'users',
        endpoint: '/api/users',
        fields: {
          email: { name: 'email' }
        }
      }

      expect(() => connector.parse(input)).toThrow("field 'email' missing required property 'type'")
    })

    it('throws for field with invalid type', () => {
      const connector = new ManualConnector({ strict: true })
      const input = {
        name: 'users',
        endpoint: '/api/users',
        fields: {
          email: { name: 'email', type: 'string' }
        }
      }

      expect(() => connector.parse(input)).toThrow("has invalid type 'string'")
      expect(() => connector.parse(input)).toThrow('Valid types:')
    })
  })

  describe('parseWithWarnings()', () => {
    it('returns schemas and empty warnings for valid input', () => {
      const connector = new ManualConnector()
      const input = {
        name: 'users',
        endpoint: '/api/users',
        fields: {
          id: { name: 'id', type: 'number' }
        }
      }

      const result = connector.parseWithWarnings(input)

      expect(result.schemas).toHaveLength(1)
      expect(result.warnings).toEqual([])
    })

    it('collects warnings for missing entity name', () => {
      const connector = new ManualConnector()
      const input = { endpoint: '/api/users' }

      const result = connector.parseWithWarnings(input)

      expect(result.schemas).toHaveLength(0)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].code).toBe('MISSING_ENTITY_NAME')
    })

    it('collects warnings for missing endpoint', () => {
      const connector = new ManualConnector()
      const input = { name: 'users' }

      const result = connector.parseWithWarnings(input)

      expect(result.schemas).toHaveLength(0)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].code).toBe('MISSING_ENTITY_ENDPOINT')
    })

    it('collects warnings for missing field name', () => {
      const connector = new ManualConnector()
      const input = {
        name: 'users',
        endpoint: '/api/users',
        fields: {
          bad: { type: 'text' }
        }
      }

      const result = connector.parseWithWarnings(input)

      expect(result.warnings.some(w => w.code === 'MISSING_FIELD_NAME')).toBe(true)
    })

    it('collects warnings for missing field type', () => {
      const connector = new ManualConnector()
      const input = {
        name: 'users',
        endpoint: '/api/users',
        fields: {
          email: { name: 'email' }
        }
      }

      const result = connector.parseWithWarnings(input)

      expect(result.warnings.some(w => w.code === 'MISSING_FIELD_TYPE')).toBe(true)
    })

    it('collects warnings for invalid field type', () => {
      const connector = new ManualConnector()
      const input = {
        name: 'users',
        endpoint: '/api/users',
        fields: {
          email: { name: 'email', type: 'string' }
        }
      }

      const result = connector.parseWithWarnings(input)

      expect(result.warnings.some(w => w.code === 'INVALID_FIELD_TYPE')).toBe(true)
    })

    it('collects multiple warnings', () => {
      const connector = new ManualConnector()
      const input = [
        { name: 'users' }, // missing endpoint
        {
          name: 'posts',
          endpoint: '/api/posts',
          fields: {
            bad1: { type: 'text' }, // missing name
            bad2: { name: 'bad2' }  // missing type
          }
        }
      ]

      const result = connector.parseWithWarnings(input)

      expect(result.warnings.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('constructor options', () => {
    it('uses constructor name by default', () => {
      const connector = new ManualConnector()
      expect(connector.name).toBe('ManualConnector')
    })

    it('allows custom name', () => {
      const connector = new ManualConnector({ name: 'MyConnector' })
      expect(connector.name).toBe('MyConnector')
    })

    it('defaults to non-strict mode', () => {
      const connector = new ManualConnector()
      expect(connector.strict).toBe(false)
    })

    it('allows strict mode', () => {
      const connector = new ManualConnector({ strict: true })
      expect(connector.strict).toBe(true)
    })

    it('defaults to empty extensions', () => {
      const connector = new ManualConnector()
      expect(connector.extensions).toEqual({})
    })

    it('accepts extensions option', () => {
      const connector = new ManualConnector({ extensions: { custom: true } })
      expect(connector.extensions).toEqual({ custom: true })
    })
  })
})
