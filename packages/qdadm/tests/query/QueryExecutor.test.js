/**
 * QueryExecutor Test Suite
 *
 * Tests for MongoDB-like query execution on arrays.
 * This file covers T257 deliverables (execute, match, implicit operators, nested fields).
 * Comprehensive operator tests are in T261.
 */

import { describe, it, expect } from 'vitest'
import { QueryExecutor, getNestedValue } from '../../src/query/index'

// Sample test data
const books = [
  { id: 1, title: 'Vue 3 Guide', status: 'published', author: { name: 'John', country: 'US' }, year: 2023 },
  { id: 2, title: 'React Handbook', status: 'draft', author: { name: 'Jane', country: 'UK' }, year: 2022 },
  { id: 3, title: 'Angular Basics', status: 'published', author: { name: 'Bob', country: 'CA' }, year: 2021 },
  { id: 4, title: 'Svelte Tutorial', status: 'archived', author: { name: 'Alice', country: 'US' }, year: 2024 },
  { id: 5, title: 'Node.js Deep Dive', status: 'published', author: null, year: null }
]

describe('getNestedValue', () => {
  it('returns value for simple path', () => {
    const obj = { name: 'John' }
    expect(getNestedValue('name', obj)).toBe('John')
  })

  it('returns value for nested path', () => {
    const obj = { author: { name: 'John' } }
    expect(getNestedValue('author.name', obj)).toBe('John')
  })

  it('returns value for deeply nested path', () => {
    const obj = { a: { b: { c: { d: 42 } } } }
    expect(getNestedValue('a.b.c.d', obj)).toBe(42)
  })

  it('returns undefined for missing path', () => {
    const obj = { name: 'John' }
    expect(getNestedValue('email', obj)).toBeUndefined()
  })

  it('returns undefined for missing nested path', () => {
    const obj = { author: { name: 'John' } }
    expect(getNestedValue('author.email', obj)).toBeUndefined()
  })

  it('returns undefined for missing intermediate key', () => {
    const obj = { name: 'John' }
    expect(getNestedValue('author.name', obj)).toBeUndefined()
  })

  it('handles null intermediate values gracefully', () => {
    const obj = { author: null }
    expect(getNestedValue('author.name', obj)).toBeUndefined()
  })

  it('handles undefined intermediate values gracefully', () => {
    const obj = { author: undefined }
    expect(getNestedValue('author.name', obj)).toBeUndefined()
  })

  it('returns undefined for null object', () => {
    expect(getNestedValue('name', null)).toBeUndefined()
  })

  it('returns undefined for undefined object', () => {
    expect(getNestedValue('name', undefined)).toBeUndefined()
  })

  it('returns undefined for invalid path', () => {
    const obj = { name: 'John' }
    expect(getNestedValue('', obj)).toBeUndefined()
    expect(getNestedValue(null, obj)).toBeUndefined()
    expect(getNestedValue(undefined, obj)).toBeUndefined()
  })

  it('handles primitive value at intermediate path', () => {
    const obj = { author: 'John' }
    expect(getNestedValue('author.name', obj)).toBeUndefined()
  })
})

