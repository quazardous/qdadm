import { describe, it, expect } from 'vitest'
import {
  getDefaultType,
  BASE_TYPE_MAPPINGS,
  FORMAT_MAPPINGS
} from '../../src/gen/FieldMapper.js'

describe('FieldMapper', () => {
  describe('BASE_TYPE_MAPPINGS', () => {
    it('maps string to text', () => {
      expect(BASE_TYPE_MAPPINGS.string).toBe('text')
    })

    it('maps integer to number', () => {
      expect(BASE_TYPE_MAPPINGS.integer).toBe('number')
    })

    it('maps number to number', () => {
      expect(BASE_TYPE_MAPPINGS.number).toBe('number')
    })

    it('maps boolean to boolean', () => {
      expect(BASE_TYPE_MAPPINGS.boolean).toBe('boolean')
    })

    it('maps array to array', () => {
      expect(BASE_TYPE_MAPPINGS.array).toBe('array')
    })

    it('maps object to object', () => {
      expect(BASE_TYPE_MAPPINGS.object).toBe('object')
    })

    it('is frozen', () => {
      expect(Object.isFrozen(BASE_TYPE_MAPPINGS)).toBe(true)
    })
  })

  describe('FORMAT_MAPPINGS', () => {
    it('maps email to email', () => {
      expect(FORMAT_MAPPINGS.email).toBe('email')
    })

    it('maps date-time to datetime', () => {
      expect(FORMAT_MAPPINGS['date-time']).toBe('datetime')
    })

    it('maps date to date', () => {
      expect(FORMAT_MAPPINGS.date).toBe('date')
    })

    it('maps uri to url', () => {
      expect(FORMAT_MAPPINGS.uri).toBe('url')
    })

    it('maps url to url', () => {
      expect(FORMAT_MAPPINGS.url).toBe('url')
    })

    it('maps uuid to uuid', () => {
      expect(FORMAT_MAPPINGS.uuid).toBe('uuid')
    })

    it('maps password to text', () => {
      expect(FORMAT_MAPPINGS.password).toBe('text')
    })

    it('is frozen', () => {
      expect(Object.isFrozen(FORMAT_MAPPINGS)).toBe(true)
    })
  })

  describe('getDefaultType', () => {
    describe('base type mapping', () => {
      it('returns text for string type', () => {
        expect(getDefaultType({ type: 'string' })).toBe('text')
      })

      it('returns number for integer type', () => {
        expect(getDefaultType({ type: 'integer' })).toBe('number')
      })

      it('returns number for number type', () => {
        expect(getDefaultType({ type: 'number' })).toBe('number')
      })

      it('returns boolean for boolean type', () => {
        expect(getDefaultType({ type: 'boolean' })).toBe('boolean')
      })

      it('returns array for array type', () => {
        expect(getDefaultType({ type: 'array' })).toBe('array')
      })

      it('returns object for object type', () => {
        expect(getDefaultType({ type: 'object' })).toBe('object')
      })

      it('returns text for unknown type', () => {
        expect(getDefaultType({ type: 'unknown' })).toBe('text')
      })

      it('returns text for missing type', () => {
        expect(getDefaultType({})).toBe('text')
      })

      it('returns text for null schema', () => {
        expect(getDefaultType(null)).toBe('text')
      })

      it('returns text for undefined schema', () => {
        expect(getDefaultType(undefined)).toBe('text')
      })
    })

    describe('format mapping', () => {
      it('returns email for string with email format', () => {
        expect(getDefaultType({ type: 'string', format: 'email' })).toBe('email')
      })

      it('returns datetime for string with date-time format', () => {
        expect(getDefaultType({ type: 'string', format: 'date-time' })).toBe('datetime')
      })

      it('returns date for string with date format', () => {
        expect(getDefaultType({ type: 'string', format: 'date' })).toBe('date')
      })

      it('returns url for string with uri format', () => {
        expect(getDefaultType({ type: 'string', format: 'uri' })).toBe('url')
      })

      it('returns url for string with url format', () => {
        expect(getDefaultType({ type: 'string', format: 'url' })).toBe('url')
      })

      it('returns uuid for string with uuid format', () => {
        expect(getDefaultType({ type: 'string', format: 'uuid' })).toBe('uuid')
      })

      it('returns text for string with password format', () => {
        expect(getDefaultType({ type: 'string', format: 'password' })).toBe('text')
      })

      it('format takes precedence over base type', () => {
        expect(getDefaultType({ type: 'string', format: 'email' })).toBe('email')
        expect(getDefaultType({ type: 'string' })).toBe('text')
      })

      it('returns base type for unknown format', () => {
        expect(getDefaultType({ type: 'string', format: 'unknown-format' })).toBe('text')
        expect(getDefaultType({ type: 'integer', format: 'unknown-format' })).toBe('number')
      })
    })

    describe('enum detection', () => {
      it('returns select for string with enum', () => {
        expect(getDefaultType({ type: 'string', enum: ['a', 'b', 'c'] })).toBe('select')
      })

      it('returns select for integer with enum', () => {
        expect(getDefaultType({ type: 'integer', enum: [1, 2, 3] })).toBe('select')
      })

      it('returns select for number with enum', () => {
        expect(getDefaultType({ type: 'number', enum: [1.5, 2.5] })).toBe('select')
      })

      it('enum takes precedence over format', () => {
        expect(getDefaultType({ type: 'string', format: 'email', enum: ['a@b.com', 'c@d.com'] })).toBe('select')
      })

      it('enum takes precedence over base type', () => {
        expect(getDefaultType({ type: 'string', enum: ['red', 'blue'] })).toBe('select')
      })

      it('does not return select for empty enum array', () => {
        expect(getDefaultType({ type: 'string', enum: [] })).toBe('text')
      })

      it('does not return select for non-array enum', () => {
        expect(getDefaultType({ type: 'string', enum: 'not-an-array' })).toBe('text')
      })

      it('does not return select for null enum', () => {
        expect(getDefaultType({ type: 'string', enum: null })).toBe('text')
      })
    })

    describe('custom mappings', () => {
      describe('custom format mappings', () => {
        it('uses custom format mapping', () => {
          const customMappings = { formats: { phone: 'text' } }
          expect(getDefaultType({ type: 'string', format: 'phone' }, customMappings)).toBe('text')
        })

        it('custom format overrides default format mapping', () => {
          const customMappings = { formats: { email: 'custom-email' } }
          expect(getDefaultType({ type: 'string', format: 'email' }, customMappings)).toBe('custom-email')
        })

        it('falls back to default format if not in custom mappings', () => {
          const customMappings = { formats: { phone: 'text' } }
          expect(getDefaultType({ type: 'string', format: 'email' }, customMappings)).toBe('email')
        })
      })

      describe('custom type mappings', () => {
        it('uses custom type mapping', () => {
          const customMappings = { types: { string: 'textarea' } }
          expect(getDefaultType({ type: 'string' }, customMappings)).toBe('textarea')
        })

        it('custom type overrides default type mapping', () => {
          const customMappings = { types: { boolean: 'toggle' } }
          expect(getDefaultType({ type: 'boolean' }, customMappings)).toBe('toggle')
        })

        it('format takes precedence over custom type mapping', () => {
          const customMappings = { types: { string: 'textarea' } }
          expect(getDefaultType({ type: 'string', format: 'email' }, customMappings)).toBe('email')
        })

        it('custom format takes precedence over custom type mapping', () => {
          const customMappings = {
            types: { string: 'textarea' },
            formats: { email: 'custom-email' }
          }
          expect(getDefaultType({ type: 'string', format: 'email' }, customMappings)).toBe('custom-email')
        })
      })

      describe('mapping priority', () => {
        it('priority: enum > custom format > default format > custom type > default type', () => {
          const customMappings = {
            types: { string: 'textarea' },
            formats: { email: 'custom-email' }
          }

          // Enum highest priority
          expect(getDefaultType({ type: 'string', format: 'email', enum: ['a'] }, customMappings)).toBe('select')

          // Custom format > default format > custom type > default type
          expect(getDefaultType({ type: 'string', format: 'email' }, customMappings)).toBe('custom-email')

          // Default format > custom type > default type
          expect(getDefaultType({ type: 'string', format: 'uuid' }, customMappings)).toBe('uuid')

          // Custom type > default type
          expect(getDefaultType({ type: 'string' }, customMappings)).toBe('textarea')

          // Default type fallback
          expect(getDefaultType({ type: 'string' })).toBe('text')
        })
      })

      describe('edge cases', () => {
        it('handles empty custom mappings', () => {
          expect(getDefaultType({ type: 'string' }, {})).toBe('text')
        })

        it('handles custom mappings with empty objects', () => {
          expect(getDefaultType({ type: 'string' }, { types: {}, formats: {} })).toBe('text')
        })

        it('handles undefined custom mappings', () => {
          expect(getDefaultType({ type: 'string' }, undefined)).toBe('text')
        })

        it('handles custom mappings with only types', () => {
          expect(getDefaultType({ type: 'string', format: 'email' }, { types: { string: 'textarea' } })).toBe('email')
        })

        it('handles custom mappings with only formats', () => {
          expect(getDefaultType({ type: 'string', format: 'phone' }, { formats: { phone: 'tel' } })).toBe('tel')
        })
      })
    })
  })
})
