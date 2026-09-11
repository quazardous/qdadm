/**
 * A role's composition as RoleGrantsEditor draws it (#2313): rows, groups, where each grant comes from.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { PermissionRegistry } from '../../src/security/PermissionRegistry'
import { composeGrants, inheritedGrants, setGrant } from '../../src/security/roleGrants'

function grants() {
  const r = new PermissionRegistry()
  r.registerEntity('books')
  r.registerEntity('loans', { actions: ['read', 'list', 'create', 'return'], hasOwnership: true })
  r.register('offers', { rejudge: 'Rejudge an offer' })
  r.register('offers:debug', { read: 'Read debug data', write: 'Write debug data' })
  r.register('auth', { impersonate: { label: 'Impersonate', description: 'Act as another user' } })
  return r.getAll()
}

const compose = (permissions, inherited) => composeGrants({ grants: grants(), permissions, inherited })
const row = (model, namespace) => model.rows.find((r) => r.namespace === namespace)
const group = (model, namespace) => model.groups.find((g) => g.namespace === namespace)
const grant = (model, key) => model.groups.flatMap((g) => g.grants).find((g) => g.key === key)

describe('composeGrants (#2313)', () => {
  it('one row per entity (and per ownership namespace), one column per registered action, cells only where registered', () => {
    const model = compose([])

    expect(model.actions).toEqual(['read', 'list', 'create', 'update', 'delete', 'return'])
    expect(model.rows.map((r) => r.namespace)).toEqual(['entity:books', 'entity:loans', 'entity-own:loans'])
    expect(row(model, 'entity:books').cells.return).toBeNull()
    expect(row(model, 'entity:loans').cells.update).toBeNull()
    expect(row(model, 'entity-own:loans')).toMatchObject({ entity: 'loans', ownRecords: true, wildcard: 'entity-own:loans:*' })
    expect(row(model, 'entity:books').cells.read).toMatchObject({ key: 'entity:books:read', label: 'Read books', origin: { kind: 'none' } })
    expect(model.groups.map((g) => g.namespace)).toEqual(['auth', 'offers', 'offers:debug'])
    expect(grant(model, 'auth:impersonate')).toMatchObject({ label: 'Impersonate', description: 'Act as another user' })
  })

  it('a row wildcard is the whole row: its own key, and every cell covered by it', () => {
    const model = compose(['entity:books:*'])
    const books = row(model, 'entity:books')

    expect(books.wildcardOrigin).toEqual({ kind: 'own' })
    expect(books.cells.delete.origin).toEqual({ kind: 'wildcard', via: 'entity:books:*' })
    expect(row(model, 'entity:loans').cells.read.origin).toEqual({ kind: 'none' })
    expect(model.others).toEqual([])
  })

  it('entity:*:read covers a column and is listed with what it covers; ** covers everything', () => {
    const column = compose(['entity:*:read'])
    expect(row(column, 'entity:books').cells.read.origin).toEqual({ kind: 'wildcard', via: 'entity:*:read' })
    expect(row(column, 'entity:books').cells.list.origin).toEqual({ kind: 'none' })
    expect(row(column, 'entity-own:loans').cells.read.origin).toEqual({ kind: 'none' })
    expect(column.others).toEqual([{ key: 'entity:*:read', covers: 2 }])

    const all = compose(['**'])
    expect(row(all, 'entity:books').wildcardOrigin).toEqual({ kind: 'wildcard', via: '**' })
    expect(group(all, 'offers:debug').wildcardOrigin).toEqual({ kind: 'wildcard', via: '**' })
    expect(grant(all, 'auth:impersonate').origin).toEqual({ kind: 'wildcard', via: '**' })
    expect(all.others).toEqual([{ key: '**', covers: grants().length }])
  })

  it('a group wildcard covers its own namespace only: offers:* is not offers:debug:*', () => {
    const offers = compose(['offers:*'])
    expect(group(offers, 'offers').wildcardOrigin).toEqual({ kind: 'own' })
    expect(grant(offers, 'offers:rejudge').origin).toEqual({ kind: 'wildcard', via: 'offers:*' })
    expect(grant(offers, 'offers:debug:read').origin).toEqual({ kind: 'none' })
    expect(group(offers, 'offers:debug').wildcardOrigin).toEqual({ kind: 'none' })

    const debug = compose(['offers:debug:*'])
    expect(grant(debug, 'offers:debug:write').origin).toEqual({ kind: 'wildcard', via: 'offers:debug:*' })
    expect(grant(debug, 'offers:rejudge').origin).toEqual({ kind: 'none' })
  })

  it('inherited grants show the role they come from; the role\'s own key wins', () => {
    const inherited = [
      { permission: 'entity:books:read', via: 'ROLE_USER' },
      { permission: 'entity:loans:*', via: 'ROLE_OPERATOR' },
    ]
    const model = compose(['entity:books:read'], inherited)

    expect(row(model, 'entity:books').cells.read.origin).toEqual({ kind: 'own' })
    expect(row(model, 'entity:loans').cells.create.origin).toEqual({ kind: 'inherited', via: 'ROLE_OPERATOR' })
    expect(row(model, 'entity:loans').wildcardOrigin).toEqual({ kind: 'inherited', via: 'ROLE_OPERATOR' })
    expect(compose([], inherited).rows[0].cells.read.origin).toEqual({ kind: 'inherited', via: 'ROLE_USER' })
  })

  it('keys the registry does not know are kept, never dropped', () => {
    const model = compose(['runs:control', 'entity:books:read', 'runs:control'])

    expect(model.others).toEqual([{ key: 'runs:control', covers: 0 }])
  })
})

describe('setGrant (#2313)', () => {
  it('adds at the end, never twice; removes only that key', () => {
    expect(setGrant(['a', 'b'], 'c', true)).toEqual(['a', 'b', 'c'])
    expect(setGrant(['a', 'b'], 'a', true)).toEqual(['a', 'b'])
    expect(setGrant(['a', 'b', 'c'], 'b', false)).toEqual(['a', 'c'])
  })
})

describe('inheritedGrants (#2313)', () => {
  const provider = (permissions, hierarchy) => ({ getPermissions: (r) => permissions[r] ?? [], getHierarchy: () => hierarchy })

  it('walks the hierarchy; each grant names the nearest role that declares it', () => {
    const p = provider(
      { ROLE_USER: ['entity:books:read'], ROLE_OPERATOR: ['runs:control', 'entity:books:read'] },
      { ROLE_OPERATOR: ['ROLE_USER'] }
    )

    expect(inheritedGrants(p, ['ROLE_OPERATOR'])).toEqual([
      { permission: 'runs:control', via: 'ROLE_OPERATOR' },
      { permission: 'entity:books:read', via: 'ROLE_OPERATOR' },
    ])
    expect(inheritedGrants(provider({ ROLE_USER: ['entity:books:read'] }, { ROLE_OPERATOR: ['ROLE_USER'] }), ['ROLE_OPERATOR'])).toEqual([
      { permission: 'entity:books:read', via: 'ROLE_USER' },
    ])
  })

  it('survives a cycle, and a missing provider', () => {
    const p = provider({ A: ['x:a'], B: ['x:b'] }, { A: ['B'], B: ['A'] })
    expect(inheritedGrants(p, ['A'])).toEqual([
      { permission: 'x:a', via: 'A' },
      { permission: 'x:b', via: 'B' },
    ])
    expect(inheritedGrants(null, ['A'])).toEqual([])
  })
})
