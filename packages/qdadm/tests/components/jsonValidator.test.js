/**
 * Unit tests for buildJsonValidator — the VanillaJsonEditor schema/validator
 * resolution helper (qdadm #1050).
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { buildJsonValidator } from '../../src/components/editors/jsonValidator'

const schema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
  },
}

describe('buildJsonValidator', () => {
  it('returns undefined when neither schema nor validator is given', () => {
    expect(buildJsonValidator({})).toBeUndefined()
  })

  it('compiles a JSON Schema into a validator that flags invalid JSON', () => {
    const validate = buildJsonValidator({ schema })
    expect(typeof validate).toBe('function')
    // missing required `name` + wrong type for `age`
    const errors = validate({ age: 'not-a-number' })
    expect(errors.length).toBeGreaterThan(0)
  })

  it('the compiled validator passes valid JSON (no errors)', () => {
    const validate = buildJsonValidator({ schema })
    expect(validate({ name: 'Dune', age: 1965 })).toEqual([])
  })

  it('a raw validator takes precedence over schema', () => {
    const raw = vi.fn(() => [])
    const validate = buildJsonValidator({ validator: raw, schema })
    expect(validate).toBe(raw)
    validate({ anything: true })
    expect(raw).toHaveBeenCalledOnce()
  })
})
