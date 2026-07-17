/**
 * prettifyRole (#1388) — raw ROLE_* constants prettified for display when
 * no role_labels entry exists.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { prettifyRole } from '../../src/utils/formatters'

describe('prettifyRole', () => {
  it('strips the ROLE_ prefix and titlecases words', () => {
    expect(prettifyRole('ROLE_USER')).toBe('User')
    expect(prettifyRole('ROLE_SUPER_USER')).toBe('Super User')
    expect(prettifyRole('ROLE_ADMIN')).toBe('Admin')
  })

  it('handles non-prefixed and messy input', () => {
    expect(prettifyRole('manager')).toBe('Manager')
    expect(prettifyRole('ROLE_')).toBe('')
  })
})
