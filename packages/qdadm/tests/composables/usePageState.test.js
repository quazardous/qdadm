/**
 * What the page on screen is doing (#2363): a stack of getters, the innermost page answering.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { registerPageState, currentPageState, activeFilters } from '../../src/composables/usePageState'

const show = { kind: 'show', entity: 'books', loaded: true, loading: false, error: null }
const list = { kind: 'list', entity: 'loans', rows: 2, total: 2, page: 1, pageSize: 20, sort: null, search: '', filters: {}, selected: 0, loading: false }

describe('usePageState (#2363)', () => {
  it('answers null when no page is registered', () => {
    expect(currentPageState()).toBeNull()
  })

  it('the innermost page answers; the outer one answers again once it is gone', () => {
    const leaveShow = registerPageState(() => show)
    const leaveList = registerPageState(() => list)

    expect(currentPageState()).toEqual(list)
    leaveList()
    expect(currentPageState()).toEqual(show)
    leaveShow()
    expect(currentPageState()).toBeNull()
  })

  it('a page leaving out of order does not take another page with it', () => {
    const leaveShow = registerPageState(() => show)
    const leaveList = registerPageState(() => list)

    leaveShow()
    expect(currentPageState()).toEqual(list)
    leaveList()
    expect(currentPageState()).toBeNull()
  })

  it('a getter that throws answers null instead of breaking the caller', () => {
    const leave = registerPageState(() => {
      throw new Error('not ready')
    })

    expect(currentPageState()).toBeNull()
    leave()
  })

  it('keeps only the filters a user set', () => {
    expect(activeFilters({ genre: 'sci-fi', status: null, tags: [], search: '', year: 0, flags: ['a'] })).toEqual({
      genre: 'sci-fi',
      year: 0,
      flags: ['a'],
    })
    expect(activeFilters(undefined)).toEqual({})
  })
})
