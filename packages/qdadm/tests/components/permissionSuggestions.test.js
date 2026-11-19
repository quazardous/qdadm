/**
 * PermissionEditor's suggestions (#5333): multi-level wildcards as
 * PermissionMatcher reads them, and a registry from a plain list.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { suggestPermissions, wildcardCandidates, permissionRegistryFromList } from '../../src/components/editors/permissionSuggestions'
import { PermissionMatcher } from '../../src/security/PermissionMatcher'

const KEYS = ['logs:errors:read', 'logs:access:read', 'logs:errors:purge', 'cockpit:act', 'keys:manage', 'keys:read']
const texts = {
  all: () => 'all',
  actionEverywhere: (a) => `${a} everywhere`,
  anActionEverywhere: () => 'an action everywhere',
  allUnder: (p) => `all under ${p}`,
  directUnder: (p) => `direct ${p}`,
  actionUnder: (a, p) => `${a} under ${p}`,
  subItems: (n) => `${n} sub`,
  label: (k) => k,
}
const values = (list) => list.map((s) => s.value)

describe('permission suggestions (#5333)', () => {
  it('offers ** and **: at the start', () => {
    expect(values(suggestPermissions('', KEYS, texts)).slice(0, 2)).toEqual(['**', '**:'])
  })

  it('**: lists an action everywhere, and each one covers its three-part keys', () => {
    const list = values(suggestPermissions('**:', KEYS, texts))
    expect(list).toEqual(expect.arrayContaining(['**:read', '**:purge', '**:act', '**:manage']))
    expect(PermissionMatcher.matches('**:read', 'logs:errors:read')).toBe(true)
  })

  it("after a namespace: its next segments and its wildcards", () => {
    const list = values(suggestPermissions('logs:', KEYS, texts))
    expect(list).toEqual(expect.arrayContaining(['logs:**', 'logs:*:read', 'logs:*:purge', 'logs:errors:', 'logs:access:']))
    expect(list).not.toContain('logs:*')
    expect(values(suggestPermissions('keys:', KEYS, texts))).toEqual(expect.arrayContaining(['keys:**', 'keys:*', 'keys:manage', 'keys:read']))
  })

  it('every wildcard suggested matches at least one key', () => {
    for (const s of wildcardCandidates(KEYS, texts)) {
      expect(KEYS.some((k) => PermissionMatcher.matches(s.value, k)), s.value).toBe(true)
    }
  })

  it('*:read is offered only where two-part keys have it', () => {
    const list = values(wildcardCandidates(KEYS, texts))
    expect(list).toContain('*:read') // keys:read
    expect(list).not.toContain('*:purge') // only logs:errors:purge
  })

  it('a registry from a plain list cuts at the last colon', () => {
    const registry = permissionRegistryFromList(['logs:errors:read', 'admin', 'logs:errors:read'], (k) => k.toUpperCase())
    expect(registry.getAll()).toEqual([
      { key: 'logs:errors:read', namespace: 'logs:errors', action: 'read', label: 'LOGS:ERRORS:READ' },
      { key: 'admin', namespace: '', action: 'admin', label: 'ADMIN' },
    ])
    expect(registry.get('admin').label).toBe('ADMIN')
  })
})
