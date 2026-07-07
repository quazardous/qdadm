/**
 * Unit tests for sort persistence (qdadm #1218).
 *
 * sortField/sortOrder are persisted per entity via session storage (same
 * mechanism as filters) and restored on init, defaultSort as fallback.
 * Opt-out via persistSort: false.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getSessionSort,
  setSessionSort,
  clearSessionSort,
} from '../../src/composables/useListPage.utils'

beforeEach(() => sessionStorage.clear())

describe('sort session helpers (#1218)', () => {
  it('round-trips a sort per key', () => {
    setSessionSort('bots', { field: 'lastSeen', order: -1 })
    expect(getSessionSort('bots')).toEqual({ field: 'lastSeen', order: -1 })
    expect(getSessionSort('jobs')).toBeNull() // keyed per entity
  })

  it('returns null for absent or corrupt entries', () => {
    expect(getSessionSort('nope')).toBeNull()
    sessionStorage.setItem('qdadm_sort_bad', '{not json')
    expect(getSessionSort('bad')).toBeNull()
    sessionStorage.setItem('qdadm_sort_weird', JSON.stringify({ field: 'x', order: 5 }))
    expect(getSessionSort('weird')).toBeNull() // invalid order rejected
  })

  it('clearSessionSort removes the entry', () => {
    setSessionSort('bots', { field: 'name', order: 1 })
    clearSessionSort('bots')
    expect(getSessionSort('bots')).toBeNull()
  })
})

describe('sort session — removed-state artifacts (#1222)', () => {
  it('rejects an empty-field entry (removableSort artifact)', () => {
    sessionStorage.setItem('qdadm_sort_bots', JSON.stringify({ field: '', order: 1 }))
    expect(getSessionSort('bots')).toBeNull()
  })

  it('accepts an explicit null field (no sort)', () => {
    setSessionSort('bots', { field: null, order: 1 })
    expect(getSessionSort('bots')).toEqual({ field: null, order: 1 })
  })
})
