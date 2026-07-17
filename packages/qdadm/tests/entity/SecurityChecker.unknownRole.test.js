/**
 * SecurityChecker unknown-role dev warning (#1388).
 *
 * A user role that matches no configured role silently yields zero
 * permissions — the checker must warn once per role so the
 * misconfiguration (e.g. `admin` instead of `ROLE_ADMIN`) is debuggable.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SecurityChecker } from '../../src/entity/auth/SecurityChecker'

let warnSpy
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

function makeChecker(user) {
  return new SecurityChecker({
    rolePermissions: { ROLE_ADMIN: ['entity:**'], ROLE_USER: ['entity:*:read'] },
    roleHierarchy: { ROLE_ADMIN: ['ROLE_USER'] },
    getCurrentUser: () => user,
  })
}

describe('SecurityChecker unknown-role warning (#1388)', () => {
  it('warns once when the user role matches no configured role', () => {
    const checker = makeChecker({ id: '1', role: 'admin' })

    expect(checker.isGranted('entity:books:read')).toBe(false)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(String(warnSpy.mock.calls[0][0])).toContain('"admin"')
    expect(String(warnSpy.mock.calls[0][0])).toContain('ROLE_ADMIN')

    // warn-once: repeated checks stay silent
    checker.isGranted('entity:books:read')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('stays silent for configured roles', () => {
    const checker = makeChecker({ id: '1', role: 'ROLE_ADMIN' })
    expect(checker.isGranted('entity:books:read')).toBe(true)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('counts hierarchy-only roles as known', () => {
    const checker = new SecurityChecker({
      rolePermissions: { ROLE_USER: ['entity:*:read'] },
      roleHierarchy: { ROLE_MANAGER: ['ROLE_USER'] },
      getCurrentUser: () => ({ id: '1', role: 'ROLE_MANAGER' }),
    })
    expect(checker.isGranted('entity:books:read')).toBe(true)
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
