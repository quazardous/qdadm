/**
 * Unit tests for the shared client-side list pipeline (qdadm #1192).
 *
 * These helpers replaced byte-identical blocks in 4 storage adapters.
 * The stringMatch modes preserve the historical per-adapter semantics
 * (Memory/Sdk: substring, Local: exact case-insensitive).
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import {
  sortItems,
  filterItems,
  searchItems,
  paginate,
  defaultGenerateId,
} from '../../src/query/clientFilter'

const ITEMS = [
  { id: '1', name: 'Bravo', rank: 2 },
  { id: '2', name: 'alpha', rank: 1 },
  { id: '3', name: 'Charlie', rank: null },
]

describe('clientFilter (#1192)', () => {
  it('sortItems defaults to nulls-last in both directions', () => {
    expect(sortItems([...ITEMS], 'rank', 'asc').map((i) => i.id)).toEqual(['2', '1', '3'])
    expect(sortItems([...ITEMS], 'rank', 'desc').map((i) => i.id)).toEqual(['1', '2', '3'])
    expect(sortItems([...ITEMS]).map((i) => i.id)).toEqual(['1', '2', '3']) // no sort_by = untouched
  })

  it('sortItems null placement is configurable (#1222)', () => {
    // 'low': null = smallest — first in asc, last in desc (the "Never" date case)
    expect(sortItems([...ITEMS], 'rank', 'asc', { nulls: 'low' }).map((i) => i.id)).toEqual(['3', '2', '1'])
    expect(sortItems([...ITEMS], 'rank', 'desc', { nulls: 'low' }).map((i) => i.id)).toEqual(['1', '2', '3'])
    // 'high': null = biggest — last in asc, first in desc
    expect(sortItems([...ITEMS], 'rank', 'asc', { nulls: 'high' }).map((i) => i.id)).toEqual(['2', '1', '3'])
    expect(sortItems([...ITEMS], 'rank', 'desc', { nulls: 'high' }).map((i) => i.id)).toEqual(['3', '1', '2'])
    // 'first': always on top
    expect(sortItems([...ITEMS], 'rank', 'asc', { nulls: 'first' }).map((i) => i.id)).toEqual(['3', '2', '1'])
    expect(sortItems([...ITEMS], 'rank', 'desc', { nulls: 'first' }).map((i) => i.id)).toEqual(['3', '1', '2'])
  })

  it('filterItems includes-mode matches substrings case-insensitively', () => {
    expect(filterItems(ITEMS, { name: 'ALP' }, { stringMatch: 'includes' })).toHaveLength(1)
    expect(filterItems(ITEMS, { name: 'a' }, { stringMatch: 'includes' })).toHaveLength(3)
  })

  it('filterItems exact-mode requires full case-insensitive equality', () => {
    expect(filterItems(ITEMS, { name: 'ALPHA' }, { stringMatch: 'exact' })).toHaveLength(1)
    expect(filterItems(ITEMS, { name: 'alp' }, { stringMatch: 'exact' })).toHaveLength(0)
  })

  it('filterItems skips empty filter values and matches non-strings strictly', () => {
    expect(filterItems(ITEMS, { name: '', rank: null })).toHaveLength(3)
    expect(filterItems(ITEMS, { rank: 2 })).toHaveLength(1)
  })

  it('searchItems substring-matches across all string fields', () => {
    expect(searchItems(ITEMS, 'char')).toHaveLength(1)
    expect(searchItems(ITEMS, '  ')).toHaveLength(3) // blank = no-op
    expect(searchItems(ITEMS, null)).toHaveLength(3)
  })

  it('paginate slices pages', () => {
    expect(paginate(ITEMS, 1, 2).map((i) => i.id)).toEqual(['1', '2'])
    expect(paginate(ITEMS, 2, 2).map((i) => i.id)).toEqual(['3'])
  })

  it('defaultGenerateId yields unique non-empty ids', () => {
    const a = defaultGenerateId()
    const b = defaultGenerateId()
    expect(a).toBeTruthy()
    expect(a).not.toBe(b)
  })
})
