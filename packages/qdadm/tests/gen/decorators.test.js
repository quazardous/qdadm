import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { applyDecorators } from '../../src/gen/decorators.js'

/**
 * Create a sample UnifiedEntitySchema for testing
 */
function createSampleSchema() {
  return {
    name: 'users',
    endpoint: '/api/users',
    label: 'User',
    labelPlural: 'Users',
    labelField: 'name',
    idField: 'id',
    fields: {
      id: { name: 'id', type: 'number', readOnly: true },
      name: { name: 'name', type: 'text', required: true, label: 'Name' },
      email: { name: 'email', type: 'email', required: true, label: 'Email' },
      role: { name: 'role', type: 'select', enum: ['admin', 'user', 'guest'] },
      password: { name: 'password', type: 'text', hidden: false },
      active: { name: 'active', type: 'boolean', default: true }
    }
  }
}

describe('applyDecorators', () => {
  let consoleWarnSpy

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  describe('no-op behavior', () => {
    it('returns schema unchanged when decoratorConfig is undefined', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, undefined)
      expect(result).toBe(schema)
    })

    it('returns schema unchanged when decoratorConfig is null', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, null)
      expect(result).toBe(schema)
    })

    it('returns schema unchanged when decoratorConfig is empty object', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {})
      expect(result).toBe(schema)
    })

    it('returns schema unchanged when decoratorConfig.fields is undefined', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, { someOtherProp: true })
      expect(result).toBe(schema)
    })
  })

  describe('hidden decorator', () => {
    it('sets hidden to true on specified field', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          password: { hidden: true }
        }
      })

      expect(result.fields.password.hidden).toBe(true)
    })

    it('sets hidden to false on specified field', () => {
      const schema = createSampleSchema()
      schema.fields.email.hidden = true // Start with hidden

      const result = applyDecorators(schema, {
        fields: {
          email: { hidden: false }
        }
      })

      expect(result.fields.email.hidden).toBe(false)
    })

    it('does not modify other fields', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          password: { hidden: true }
        }
      })

      expect(result.fields.name.hidden).toBeUndefined()
      expect(result.fields.email.hidden).toBeUndefined()
    })
  })

  describe('label decorator', () => {
    it('overrides field label', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          name: { label: 'Full Name' }
        }
      })

      expect(result.fields.name.label).toBe('Full Name')
    })

    it('adds label to field without one', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          role: { label: 'User Role' }
        }
      })

      expect(result.fields.role.label).toBe('User Role')
    })

    it('preserves other field properties when setting label', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          email: { label: 'Email Address' }
        }
      })

      expect(result.fields.email.label).toBe('Email Address')
      expect(result.fields.email.type).toBe('email')
      expect(result.fields.email.required).toBe(true)
    })
  })

  describe('readOnly decorator', () => {
    it('sets readOnly to true on specified field', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          name: { readOnly: true }
        }
      })

      expect(result.fields.name.readOnly).toBe(true)
    })

    it('overrides existing readOnly value', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          id: { readOnly: false }
        }
      })

      expect(result.fields.id.readOnly).toBe(false)
    })
  })

  describe('order decorator', () => {
    it('sets order on specified field', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          name: { order: 1 },
          email: { order: 2 },
          role: { order: 3 }
        }
      })

      expect(result.fields.name.order).toBe(1)
      expect(result.fields.email.order).toBe(2)
      expect(result.fields.role.order).toBe(3)
    })

    it('supports zero as order value', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          id: { order: 0 }
        }
      })

      expect(result.fields.id.order).toBe(0)
    })

    it('supports negative order values', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          id: { order: -1 }
        }
      })

      expect(result.fields.id.order).toBe(-1)
    })
  })

  describe('multiple decorators on same field', () => {
    it('applies multiple decorators to single field', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          email: {
            hidden: true,
            label: 'Email Address',
            readOnly: true,
            order: 5
          }
        }
      })

      expect(result.fields.email.hidden).toBe(true)
      expect(result.fields.email.label).toBe('Email Address')
      expect(result.fields.email.readOnly).toBe(true)
      expect(result.fields.email.order).toBe(5)
    })
  })

  describe('multiple fields', () => {
    it('applies decorators to multiple fields', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          password: { hidden: true },
          name: { label: 'Full Name' },
          email: { readOnly: true },
          role: { order: 1 }
        }
      })

      expect(result.fields.password.hidden).toBe(true)
      expect(result.fields.name.label).toBe('Full Name')
      expect(result.fields.email.readOnly).toBe(true)
      expect(result.fields.role.order).toBe(1)
    })
  })

  describe('immutability', () => {
    it('does not mutate original schema', () => {
      const schema = createSampleSchema()
      const originalFieldsJson = JSON.stringify(schema.fields)

      applyDecorators(schema, {
        fields: {
          password: { hidden: true },
          name: { label: 'Full Name' }
        }
      })

      expect(JSON.stringify(schema.fields)).toBe(originalFieldsJson)
    })

    it('returns new schema object', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          password: { hidden: true }
        }
      })

      expect(result).not.toBe(schema)
    })

    it('returns new fields object', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          password: { hidden: true }
        }
      })

      expect(result.fields).not.toBe(schema.fields)
    })

    it('returns new field objects for each field', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          password: { hidden: true }
        }
      })

      // All fields should be new objects, even unmodified ones
      expect(result.fields.password).not.toBe(schema.fields.password)
      expect(result.fields.name).not.toBe(schema.fields.name)
    })

    it('preserves schema-level properties', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          password: { hidden: true }
        }
      })

      expect(result.name).toBe(schema.name)
      expect(result.endpoint).toBe(schema.endpoint)
      expect(result.label).toBe(schema.label)
      expect(result.labelPlural).toBe(schema.labelPlural)
      expect(result.labelField).toBe(schema.labelField)
      expect(result.idField).toBe(schema.idField)
    })
  })

  describe('unknown decorator properties', () => {
    it('warns about unknown decorator properties', () => {
      const schema = createSampleSchema()

      applyDecorators(schema, {
        fields: {
          name: { unknownProp: true }
        }
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown decorator property "unknownProp"')
      )
    })

    it('warns with field and entity name in message', () => {
      const schema = createSampleSchema()

      applyDecorators(schema, {
        fields: {
          email: { customValidator: () => true }
        }
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('field "email"')
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('entity "users"')
      )
    })

    it('warns about allowed properties in message', () => {
      const schema = createSampleSchema()

      applyDecorators(schema, {
        fields: {
          name: { badProp: true }
        }
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Allowed:.*hidden.*label.*readOnly.*order/)
      )
    })

    it('does not apply unknown properties', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          name: { customThing: 'should-not-appear' }
        }
      })

      expect(result.fields.name.customThing).toBeUndefined()
    })

    it('applies allowed properties while warning about unknown ones', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          name: {
            label: 'Full Name',
            unknownProp: true
          }
        }
      })

      expect(result.fields.name.label).toBe('Full Name')
      expect(result.fields.name.unknownProp).toBeUndefined()
      expect(consoleWarnSpy).toHaveBeenCalled()
    })
  })

  describe('unknown fields in decorator', () => {
    it('warns about decorators for non-existent fields', () => {
      const schema = createSampleSchema()

      applyDecorators(schema, {
        fields: {
          nonExistentField: { hidden: true }
        }
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Decorator defined for unknown field "nonExistentField"')
      )
    })

    it('warns with entity name in message', () => {
      const schema = createSampleSchema()

      applyDecorators(schema, {
        fields: {
          unknownField: { label: 'Test' }
        }
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('entity "users"')
      )
    })

    it('warns with available fields in message', () => {
      const schema = createSampleSchema()

      applyDecorators(schema, {
        fields: {
          missingField: { hidden: true }
        }
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Available fields:')
      )
    })

    it('still applies decorators to existing fields when unknown fields present', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          password: { hidden: true },
          unknownField: { hidden: true }
        }
      })

      expect(result.fields.password.hidden).toBe(true)
      expect(consoleWarnSpy).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('handles schema with no fields', () => {
      const schema = {
        name: 'empty',
        endpoint: '/empty',
        fields: {}
      }

      const result = applyDecorators(schema, {
        fields: {}
      })

      expect(result.fields).toEqual({})
    })

    it('handles empty field decorators', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          name: {}
        }
      })

      // Field should be unchanged
      expect(result.fields.name.label).toBe('Name')
      expect(result.fields.name.type).toBe('text')
    })

    it('handles field with all allowed decorators', () => {
      const schema = createSampleSchema()
      const result = applyDecorators(schema, {
        fields: {
          name: {
            hidden: true,
            label: 'New Label',
            readOnly: true,
            order: 99
          }
        }
      })

      expect(result.fields.name.hidden).toBe(true)
      expect(result.fields.name.label).toBe('New Label')
      expect(result.fields.name.readOnly).toBe(true)
      expect(result.fields.name.order).toBe(99)
    })

    it('handles boolean values correctly', () => {
      const schema = createSampleSchema()

      // Set to true
      let result = applyDecorators(schema, {
        fields: { name: { hidden: true } }
      })
      expect(result.fields.name.hidden).toBe(true)

      // Set to false
      result = applyDecorators(schema, {
        fields: { name: { hidden: false } }
      })
      expect(result.fields.name.hidden).toBe(false)
    })

    it('preserves all original field properties', () => {
      const schema = {
        name: 'test',
        endpoint: '/test',
        fields: {
          complex: {
            name: 'complex',
            type: 'select',
            label: 'Complex Field',
            required: true,
            readOnly: false,
            enum: ['a', 'b', 'c'],
            default: 'a',
            format: 'custom',
            reference: { entity: 'other', field: 'id' },
            extensions: { custom: true }
          }
        }
      }

      const result = applyDecorators(schema, {
        fields: {
          complex: { hidden: true }
        }
      })

      // All original properties should be preserved
      expect(result.fields.complex.name).toBe('complex')
      expect(result.fields.complex.type).toBe('select')
      expect(result.fields.complex.label).toBe('Complex Field')
      expect(result.fields.complex.required).toBe(true)
      expect(result.fields.complex.readOnly).toBe(false)
      expect(result.fields.complex.enum).toEqual(['a', 'b', 'c'])
      expect(result.fields.complex.default).toBe('a')
      expect(result.fields.complex.format).toBe('custom')
      expect(result.fields.complex.reference).toEqual({ entity: 'other', field: 'id' })
      expect(result.fields.complex.extensions).toEqual({ custom: true })

      // Plus the new decorator
      expect(result.fields.complex.hidden).toBe(true)
    })
  })
})
