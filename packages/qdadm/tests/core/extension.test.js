/**
 * extendModule Test Suite
 *
 * Tests for the module extension helper.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { extendModule, ExtensionBuilder } from '../../src/core/index.js'
import { createHookRegistry } from '../../src/hooks/index.js'
import { createZoneRegistry } from '../../src/zones/index.js'

describe('extendModule', () => {
  let hooks
  let zones

  beforeEach(() => {
    hooks = createHookRegistry()
    zones = createZoneRegistry()
  })

  afterEach(() => {
    hooks.dispose()
    zones.clear()
  })

  describe('fluent API', () => {
    it('returns ExtensionBuilder when no extensions provided', () => {
      const builder = extendModule('books')
      expect(builder).toBeInstanceOf(ExtensionBuilder)
    })

    it('throws if target is empty', () => {
      expect(() => extendModule('')).toThrow('Target module name must be a non-empty string')
    })

    it('throws if target is not a string', () => {
      expect(() => extendModule(123)).toThrow('Target module name must be a non-empty string')
    })

    it('addColumn adds column to builder', () => {
      const builder = extendModule('books')
        .addColumn({ field: 'rating', header: 'Rating' })

      const config = builder.toConfig()
      expect(config.columns).toHaveLength(1)
      expect(config.columns[0].field).toBe('rating')
    })

    it('addColumns adds multiple columns', () => {
      const builder = extendModule('books')
        .addColumns([
          { field: 'rating', header: 'Rating' },
          { field: 'reviews', header: 'Reviews' }
        ])

      const config = builder.toConfig()
      expect(config.columns).toHaveLength(2)
    })

    it('addColumn throws if field missing', () => {
      const builder = extendModule('books')
      expect(() => builder.addColumn({ header: 'No field' })).toThrow('Column must have a field property')
    })

    it('addField adds field to builder', () => {
      const builder = extendModule('books')
        .addField({ name: 'rating', type: 'number' })

      const config = builder.toConfig()
      expect(config.fields).toHaveLength(1)
      expect(config.fields[0].name).toBe('rating')
    })

    it('addFields adds multiple fields', () => {
      const builder = extendModule('books')
        .addFields([
          { name: 'rating', type: 'number' },
          { name: 'reviews', type: 'text' }
        ])

      const config = builder.toConfig()
      expect(config.fields).toHaveLength(2)
    })

    it('addField throws if name missing', () => {
      const builder = extendModule('books')
      expect(() => builder.addField({ type: 'text' })).toThrow('Field must have a name property')
    })

    it('addFilter adds filter to builder', () => {
      const builder = extendModule('books')
        .addFilter({ name: 'genre', type: 'select' })

      const config = builder.toConfig()
      expect(config.filters).toHaveLength(1)
      expect(config.filters[0].name).toBe('genre')
    })

    it('addFilters adds multiple filters', () => {
      const builder = extendModule('books')
        .addFilters([
          { name: 'genre', type: 'select' },
          { name: 'year', type: 'number' }
        ])

      const config = builder.toConfig()
      expect(config.filters).toHaveLength(2)
    })

    it('addBlock adds block to builder', () => {
      const DummyComponent = { template: '<div>test</div>' }
      const builder = extendModule('books')
        .addBlock('books:detail:sidebar', { component: DummyComponent, weight: 10 })

      const config = builder.toConfig()
      expect(config.blocks['books:detail:sidebar']).toHaveLength(1)
      expect(config.blocks['books:detail:sidebar'][0].component).toBe(DummyComponent)
    })

    it('addBlocks adds multiple blocks to zone', () => {
      const Comp1 = { template: '<div>1</div>' }
      const Comp2 = { template: '<div>2</div>' }
      const builder = extendModule('books')
        .addBlocks('books:detail:sidebar', [
          { component: Comp1 },
          { component: Comp2 }
        ])

      const config = builder.toConfig()
      expect(config.blocks['books:detail:sidebar']).toHaveLength(2)
    })

    it('addBlock throws if component missing', () => {
      const builder = extendModule('books')
      expect(() => builder.addBlock('zone', { weight: 10 })).toThrow('Block must have a component property')
    })

    it('chaining works correctly', () => {
      const DummyComponent = { template: '<div>test</div>' }
      const builder = extendModule('books')
        .addColumn({ field: 'rating' })
        .addField({ name: 'rating' })
        .addFilter({ name: 'genre' })
        .addBlock('sidebar', { component: DummyComponent })

      expect(builder).toBeInstanceOf(ExtensionBuilder)
      const config = builder.toConfig()
      expect(config.columns).toHaveLength(1)
      expect(config.fields).toHaveLength(1)
      expect(config.filters).toHaveLength(1)
      expect(config.blocks.sidebar).toHaveLength(1)
    })
  })

  describe('register()', () => {
    it('throws if hooks not provided', () => {
      const builder = extendModule('books').addColumn({ field: 'rating' })
      expect(() => builder.register({})).toThrow('requires { hooks } context')
    })

    it('registers column alter hook', async () => {
      const cleanup = extendModule('books')
        .addColumn({ field: 'rating', header: 'Rating' })
        .register({ hooks })

      expect(hooks.hasHook('books:list:alter')).toBe(true)

      const config = await hooks.alter('books:list:alter', { columns: [] })
      expect(config.columns).toHaveLength(1)
      expect(config.columns[0].field).toBe('rating')

      cleanup()
    })

    it('registers field alter hook', async () => {
      const cleanup = extendModule('books')
        .addField({ name: 'rating', type: 'number' })
        .register({ hooks })

      expect(hooks.hasHook('books:form:alter')).toBe(true)

      const config = await hooks.alter('books:form:alter', { fields: [] })
      expect(config.fields).toHaveLength(1)
      expect(config.fields[0].name).toBe('rating')

      cleanup()
    })

    it('registers filter alter hook', async () => {
      const cleanup = extendModule('books')
        .addFilter({ name: 'genre', type: 'select' })
        .register({ hooks })

      expect(hooks.hasHook('books:filter:alter')).toBe(true)

      const config = await hooks.alter('books:filter:alter', { filters: [] })
      expect(config.filters).toHaveLength(1)
      expect(config.filters[0].name).toBe('genre')

      cleanup()
    })

    it('registers zone blocks', () => {
      const DummyComponent = { template: '<div>test</div>' }
      const cleanup = extendModule('books')
        .addBlock('books:sidebar', { component: DummyComponent, weight: 10, id: 'rating-widget' })
        .register({ hooks, zones })

      const blocks = zones.getBlocks('books:sidebar')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].component).toBe(DummyComponent)

      cleanup()
    })

    it('throws if blocks defined but zones not provided', () => {
      const DummyComponent = { template: '<div>test</div>' }
      const builder = extendModule('books')
        .addBlock('sidebar', { component: DummyComponent })

      expect(() => builder.register({ hooks })).toThrow('requires { zones } context when blocks are defined')
    })

    it('cleanup removes hooks', async () => {
      const cleanup = extendModule('books')
        .addColumn({ field: 'rating' })
        .register({ hooks })

      expect(hooks.hasHook('books:list:alter')).toBe(true)

      cleanup()

      expect(hooks.hasHook('books:list:alter')).toBe(false)
    })

    it('cleanup removes zone blocks with IDs', () => {
      const DummyComponent = { template: '<div>test</div>' }
      const cleanup = extendModule('books')
        .addBlock('sidebar', { component: DummyComponent, id: 'test-block' })
        .register({ hooks, zones })

      expect(zones.getBlocks('sidebar')).toHaveLength(1)

      cleanup()

      expect(zones.getBlocks('sidebar')).toHaveLength(0)
    })

    it('accepts custom priority', async () => {
      const callOrder = []

      // Register low priority first
      extendModule('books')
        .addColumn({ field: 'low' })
        .register({ hooks, priority: 25 })

      // Register high priority second
      extendModule('books')
        .addColumn({ field: 'high' })
        .register({ hooks, priority: 75 })

      // Alter hook should process high priority first (higher = first in alter)
      const config = await hooks.alter('books:list:alter', { columns: [] })

      // Higher priority handlers run first, so 'high' column should be added first
      expect(config.columns[0].field).toBe('high')
      expect(config.columns[1].field).toBe('low')
    })

    it('creates arrays if not present in config', async () => {
      extendModule('books')
        .addColumn({ field: 'rating' })
        .addField({ name: 'rating' })
        .addFilter({ name: 'genre' })
        .register({ hooks })

      // Pass empty objects - should create arrays
      const listConfig = await hooks.alter('books:list:alter', {})
      expect(listConfig.columns).toHaveLength(1)

      const formConfig = await hooks.alter('books:form:alter', {})
      expect(formConfig.fields).toHaveLength(1)

      const filterConfig = await hooks.alter('books:filter:alter', {})
      expect(filterConfig.filters).toHaveLength(1)
    })
  })

  describe('config object approach', () => {
    it('registers and returns cleanup function', async () => {
      const cleanup = extendModule('books', {
        columns: [{ field: 'rating' }]
      }, { hooks })

      expect(typeof cleanup).toBe('function')
      expect(hooks.hasHook('books:list:alter')).toBe(true)

      cleanup()
      expect(hooks.hasHook('books:list:alter')).toBe(false)
    })

    it('throws if context not provided with extensions', () => {
      expect(() => extendModule('books', { columns: [{ field: 'rating' }] }))
        .toThrow('Context { hooks } is required when extensions are provided')
    })

    it('registers all extension types', async () => {
      const DummyComponent = { template: '<div>test</div>' }

      const cleanup = extendModule('books', {
        columns: [{ field: 'rating' }],
        fields: [{ name: 'rating' }],
        filters: [{ name: 'genre' }],
        blocks: {
          'sidebar': [{ component: DummyComponent, id: 'widget' }]
        }
      }, { hooks, zones })

      expect(hooks.hasHook('books:list:alter')).toBe(true)
      expect(hooks.hasHook('books:form:alter')).toBe(true)
      expect(hooks.hasHook('books:filter:alter')).toBe(true)
      expect(zones.getBlocks('sidebar')).toHaveLength(1)

      cleanup()
    })

    it('handles empty extensions gracefully', async () => {
      const cleanup = extendModule('books', {}, { hooks })

      expect(typeof cleanup).toBe('function')
      expect(hooks.getHandlerCount()).toBe(0)

      cleanup()
    })
  })

  describe('toConfig()', () => {
    it('returns target in config', () => {
      const config = extendModule('books').toConfig()
      expect(config.target).toBe('books')
    })

    it('only includes non-empty arrays', () => {
      const config = extendModule('books')
        .addColumn({ field: 'rating' })
        .toConfig()

      expect(config.columns).toBeDefined()
      expect(config.fields).toBeUndefined()
      expect(config.filters).toBeUndefined()
      expect(config.blocks).toBeUndefined()
    })

    it('includes all configured extensions', () => {
      const DummyComponent = { template: '<div>test</div>' }
      const config = extendModule('books')
        .addColumn({ field: 'rating' })
        .addField({ name: 'rating' })
        .addFilter({ name: 'genre' })
        .addBlock('sidebar', { component: DummyComponent })
        .toConfig()

      expect(config.target).toBe('books')
      expect(config.columns).toHaveLength(1)
      expect(config.fields).toHaveLength(1)
      expect(config.filters).toHaveLength(1)
      expect(config.blocks.sidebar).toHaveLength(1)
    })
  })

  describe('multiple modules extending same target', () => {
    it('all extensions are applied', async () => {
      extendModule('books')
        .addColumn({ field: 'rating' })
        .register({ hooks })

      extendModule('books')
        .addColumn({ field: 'reviews' })
        .register({ hooks })

      const config = await hooks.alter('books:list:alter', { columns: [] })
      expect(config.columns).toHaveLength(2)
    })

    it('cleanups are independent', async () => {
      const cleanup1 = extendModule('books')
        .addColumn({ field: 'rating' })
        .register({ hooks })

      const cleanup2 = extendModule('books')
        .addColumn({ field: 'reviews' })
        .register({ hooks })

      cleanup1()

      // Should still have one handler
      expect(hooks.getHandlerCount('books:list:alter')).toBe(1)

      const config = await hooks.alter('books:list:alter', { columns: [] })
      expect(config.columns).toHaveLength(1)
      expect(config.columns[0].field).toBe('reviews')

      cleanup2()
      expect(hooks.hasHook('books:list:alter')).toBe(false)
    })
  })
})