describe('QueryExecutor.execute()', () => {
  describe('empty query', () => {
    it('returns all items for empty object', () => {
      const result = QueryExecutor.execute(books, {})
      expect(result.items).toHaveLength(5)
      expect(result.total).toBe(5)
    })

    it('returns all items for null query', () => {
      const result = QueryExecutor.execute(books, null)
      expect(result.items).toHaveLength(5)
      expect(result.total).toBe(5)
    })

    it('returns all items for undefined query', () => {
      const result = QueryExecutor.execute(books, undefined)
      expect(result.items).toHaveLength(5)
      expect(result.total).toBe(5)
    })
  })

  describe('invalid input', () => {
    it('returns empty for non-array items', () => {
      const result = QueryExecutor.execute('not an array', {})
      expect(result.items).toEqual([])
      expect(result.total).toBe(0)
    })

    it('returns empty for null items', () => {
      const result = QueryExecutor.execute(null, {})
      expect(result.items).toEqual([])
      expect(result.total).toBe(0)
    })

    it('returns empty for undefined items', () => {
      const result = QueryExecutor.execute(undefined, {})
      expect(result.items).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('implicit $eq operator', () => {
    it('filters by exact match for string value', () => {
      const result = QueryExecutor.execute(books, { status: 'published' })
      expect(result.items).toHaveLength(3)
      expect(result.items.every(b => b.status === 'published')).toBe(true)
    })

    it('filters by exact match for number value', () => {
      const result = QueryExecutor.execute(books, { year: 2023 })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].year).toBe(2023)
    })

    it('filters by null value', () => {
      const result = QueryExecutor.execute(books, { year: null })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe(5)
    })

    it('combines multiple fields with implicit $and', () => {
      const result = QueryExecutor.execute(books, { status: 'published', year: 2023 })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe(1)
    })
  })

  describe('implicit $in operator', () => {
    it('filters by array of values', () => {
      const result = QueryExecutor.execute(books, { status: ['published', 'draft'] })
      expect(result.items).toHaveLength(4)
      expect(result.items.every(b => ['published', 'draft'].includes(b.status))).toBe(true)
    })

    it('returns empty for empty array', () => {
      const result = QueryExecutor.execute(books, { status: [] })
      expect(result.items).toHaveLength(0)
    })

    it('works with number arrays', () => {
      const result = QueryExecutor.execute(books, { year: [2022, 2023] })
      expect(result.items).toHaveLength(2)
    })
  })

  describe('nested field access', () => {
    it('filters by nested field with exact match', () => {
      const result = QueryExecutor.execute(books, { 'author.name': 'John' })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe(1)
    })

    it('filters by nested field with array', () => {
      const result = QueryExecutor.execute(books, { 'author.country': ['US', 'UK'] })
      expect(result.items).toHaveLength(3)
    })

    it('handles null parent in nested path', () => {
      // Book 5 has author: null, should not match any author.name
      const result = QueryExecutor.execute(books, { 'author.name': 'John' })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe(1)
    })
  })

  describe('return value', () => {
    it('returns items array and total count', () => {
      const result = QueryExecutor.execute(books, { status: 'published' })
      expect(Array.isArray(result.items)).toBe(true)
      expect(typeof result.total).toBe('number')
      expect(result.total).toBe(result.items.length)
    })

    it('does not mutate original array', () => {
      const original = [...books]
      QueryExecutor.execute(books, { status: 'draft' })
      expect(books).toEqual(original)
    })
  })
})

describe('QueryExecutor.match()', () => {
  const book = { id: 1, title: 'Vue 3 Guide', status: 'published', author: { name: 'John' }, year: 2023 }

  describe('empty query', () => {
    it('returns true for empty object', () => {
      expect(QueryExecutor.match(book, {})).toBe(true)
    })

    it('returns true for null query', () => {
      expect(QueryExecutor.match(book, null)).toBe(true)
    })

    it('returns true for undefined query', () => {
      expect(QueryExecutor.match(book, undefined)).toBe(true)
    })
  })

  describe('invalid item', () => {
    it('returns false for null item', () => {
      expect(QueryExecutor.match(null, { status: 'published' })).toBe(false)
    })

    it('returns false for undefined item', () => {
      expect(QueryExecutor.match(undefined, { status: 'published' })).toBe(false)
    })
  })

  describe('implicit $eq operator', () => {
    it('returns true when value matches', () => {
      expect(QueryExecutor.match(book, { status: 'published' })).toBe(true)
    })

    it('returns false when value does not match', () => {
      expect(QueryExecutor.match(book, { status: 'draft' })).toBe(false)
    })

    it('handles multiple fields', () => {
      expect(QueryExecutor.match(book, { status: 'published', year: 2023 })).toBe(true)
      expect(QueryExecutor.match(book, { status: 'published', year: 2022 })).toBe(false)
    })
  })

  describe('implicit $in operator', () => {
    it('returns true when value is in array', () => {
      expect(QueryExecutor.match(book, { status: ['published', 'draft'] })).toBe(true)
    })

    it('returns false when value is not in array', () => {
      expect(QueryExecutor.match(book, { status: ['draft', 'archived'] })).toBe(false)
    })

    it('returns false for empty array', () => {
      expect(QueryExecutor.match(book, { status: [] })).toBe(false)
    })
  })

  describe('nested field access', () => {
    it('returns true for matching nested value', () => {
      expect(QueryExecutor.match(book, { 'author.name': 'John' })).toBe(true)
    })

    it('returns false for non-matching nested value', () => {
      expect(QueryExecutor.match(book, { 'author.name': 'Jane' })).toBe(false)
    })
  })
})

describe('comparison operators (T258)', () => {
  describe('$eq operator', () => {
    it('matches equal values', () => {
      const result = QueryExecutor.execute(books, { year: { $eq: 2023 } })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].year).toBe(2023)
    })

    it('uses strict equality', () => {
      const items = [{ value: '5' }, { value: 5 }]
      const result = QueryExecutor.execute(items, { value: { $eq: 5 } })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].value).toBe(5)
    })

    it('null equals null', () => {
      const result = QueryExecutor.execute(books, { year: { $eq: null } })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe(5)
    })
  })

  describe('$ne operator', () => {
    it('matches non-equal values', () => {
      const result = QueryExecutor.execute(books, { status: { $ne: 'published' } })
      expect(result.items).toHaveLength(2)
      expect(result.items.every(b => b.status !== 'published')).toBe(true)
    })

    it('uses strict inequality', () => {
      const items = [{ value: '5' }, { value: 5 }, { value: 6 }]
      const result = QueryExecutor.execute(items, { value: { $ne: 5 } })
      expect(result.items).toHaveLength(2) // '5' and 6
    })

    it('null !== undefined', () => {
      const items = [{ value: null }, { value: undefined }]
      const result = QueryExecutor.execute(items, { value: { $ne: null } })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].value).toBeUndefined()
    })

    it('$ne null matches non-null values (loans returned filter)', () => {
      // Simulates loans filter: active = returned_at is null, returned = returned_at is not null
      const loans = [
        { id: 1, returned_at: '2024-03-01T14:30:00.000Z' },  // returned
        { id: 2, returned_at: null },                         // active
        { id: 3, returned_at: null }                          // active
      ]

      // Filter for "returned" loans (returned_at is NOT null)
      const returned = QueryExecutor.execute(loans, { returned_at: { $ne: null } })
      expect(returned.items).toHaveLength(1)
      expect(returned.items[0].id).toBe(1)

      // Filter for "active" loans (returned_at IS null)
      const active = QueryExecutor.execute(loans, { returned_at: null })
      expect(active.items).toHaveLength(2)
      expect(active.items.map(l => l.id)).toEqual([2, 3])
    })
  })

  describe('$gt operator', () => {
    it('matches greater than values', () => {
      const result = QueryExecutor.execute(books, { year: { $gt: 2022 } })
      expect(result.items).toHaveLength(2)
      expect(result.items.every(b => b.year > 2022)).toBe(true)
    })

    it('returns false for null values', () => {
      const result = QueryExecutor.execute([{ value: null }], { value: { $gt: 0 } })
      expect(result.items).toHaveLength(0)
    })

    it('returns false for undefined values', () => {
      const result = QueryExecutor.execute([{ value: undefined }], { value: { $gt: 0 } })
      expect(result.items).toHaveLength(0)
    })

    it('rejects different types (no coercion)', () => {
      const items = [{ value: '5' }, { value: 5 }]
      const result = QueryExecutor.execute(items, { value: { $gt: 4 } })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].value).toBe(5) // string '5' is rejected
    })

    it('works with strings', () => {
      const items = [{ name: 'alice' }, { name: 'bob' }, { name: 'charlie' }]
      const result = QueryExecutor.execute(items, { name: { $gt: 'bob' } })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].name).toBe('charlie')
    })
  })

  describe('$gte operator', () => {
    it('matches greater than or equal values', () => {
      const result = QueryExecutor.execute(books, { year: { $gte: 2023 } })
      expect(result.items).toHaveLength(2)
    })

    it('returns false for null values', () => {
      const result = QueryExecutor.execute([{ value: null }], { value: { $gte: 0 } })
      expect(result.items).toHaveLength(0)
    })

    it('rejects different types (no coercion)', () => {
      const items = [{ value: '5' }, { value: 5 }]
      const result = QueryExecutor.execute(items, { value: { $gte: 5 } })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].value).toBe(5)
    })
  })

  describe('$lt operator', () => {
    it('matches less than values', () => {
      const result = QueryExecutor.execute(books, { year: { $lt: 2023 } })
      expect(result.items).toHaveLength(2)
      expect(result.items.every(b => b.year !== null && b.year < 2023)).toBe(true)
    })

    it('returns false for null values', () => {
      const result = QueryExecutor.execute([{ value: null }], { value: { $lt: 10 } })
      expect(result.items).toHaveLength(0)
    })

    it('rejects different types (no coercion)', () => {
      const items = [{ value: '3' }, { value: 3 }]
      const result = QueryExecutor.execute(items, { value: { $lt: 4 } })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].value).toBe(3)
    })
  })

  describe('$lte operator', () => {
    it('matches less than or equal values', () => {
      const result = QueryExecutor.execute(books, { year: { $lte: 2022 } })
      expect(result.items).toHaveLength(2)
    })

    it('returns false for null values', () => {
      const result = QueryExecutor.execute([{ value: null }], { value: { $lte: 10 } })
      expect(result.items).toHaveLength(0)
    })

    it('rejects different types (no coercion)', () => {
      const items = [{ value: '5' }, { value: 5 }]
      const result = QueryExecutor.execute(items, { value: { $lte: 5 } })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].value).toBe(5)
    })
  })

  describe('combined comparison operators', () => {
    it('supports range queries', () => {
      const result = QueryExecutor.execute(books, { year: { $gt: 2021, $lt: 2024 } })
      expect(result.items).toHaveLength(2)
      expect(result.items.every(b => b.year > 2021 && b.year < 2024)).toBe(true)
    })

    it('supports inclusive range queries', () => {
      const result = QueryExecutor.execute(books, { year: { $gte: 2022, $lte: 2023 } })
      expect(result.items).toHaveLength(2)
    })
  })
})

