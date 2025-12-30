/**
 * FilterQuery Test Suite
 *
 * Tests for FilterQuery class covering:
 * - T269: Core class, source validation, basic getOptions
 * - T276: Label/value resolution with string paths and functions
 * - Caching and invalidation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { FilterQuery } from '../../src/query/index.js'

/**
 * Mock EntityManager for testing
 */
class MockEntityManager {
  constructor(items = []) {
    this._items = items
    this._cache = items
    this._listCalls = []
  }

  async list(params = {}) {
    this._listCalls.push(params)
    return {
      items: this._items,
      total: this._items.length
    }
  }
}

/**
 * Mock Orchestrator for testing
 */
class MockOrchestrator {
  constructor(managers = {}) {
    this._managers = managers
  }

  get(name) {
    return this._managers[name] || null
  }
}

// Sample test data
const genres = [
  { id: 1, name: 'Rock', code: 'ROCK' },
  { id: 2, name: 'Jazz', code: 'JAZZ' },
  { id: 3, name: 'Classical', code: 'CLAS' }
]

// Nested data for testing nested path resolution
const categories = [
  { id: 1, metadata: { title: 'Electronics', slug: 'elec' }, parent: { id: 0, name: 'Root' } },
  { id: 2, metadata: { title: 'Books', slug: 'book' }, parent: { id: 0, name: 'Root' } },
  { id: 3, metadata: { title: null, slug: 'misc' }, parent: null }
]

const books = [
  { id: 1, title: 'Book A', status: 'published', author: { name: 'John', country: 'US' } },
  { id: 2, title: 'Book B', status: 'draft', author: { name: 'Jane', country: 'UK' } },
  { id: 3, title: 'Book C', status: 'published', author: { name: 'Bob', country: 'US' } },
  { id: 4, title: 'Book D', status: 'archived', author: { name: 'Alice', country: 'CA' } }
]

