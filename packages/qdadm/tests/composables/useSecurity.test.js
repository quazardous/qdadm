/**
 * useSecurity (#2242): a page asks for a permission and gets the managers'
 * own verdict — never a different one.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useSecurity } from '../../src/composables/useSecurity'
import { SecurityChecker } from '../../src/entity/auth/SecurityChecker'
import { EntityAuthAdapter } from '../../src/entity/auth/EntityAuthAdapter'
import { EntityManager } from '../../src/entity/EntityManager'

const user = { id: 1, roles: ['ROLE_USER'] }

/** Mount a component that calls useSecurity(), and hand back what it got. */
const probe = (provide = {}) => {
  let api
  mount(
    defineComponent({
      setup() {
        api = useSecurity()
        return () => h('div')
      },
    }),
    { global: { provide } }
  )
  return api
}

describe('useSecurity (#2242)', () => {
  it('with no security configured, grants — as the managers do', () => {
    const { isGranted } = probe()
    expect(isGranted('offers:debug:write')).toBe(true)
    expect(new EntityManager({ name: 'offers' }).canCreate()).toBe(true)
  })

  it('asks the checker: the application judge first, subject included', () => {
    const calls = []
    const checker = new SecurityChecker({
      rolePermissions: { ROLE_USER: ['offers:debug:read'] },
      grant: {
        isGranted: (attribute, subject) => {
          calls.push([attribute, subject])
          return attribute === 'offers:debug:write' ? false : undefined
        },
      },
      getCurrentUser: () => user,
    })
    const { isGranted } = probe({ qdadmSecurityChecker: checker })

    expect(isGranted('offers:debug:read')).toBe(true) // judge abstains, the matrix grants
    expect(isGranted('offers:debug:write', { id: 9 })).toBe(false)
    expect(calls).toContainEqual(['offers:debug:write', { id: 9 }])
  })

  it('caches nothing: an answer that changes is seen on the next call', () => {
    let allowed = false
    const checker = new SecurityChecker({
      rolePermissions: {},
      grant: { isGranted: () => allowed },
      getCurrentUser: () => user,
    })
    const { isGranted } = probe({ qdadmSecurityChecker: checker })

    expect(isGranted('offers:debug:write')).toBe(false)
    allowed = true
    expect(isGranted('offers:debug:write')).toBe(true)
  })

  it('agrees with manager.canCreate() and canRead() for the same user', () => {
    const checker = new SecurityChecker({
      rolePermissions: { ROLE_USER: ['entity:books:read'] },
      getCurrentUser: () => user,
    })
    const authAdapter = new EntityAuthAdapter()
    authAdapter.setSecurityChecker(checker)
    const books = new EntityManager({ name: 'books', authAdapter })
    const { isGranted } = probe({ qdadmSecurityChecker: checker })

    expect(books.canCreate()).toBe(false)
    expect(books.canRead()).toBe(true)
    expect(isGranted('entity:books:create')).toBe(books.canCreate())
    expect(isGranted('entity:books:read')).toBe(books.canRead())
  })

  it('outside a component setup, says where to ask instead', () => {
    expect(() => useSecurity()).toThrow(/within component setup\(\).*ctx\.security\.isGranted/)
  })
})