describe('set operators (preview)', () => {
  // Set operators tests

  describe('$in operator (explicit)', () => {
    it('matches values in array', () => {
      const result = QueryExecutor.execute(books, { status: { $in: ['published', 'draft'] } })
      expect(result.items).toHaveLength(4)
    })
  })

  describe('$like operator', () => {
    it('matches case-insensitive substring', () => {
      const result = QueryExecutor.execute(books, { title: { $like: 'guide' } })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].title).toBe('Vue 3 Guide')
    })
  })

  describe('$between operator', () => {
    it('matches values in range (inclusive)', () => {
      const result = QueryExecutor.execute(books, { year: { $between: [2022, 2023] } })
      expect(result.items).toHaveLength(2)
      expect(result.items.every(b => b.year >= 2022 && b.year <= 2023)).toBe(true)
    })
  })

  describe('$or operator', () => {
    it('matches when any condition is true', () => {
      const result = QueryExecutor.execute(books, {
        $or: [{ status: 'draft' }, { status: 'archived' }]
      })
      expect(result.items).toHaveLength(2)
    })
  })

  describe('$and operator', () => {
    it('matches when all conditions are true', () => {
      const result = QueryExecutor.execute(books, {
        $and: [{ status: 'published' }, { 'author.country': 'US' }]
      })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe(1)
    })
  })
})