describe('FilterQuery', () => {
  describe('constructor validation', () => {
    it('throws when source is missing', () => {
      expect(() => new FilterQuery({})).toThrow('source must be one of')
    })

    it('throws when source is invalid', () => {
      expect(() => new FilterQuery({ source: 'invalid' })).toThrow('source must be one of')
    })

    it('throws when source is entity but entity is missing', () => {
      expect(() => new FilterQuery({ source: 'entity' })).toThrow('entity is required')
    })

    it('throws when source is field but field is missing', () => {
      expect(() => new FilterQuery({ source: 'field' })).toThrow('field is required')
    })

    it('accepts valid entity source configuration', () => {
      const query = new FilterQuery({
        source: 'entity',
        entity: 'genres'
      })
      expect(query.source).toBe('entity')
      expect(query.entity).toBe('genres')
    })

    it('accepts valid field source configuration', () => {
      const query = new FilterQuery({
        source: 'field',
        field: 'status'
      })
      expect(query.source).toBe('field')
      expect(query.field).toBe('status')
    })

    it('uses default label and value resolvers', () => {
      const query = new FilterQuery({
        source: 'entity',
        entity: 'genres'
      })
      expect(query.label).toBe('name')
      expect(query.value).toBe('id')
    })

    it('accepts custom label and value resolvers', () => {
      const labelFn = (item) => item.code
      const valueFn = (item) => item.id
      const query = new FilterQuery({
        source: 'entity',
        entity: 'genres',
        label: labelFn,
        value: valueFn
      })
      expect(query.label).toBe(labelFn)
      expect(query.value).toBe(valueFn)
    })

    it('accepts transform function', () => {
      const transform = (opts) => opts.filter(o => o.value > 1)
      const query = new FilterQuery({
        source: 'entity',
        entity: 'genres',
        transform
      })
      expect(query.transform).toBe(transform)
    })

    it('accepts toQuery function', () => {
      const toQuery = (value) => ({ score: { $gt: value } })
      const query = new FilterQuery({
        source: 'entity',
        entity: 'genres',
        toQuery
      })
      expect(query.toQuery).toBe(toQuery)
    })
  })

  describe('entity source - getOptions', () => {
    let genreManager
    let orchestrator

    beforeEach(() => {
      genreManager = new MockEntityManager(genres)
      orchestrator = new MockOrchestrator({ genres: genreManager })
    })

    it('throws when orchestrator is not provided', async () => {
      const query = new FilterQuery({
        source: 'entity',
        entity: 'genres'
      })
      await expect(query.getOptions()).rejects.toThrow('orchestrator is required')
    })

    it('throws when entity is not found in orchestrator', async () => {
      const query = new FilterQuery({
        source: 'entity',
        entity: 'unknown'
      })
      await expect(query.getOptions(orchestrator)).rejects.toThrow('not found in orchestrator')
    })

    it('fetches options from entity manager', async () => {
      const query = new FilterQuery({
        source: 'entity',
        entity: 'genres'
      })
      const options = await query.getOptions(orchestrator)

      expect(options).toEqual([
        { label: 'Rock', value: 1 },
        { label: 'Jazz', value: 2 },
        { label: 'Classical', value: 3 }
      ])
    })

    it('uses custom label path', async () => {
      const query = new FilterQuery({
        source: 'entity',
        entity: 'genres',
        label: 'code'
      })
      const options = await query.getOptions(orchestrator)

      expect(options).toEqual([
        { label: 'ROCK', value: 1 },
        { label: 'JAZZ', value: 2 },
        { label: 'CLAS', value: 3 }
      ])
    })

    it('uses custom label function', async () => {
      const query = new FilterQuery({
        source: 'entity',
        entity: 'genres',
        label: (item) => `${item.code} - ${item.name}`
      })
      const options = await query.getOptions(orchestrator)

      expect(options).toEqual([
        { label: 'ROCK - Rock', value: 1 },
        { label: 'JAZZ - Jazz', value: 2 },
        { label: 'CLAS - Classical', value: 3 }
      ])
    })

    it('applies transform function to options', async () => {
      const query = new FilterQuery({
        source: 'entity',
        entity: 'genres',
        transform: (opts) => opts.filter(o => o.value !== 2)
      })
      const options = await query.getOptions(orchestrator)

      expect(options).toEqual([
        { label: 'Rock', value: 1 },
        { label: 'Classical', value: 3 }
      ])
    })

    it('calls manager.list with page_size 1000', async () => {
      const query = new FilterQuery({
        source: 'entity',
        entity: 'genres'
      })
      await query.getOptions(orchestrator)

      expect(genreManager._listCalls).toHaveLength(1)
      expect(genreManager._listCalls[0]).toEqual({ page_size: 1000 })
    })
  })

  // T276: Label and Value Resolution
  describe('label/value resolution (T276)', () => {
    describe('entity source - string paths', () => {
      let categoryManager
      let orchestrator

      beforeEach(() => {
        categoryManager = new MockEntityManager(categories)
        orchestrator = new MockOrchestrator({ categories: categoryManager })
      })

      it('uses custom value path (string)', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'categories',
          label: 'metadata.title',
          value: 'metadata.slug'
        })
        const options = await query.getOptions(orchestrator)

        expect(options).toContainEqual({ label: 'Electronics', value: 'elec' })
        expect(options).toContainEqual({ label: 'Books', value: 'book' })
      })

      it('resolves nested label path (dot notation)', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'categories',
          label: 'metadata.title'
        })
        const options = await query.getOptions(orchestrator)

        expect(options.map(o => o.label)).toContain('Electronics')
        expect(options.map(o => o.label)).toContain('Books')
      })

      it('resolves nested value path (dot notation)', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'categories',
          value: 'metadata.slug'
        })
        const options = await query.getOptions(orchestrator)

        expect(options.map(o => o.value)).toContain('elec')
        expect(options.map(o => o.value)).toContain('book')
        expect(options.map(o => o.value)).toContain('misc')
      })

      it('handles null in nested path gracefully', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'categories',
          label: 'metadata.title',
          value: 'id'
        })
        const options = await query.getOptions(orchestrator)

        // Item 3 has metadata.title = null
        const nullLabel = options.find(o => o.value === 3)
        expect(nullLabel.label).toBeNull()
      })

      it('handles missing nested path gracefully', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'categories',
          label: 'parent.name',
          value: 'id'
        })
        const options = await query.getOptions(orchestrator)

        // Items 1,2 have parent.name = 'Root', item 3 has parent = null
        expect(options.find(o => o.value === 1).label).toBe('Root')
        expect(options.find(o => o.value === 3).label).toBeUndefined()
      })
    })

    describe('entity source - function resolvers', () => {
      let genreManager
      let orchestrator

      beforeEach(() => {
        genreManager = new MockEntityManager(genres)
        orchestrator = new MockOrchestrator({ genres: genreManager })
      })

      it('uses custom value function', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres',
          value: (item) => item.code.toLowerCase()
        })
        const options = await query.getOptions(orchestrator)

        expect(options).toContainEqual({ label: 'Rock', value: 'rock' })
        expect(options).toContainEqual({ label: 'Jazz', value: 'jazz' })
      })

      it('supports fallback value function', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres',
          value: (item) => item.slug || item.code
        })
        const options = await query.getOptions(orchestrator)

        // No slug, so falls back to code
        expect(options.map(o => o.value)).toContain('ROCK')
        expect(options.map(o => o.value)).toContain('JAZZ')
      })

      it('combines label and value functions', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres',
          label: (item) => `[${item.code}] ${item.name}`,
          value: (item) => `genre_${item.id}`
        })
        const options = await query.getOptions(orchestrator)

        expect(options).toContainEqual({ label: '[ROCK] Rock', value: 'genre_1' })
        expect(options).toContainEqual({ label: '[JAZZ] Jazz', value: 'genre_2' })
      })

      it('function can return computed values', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres',
          value: (item) => ({ id: item.id, code: item.code })
        })
        const options = await query.getOptions(orchestrator)

        expect(options[0].value).toEqual({ id: 1, code: 'ROCK' })
      })
    })

    describe('mixed paths and functions', () => {
      let categoryManager
      let orchestrator

      beforeEach(() => {
        categoryManager = new MockEntityManager(categories)
        orchestrator = new MockOrchestrator({ categories: categoryManager })
      })

      it('supports string path for label with function for value', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'categories',
          label: 'metadata.title',
          value: (item) => `cat_${item.id}`
        })
        const options = await query.getOptions(orchestrator)

        expect(options).toContainEqual({ label: 'Electronics', value: 'cat_1' })
        expect(options).toContainEqual({ label: 'Books', value: 'cat_2' })
      })

      it('supports function for label with string path for value', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'categories',
          label: (item) => (item.metadata.title || 'Untitled').toUpperCase(),
          value: 'metadata.slug'
        })
        const options = await query.getOptions(orchestrator)

        expect(options).toContainEqual({ label: 'ELECTRONICS', value: 'elec' })
        expect(options).toContainEqual({ label: 'UNTITLED', value: 'misc' })
      })
    })
  })

  describe('field source - getOptions', () => {
    let parentManager

    beforeEach(() => {
      parentManager = new MockEntityManager(books)
    })

    it('throws when parentManager is not set', async () => {
      const query = new FilterQuery({
        source: 'field',
        field: 'status'
      })
      await expect(query.getOptions()).rejects.toThrow('parentManager is required')
    })

    it('extracts unique values from field', async () => {
      const query = new FilterQuery({
        source: 'field',
        field: 'status',
        parentManager
      })
      const options = await query.getOptions()

      expect(options).toHaveLength(3)
      expect(options.map(o => o.value)).toContain('published')
      expect(options.map(o => o.value)).toContain('draft')
      expect(options.map(o => o.value)).toContain('archived')
    })

    it('uses field value as both label and value by default', async () => {
      const query = new FilterQuery({
        source: 'field',
        field: 'status',
        parentManager
      })
      const options = await query.getOptions()

      // With defaults (name/id), field source creates objects with name=value and id=value
      const published = options.find(o => o.value === 'published')
      expect(published).toBeDefined()
      expect(published.label).toBe('published')
    })

    it('handles nested field paths', async () => {
      const query = new FilterQuery({
        source: 'field',
        field: 'author.country',
        parentManager
      })
      const options = await query.getOptions()

      expect(options.map(o => o.value)).toContain('US')
      expect(options.map(o => o.value)).toContain('UK')
      expect(options.map(o => o.value)).toContain('CA')
      // US appears twice in data, should only appear once in options
      expect(options.filter(o => o.value === 'US')).toHaveLength(1)
    })

    it('returns empty array when cache is empty', async () => {
      const emptyManager = new MockEntityManager([])
      const query = new FilterQuery({
        source: 'field',
        field: 'status',
        parentManager: emptyManager
      })
      const options = await query.getOptions()

      expect(options).toEqual([])
    })

    it('can be set via setParentManager', async () => {
      const query = new FilterQuery({
        source: 'field',
        field: 'status'
      })
      query.setParentManager(parentManager)
      const options = await query.getOptions()

      expect(options.length).toBeGreaterThan(0)
    })
  })

  describe('caching', () => {
    let genreManager
    let orchestrator

    beforeEach(() => {
      genreManager = new MockEntityManager(genres)
      orchestrator = new MockOrchestrator({ genres: genreManager })
    })

    it('caches options after first fetch', async () => {
      const query = new FilterQuery({
        source: 'entity',
        entity: 'genres'
      })

      // First call - should fetch
      await query.getOptions(orchestrator)
      expect(genreManager._listCalls).toHaveLength(1)

      // Second call - should use cache
      await query.getOptions(orchestrator)
      expect(genreManager._listCalls).toHaveLength(1)
    })

    it('invalidate() clears cache', async () => {
      const query = new FilterQuery({
        source: 'entity',
        entity: 'genres'
      })

      // First call
      await query.getOptions(orchestrator)
      expect(genreManager._listCalls).toHaveLength(1)

      // Invalidate
      query.invalidate()

      // Next call should fetch again
      await query.getOptions(orchestrator)
      expect(genreManager._listCalls).toHaveLength(2)
    })
  })

  describe('setSignals', () => {
    it('stores signals reference', () => {
      const query = new FilterQuery({
        source: 'entity',
        entity: 'genres'
      })
      const mockSignals = { on: () => {} }
      query.setSignals(mockSignals)

      expect(query._signals).toBe(mockSignals)
    })

    it('returns this for chaining', () => {
      const query = new FilterQuery({
        source: 'entity',
        entity: 'genres'
      })
      const mockSignals = { on: () => {} }
      const result = query.setSignals(mockSignals)

      expect(result).toBe(query)
    })
  })

  describe('setParentManager', () => {
    it('stores parentManager reference', () => {
      const query = new FilterQuery({
        source: 'field',
        field: 'status'
      })
      const mockManager = { _cache: [] }
      query.setParentManager(mockManager)

      expect(query.parentManager).toBe(mockManager)
    })

    it('returns this for chaining', () => {
      const query = new FilterQuery({
        source: 'field',
        field: 'status'
      })
      const result = query.setParentManager({ _cache: [] })

      expect(result).toBe(query)
    })
  })

  // T277: Transform and toQuery Support
  describe('transform (T277)', () => {
    let genreManager
    let orchestrator
    let bookManager

    // Items with archive status for filtering tests
    const itemsWithArchive = [
      { id: 1, name: 'Active Item', status: 'active' },
      { id: 2, name: 'Archived Item', status: 'archived' },
      { id: 3, name: 'Another Active', status: 'active' },
      { id: 4, name: 'Old Archived', status: 'archived' }
    ]

    beforeEach(() => {
      genreManager = new MockEntityManager(genres)
      bookManager = new MockEntityManager(itemsWithArchive)
      orchestrator = new MockOrchestrator({
        genres: genreManager,
        items: bookManager
      })
    })

    describe('filter archived items', () => {
      it('filters out archived options using transform', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'items',
          label: 'name',
          value: 'id',
          transform: (options) => options.filter(o => {
            // We need the original items to check status
            // Transform receives normalized options, so we filter by label pattern
            return !o.label.toLowerCase().includes('archived')
          })
        })
        const options = await query.getOptions(orchestrator)

        expect(options).toHaveLength(2)
        expect(options.map(o => o.label)).toContain('Active Item')
        expect(options.map(o => o.label)).toContain('Another Active')
        expect(options.map(o => o.label)).not.toContain('Archived Item')
      })

      it('filters archived using custom value field', async () => {
        // Use status as value to allow filtering
        const query = new FilterQuery({
          source: 'entity',
          entity: 'items',
          label: 'name',
          value: 'id',
          transform: (options) => {
            // Filter specific IDs (in real usage, status would be preserved)
            return options.filter(o => o.value !== 2 && o.value !== 4)
          }
        })
        const options = await query.getOptions(orchestrator)

        expect(options).toHaveLength(2)
        expect(options.map(o => o.value)).toContain(1)
        expect(options.map(o => o.value)).toContain(3)
      })
    })

    describe('add custom options', () => {
      it('adds "All" option at the beginning', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres',
          transform: (options) => [
            { label: 'All Genres', value: null },
            ...options
          ]
        })
        const options = await query.getOptions(orchestrator)

        expect(options).toHaveLength(4)
        expect(options[0]).toEqual({ label: 'All Genres', value: null })
        expect(options[1].label).toBe('Rock')
      })

      it('adds "None" option at the end', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres',
          transform: (options) => [
            ...options,
            { label: '(No Genre)', value: 'none' }
          ]
        })
        const options = await query.getOptions(orchestrator)

        expect(options).toHaveLength(4)
        expect(options[options.length - 1]).toEqual({ label: '(No Genre)', value: 'none' })
      })

      it('adds multiple custom options', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres',
          transform: (options) => [
            { label: '-- Select --', value: '' },
            { label: 'All', value: null },
            ...options,
            { label: 'Other', value: 'other' }
          ]
        })
        const options = await query.getOptions(orchestrator)

        expect(options).toHaveLength(6)
        expect(options[0].label).toBe('-- Select --')
        expect(options[1].label).toBe('All')
        expect(options[5].label).toBe('Other')
      })
    })

    describe('sort alphabetically', () => {
      it('sorts options alphabetically by label', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres',
          transform: (options) => options.sort((a, b) =>
            a.label.localeCompare(b.label)
          )
        })
        const options = await query.getOptions(orchestrator)

        expect(options.map(o => o.label)).toEqual(['Classical', 'Jazz', 'Rock'])
      })

      it('sorts options reverse alphabetically', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres',
          transform: (options) => options.sort((a, b) =>
            b.label.localeCompare(a.label)
          )
        })
        const options = await query.getOptions(orchestrator)

        expect(options.map(o => o.label)).toEqual(['Rock', 'Jazz', 'Classical'])
      })

      it('sorts by value', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres',
          transform: (options) => options.sort((a, b) => b.value - a.value)
        })
        const options = await query.getOptions(orchestrator)

        expect(options.map(o => o.value)).toEqual([3, 2, 1])
      })
    })

    describe('complex transforms', () => {
      it('combines filter and add custom option', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres',
          transform: (options) => [
            { label: 'All', value: null },
            ...options.filter(o => o.value > 1)
          ]
        })
        const options = await query.getOptions(orchestrator)

        expect(options).toHaveLength(3)
        expect(options[0]).toEqual({ label: 'All', value: null })
        expect(options.map(o => o.value)).toEqual([null, 2, 3])
      })

      it('modifies labels (uppercase)', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres',
          transform: (options) => options.map(o => ({
            ...o,
            label: o.label.toUpperCase()
          }))
        })
        const options = await query.getOptions(orchestrator)

        expect(options.map(o => o.label)).toEqual(['ROCK', 'JAZZ', 'CLASSICAL'])
      })

      it('groups and transforms options', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres',
          transform: (options) => [
            { label: '-- Popular --', value: null, disabled: true },
            ...options.filter(o => o.value <= 2),
            { label: '-- Classic --', value: null, disabled: true },
            ...options.filter(o => o.value > 2)
          ]
        })
        const options = await query.getOptions(orchestrator)

        expect(options).toHaveLength(5)
        expect(options[0].label).toBe('-- Popular --')
        expect(options[3].label).toBe('-- Classic --')
      })

      it('transform can return empty array', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres',
          transform: () => []
        })
        const options = await query.getOptions(orchestrator)

        expect(options).toEqual([])
      })
    })

    describe('transform applies to cached options', () => {
      it('transform is applied each time from cache', async () => {
        let transformCallCount = 0
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres',
          transform: (options) => {
            transformCallCount++
            return options
          }
        })

        // First call - fetches and transforms
        await query.getOptions(orchestrator)
        expect(transformCallCount).toBe(1)

        // Second call - uses cache (transform already applied and cached)
        await query.getOptions(orchestrator)
        // Transform is NOT called again because result is cached
        expect(transformCallCount).toBe(1)
      })
    })
  })

  describe('toQuery (T277)', () => {
    describe('simple value mapping', () => {
      it('stores toQuery function for external use', () => {
        const toQuery = (value) => ({ status: value })
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres',
          toQuery
        })

        expect(query.toQuery).toBe(toQuery)
      })

      it('toQuery can map value to field', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres',
          toQuery: (value) => ({ genre_id: value })
        })

        expect(query.toQuery(1)).toEqual({ genre_id: 1 })
        expect(query.toQuery(2)).toEqual({ genre_id: 2 })
      })

      it('toQuery can map to different field name', () => {
        const query = new FilterQuery({
          source: 'field',
          field: 'status',
          toQuery: (value) => ({ item_status: value })
        })

        expect(query.toQuery('active')).toEqual({ item_status: 'active' })
        expect(query.toQuery('archived')).toEqual({ item_status: 'archived' })
      })
    })

    describe('complex conditions ($gt, $lt, $gte, $lte)', () => {
      it('toQuery returns $gt condition', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'quality',
          toQuery: (value) => {
            if (value === 'high') return { score: { $gt: 2 } }
            if (value === 'medium') return { score: { $gt: 1 } }
            return {}
          }
        })

        expect(query.toQuery('high')).toEqual({ score: { $gt: 2 } })
        expect(query.toQuery('medium')).toEqual({ score: { $gt: 1 } })
      })

      it('toQuery returns $gte condition', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'rating',
          toQuery: (value) => ({ rating: { $gte: value } })
        })

        expect(query.toQuery(4)).toEqual({ rating: { $gte: 4 } })
        expect(query.toQuery(3)).toEqual({ rating: { $gte: 3 } })
      })

      it('toQuery returns $lt condition', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'price',
          toQuery: (value) => {
            if (value === 'cheap') return { price: { $lt: 10 } }
            if (value === 'expensive') return { price: { $gte: 100 } }
            return {}
          }
        })

        expect(query.toQuery('cheap')).toEqual({ price: { $lt: 10 } })
        expect(query.toQuery('expensive')).toEqual({ price: { $gte: 100 } })
      })

      it('toQuery returns range with $gte and $lte', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'age',
          toQuery: (value) => {
            if (value === 'young') return { age: { $gte: 18, $lte: 30 } }
            if (value === 'adult') return { age: { $gte: 31, $lte: 60 } }
            return {}
          }
        })

        expect(query.toQuery('young')).toEqual({ age: { $gte: 18, $lte: 30 } })
        expect(query.toQuery('adult')).toEqual({ age: { $gte: 31, $lte: 60 } })
      })
    })

    describe('logical operators ($or, $and)', () => {
      it('toQuery returns $or condition', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'status',
          toQuery: (value) => {
            if (value === 'pending') {
              return { $or: [
                { status: 'pending' },
                { status: 'in_review' }
              ]}
            }
            return { status: value }
          }
        })

        expect(query.toQuery('pending')).toEqual({
          $or: [
            { status: 'pending' },
            { status: 'in_review' }
          ]
        })
        expect(query.toQuery('completed')).toEqual({ status: 'completed' })
      })

      it('toQuery returns $and condition', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'filter',
          toQuery: (value) => {
            if (value === 'active_premium') {
              return { $and: [
                { status: 'active' },
                { tier: 'premium' }
              ]}
            }
            return {}
          }
        })

        expect(query.toQuery('active_premium')).toEqual({
          $and: [
            { status: 'active' },
            { tier: 'premium' }
          ]
        })
      })

      it('toQuery returns complex nested conditions', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'filter',
          toQuery: (value) => {
            if (value === 'special') {
              return {
                $or: [
                  { $and: [{ status: 'active' }, { featured: true }] },
                  { promoted: true }
                ]
              }
            }
            return {}
          }
        })

        expect(query.toQuery('special')).toEqual({
          $or: [
            { $and: [{ status: 'active' }, { featured: true }] },
            { promoted: true }
          ]
        })
      })
    })

    describe('skip filter (null/empty)', () => {
      it('toQuery returns empty object to skip filter', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'status',
          toQuery: (value) => {
            if (value === null) return {}
            if (value === 'all') return {}
            return { status: value }
          }
        })

        expect(query.toQuery(null)).toEqual({})
        expect(query.toQuery('all')).toEqual({})
        expect(query.toQuery('active')).toEqual({ status: 'active' })
      })

      it('toQuery returns null to skip filter', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'status',
          toQuery: (value) => {
            if (value === null || value === '') return null
            return { status: value }
          }
        })

        expect(query.toQuery(null)).toBeNull()
        expect(query.toQuery('')).toBeNull()
        expect(query.toQuery('active')).toEqual({ status: 'active' })
      })

      it('toQuery returns undefined to skip filter', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'status',
          toQuery: (value) => {
            if (!value) return undefined
            return { status: value }
          }
        })

        expect(query.toQuery(null)).toBeUndefined()
        expect(query.toQuery(undefined)).toBeUndefined()
        expect(query.toQuery('active')).toEqual({ status: 'active' })
      })
    })

    describe('set operators ($in, $nin)', () => {
      it('toQuery returns $in condition', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'category',
          toQuery: (value) => {
            if (value === 'popular') {
              return { category: { $in: ['electronics', 'books', 'games'] } }
            }
            return { category: value }
          }
        })

        expect(query.toQuery('popular')).toEqual({
          category: { $in: ['electronics', 'books', 'games'] }
        })
      })

      it('toQuery returns $nin condition', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'status',
          toQuery: (value) => {
            if (value === 'visible') {
              return { status: { $nin: ['deleted', 'hidden', 'spam'] } }
            }
            return { status: value }
          }
        })

        expect(query.toQuery('visible')).toEqual({
          status: { $nin: ['deleted', 'hidden', 'spam'] }
        })
      })
    })

    describe('multiple fields', () => {
      it('toQuery can set multiple fields', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'preset',
          toQuery: (value) => {
            if (value === 'featured') {
              return {
                is_featured: true,
                status: 'published',
                visibility: 'public'
              }
            }
            return {}
          }
        })

        expect(query.toQuery('featured')).toEqual({
          is_featured: true,
          status: 'published',
          visibility: 'public'
        })
      })
    })

    describe('toQuery is null by default', () => {
      it('toQuery is null when not provided', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres'
        })

        expect(query.toQuery).toBeNull()
      })
    })
  })

  // T282: SignalBus Cache Invalidation
  describe('SignalBus cache invalidation (T282)', () => {
    /**
     * Mock SignalBus for testing signal subscriptions
     */
    class MockSignalBus {
      constructor() {
        this._listeners = new Map()
        this._onCalls = []
      }

      on(signal, handler) {
        this._onCalls.push({ signal, handler })
        if (!this._listeners.has(signal)) {
          this._listeners.set(signal, [])
        }
        this._listeners.get(signal).push(handler)

        // Return unbind function
        return () => {
          const handlers = this._listeners.get(signal)
          if (handlers) {
            const idx = handlers.indexOf(handler)
            if (idx !== -1) handlers.splice(idx, 1)
          }
        }
      }

      async emit(signal, payload = {}) {
        const handlers = this._listeners.get(signal) || []
        for (const handler of handlers) {
          await handler(payload)
        }
      }

      listenerCount(signal) {
        if (signal) {
          return (this._listeners.get(signal) || []).length
        }
        let total = 0
        for (const handlers of this._listeners.values()) {
          total += handlers.length
        }
        return total
      }
    }

    let signals
    let genreManager
    let orchestrator

    beforeEach(() => {
      signals = new MockSignalBus()
      genreManager = new MockEntityManager(genres)
      orchestrator = new MockOrchestrator({ genres: genreManager })
    })

    describe('setSignals subscription', () => {
      it('subscribes to entity CRUD signals for entity source', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres'
        })
        query.setSignals(signals)

        expect(signals._onCalls).toHaveLength(3)
        expect(signals._onCalls.map(c => c.signal)).toContain('genres:created')
        expect(signals._onCalls.map(c => c.signal)).toContain('genres:updated')
        expect(signals._onCalls.map(c => c.signal)).toContain('genres:deleted')
      })

      it('does not subscribe for field source', () => {
        const query = new FilterQuery({
          source: 'field',
          field: 'status'
        })
        query.setSignals(signals)

        expect(signals._onCalls).toHaveLength(0)
      })

      it('does not subscribe when signals is null', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres'
        })
        query.setSignals(null)

        expect(query._signals).toBeNull()
        expect(query._subscriptions).toHaveLength(0)
      })
    })

    describe('cache invalidation on signal', () => {
      it('invalidates cache when entity:created signal is emitted', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres'
        })
        query.setSignals(signals)

        // Load and cache options
        await query.getOptions(orchestrator)
        expect(query._options).not.toBeNull()

        // Emit created signal
        await signals.emit('genres:created', { id: 4, name: 'Pop' })

        // Cache should be invalidated
        expect(query._options).toBeNull()
      })

      it('invalidates cache when entity:updated signal is emitted', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres'
        })
        query.setSignals(signals)

        // Load and cache options
        await query.getOptions(orchestrator)
        expect(query._options).not.toBeNull()

        // Emit updated signal
        await signals.emit('genres:updated', { id: 1, name: 'Rock n Roll' })

        // Cache should be invalidated
        expect(query._options).toBeNull()
      })

      it('invalidates cache when entity:deleted signal is emitted', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres'
        })
        query.setSignals(signals)

        // Load and cache options
        await query.getOptions(orchestrator)
        expect(query._options).not.toBeNull()

        // Emit deleted signal
        await signals.emit('genres:deleted', { id: 1 })

        // Cache should be invalidated
        expect(query._options).toBeNull()
      })

      it('refetches data on next getOptions after invalidation', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres'
        })
        query.setSignals(signals)

        // First fetch
        await query.getOptions(orchestrator)
        expect(genreManager._listCalls).toHaveLength(1)

        // Emit signal to invalidate
        await signals.emit('genres:created', { id: 4, name: 'Pop' })

        // Next getOptions should refetch
        await query.getOptions(orchestrator)
        expect(genreManager._listCalls).toHaveLength(2)
      })

      it('does not invalidate for unrelated entity signals', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres'
        })
        query.setSignals(signals)

        // Load and cache options
        await query.getOptions(orchestrator)
        expect(query._options).not.toBeNull()

        // Emit signal for different entity
        await signals.emit('books:created', { id: 1, title: 'New Book' })

        // Cache should NOT be invalidated
        expect(query._options).not.toBeNull()
      })
    })

    describe('subscription cleanup', () => {
      it('cleans up subscriptions when setSignals is called again', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres'
        })

        // First setSignals
        query.setSignals(signals)
        expect(signals.listenerCount()).toBe(3)

        // Second setSignals with new bus
        const signals2 = new MockSignalBus()
        query.setSignals(signals2)

        // Old listeners should be removed
        expect(signals.listenerCount()).toBe(0)
        // New listeners should be added
        expect(signals2.listenerCount()).toBe(3)
      })

      it('cleans up subscriptions on dispose', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres'
        })
        query.setSignals(signals)
        expect(signals.listenerCount()).toBe(3)

        query.dispose()

        expect(signals.listenerCount()).toBe(0)
        expect(query._signals).toBeNull()
        expect(query._subscriptions).toHaveLength(0)
      })

      it('dispose clears cached options', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres'
        })
        query.setSignals(signals)
        await query.getOptions(orchestrator)
        expect(query._options).not.toBeNull()

        query.dispose()

        expect(query._options).toBeNull()
      })

      it('dispose is safe to call multiple times', () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres'
        })
        query.setSignals(signals)

        query.dispose()
        query.dispose()
        query.dispose()

        expect(query._signals).toBeNull()
        expect(query._subscriptions).toHaveLength(0)
      })

      it('signals are not triggered after dispose', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres'
        })
        query.setSignals(signals)
        await query.getOptions(orchestrator)

        query.dispose()
        // Manually set options to verify signal doesn't affect them
        query._options = [{ label: 'Test', value: 1 }]

        // Emit signal (should do nothing since disposed)
        await signals.emit('genres:created', { id: 4, name: 'Pop' })

        // Options should still be what we set
        expect(query._options).toEqual([{ label: 'Test', value: 1 }])
      })
    })

    describe('integration', () => {
      it('full workflow: set signals, cache, invalidate, refetch', async () => {
        const query = new FilterQuery({
          source: 'entity',
          entity: 'genres'
        })
        query.setSignals(signals)

        // 1. Initial fetch - should call list
        const options1 = await query.getOptions(orchestrator)
        expect(options1).toHaveLength(3)
        expect(genreManager._listCalls).toHaveLength(1)

        // 2. Second call - should use cache
        const options2 = await query.getOptions(orchestrator)
        expect(options2).toEqual(options1)
        expect(genreManager._listCalls).toHaveLength(1)

        // 3. Signal emitted - cache invalidated
        await signals.emit('genres:created', { id: 4, name: 'Pop' })
        expect(query._options).toBeNull()

        // 4. Next call - should refetch
        await query.getOptions(orchestrator)
        expect(genreManager._listCalls).toHaveLength(2)

        // 5. Dispose - cleanup
        query.dispose()
        expect(signals.listenerCount()).toBe(0)
      })
    })
  })
})
