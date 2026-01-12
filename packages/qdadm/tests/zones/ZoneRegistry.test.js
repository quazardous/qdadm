/**
 * Unit tests for ZoneRegistry
 *
 * Tests cover:
 * - Zone definition and listing
 * - Block registration with weight ordering
 * - Replace operation for blocks
 * - Extend operation for blocks (before/after positioning)
 * - Edge cases and error handling
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ZoneRegistry, createZoneRegistry } from '../../src/zones/ZoneRegistry'

// Mock components for testing
const MockComponentA = { name: 'ComponentA' }
const MockComponentB = { name: 'ComponentB' }
const MockComponentC = { name: 'ComponentC' }
const MockDefaultHeader = { name: 'DefaultHeader' }

describe('ZoneRegistry', () => {
  let registry

  beforeEach(() => {
    registry = new ZoneRegistry()
  })

  describe('defineZone', () => {
    it('creates a new zone', () => {
      registry.defineZone('header')
      expect(registry.hasZone('header')).toBe(true)
      expect(registry.listZones().map(z => z.name)).toContain('header')
    })

    it('creates zone with default component', () => {
      registry.defineZone('header', { default: MockDefaultHeader })
      expect(registry.getDefault('header')).toBe(MockDefaultHeader)
    })

    it('merges options when zone already exists', () => {
      registry.defineZone('header')
      registry.registerBlock('header', { component: MockComponentA, id: 'a' })
      registry.defineZone('header', { default: MockDefaultHeader })

      // Default should be updated
      expect(registry.getDefault('header')).toBe(MockDefaultHeader)
      // Blocks should still exist
      expect(registry.getBlocks('header')).toHaveLength(1)
    })

    it('throws on invalid zone name', () => {
      expect(() => registry.defineZone('')).toThrow()
      expect(() => registry.defineZone(null)).toThrow()
    })

    it('supports method chaining', () => {
      const result = registry.defineZone('header').defineZone('sidebar')
      expect(result).toBe(registry)
      expect(registry.listZones()).toHaveLength(2)
    })
  })

  describe('registerBlock', () => {
    it('adds block to zone', () => {
      registry.registerBlock('header', { component: MockComponentA })
      expect(registry.getBlocks('header')).toHaveLength(1)
    })

    it('auto-creates zone if not defined', () => {
      registry.registerBlock('header', { component: MockComponentA })
      expect(registry.hasZone('header')).toBe(true)
    })

    it('uses default weight of 50', () => {
      registry.registerBlock('header', { component: MockComponentA })
      const blocks = registry.getBlocks('header')
      expect(blocks[0].weight).toBe(50)
    })

    it('respects explicit weight', () => {
      registry.registerBlock('header', { component: MockComponentA, weight: 10 })
      const blocks = registry.getBlocks('header')
      expect(blocks[0].weight).toBe(10)
    })

    it('stores props', () => {
      registry.registerBlock('header', {
        component: MockComponentA,
        props: { title: 'Test' }
      })
      const blocks = registry.getBlocks('header')
      expect(blocks[0].props).toEqual({ title: 'Test' })
    })

    it('stores id', () => {
      registry.registerBlock('header', {
        component: MockComponentA,
        id: 'my-block'
      })
      const blocks = registry.getBlocks('header')
      expect(blocks[0].id).toBe('my-block')
    })

    it('replaces block with same id (add operation)', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'logo' })
      registry.registerBlock('header', { component: MockComponentB, id: 'logo' })

      const blocks = registry.getBlocks('header')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].component).toBe(MockComponentB)
    })

    it('throws on missing component', () => {
      expect(() => registry.registerBlock('header', {})).toThrow()
    })

    it('throws on invalid zone name', () => {
      expect(() => registry.registerBlock('', { component: MockComponentA })).toThrow()
      expect(() => registry.registerBlock(null, { component: MockComponentA })).toThrow()
    })

    it('supports method chaining', () => {
      const result = registry
        .registerBlock('header', { component: MockComponentA })
        .registerBlock('header', { component: MockComponentB })
      expect(result).toBe(registry)
      expect(registry.getBlocks('header')).toHaveLength(2)
    })
  })

  describe('getBlocks - weight ordering', () => {
    it('sorts blocks by weight ascending', () => {
      registry.registerBlock('header', { component: MockComponentA, weight: 30, id: 'a' })
      registry.registerBlock('header', { component: MockComponentB, weight: 10, id: 'b' })
      registry.registerBlock('header', { component: MockComponentC, weight: 20, id: 'c' })

      const blocks = registry.getBlocks('header')
      expect(blocks.map(b => b.id)).toEqual(['b', 'c', 'a'])
    })

    it('preserves insertion order for equal weights', () => {
      registry.registerBlock('header', { component: MockComponentA, weight: 50, id: 'a' })
      registry.registerBlock('header', { component: MockComponentB, weight: 50, id: 'b' })
      registry.registerBlock('header', { component: MockComponentC, weight: 50, id: 'c' })

      const blocks = registry.getBlocks('header')
      expect(blocks.map(b => b.id)).toEqual(['a', 'b', 'c'])
    })

    it('returns empty array for undefined zone', () => {
      expect(registry.getBlocks('undefined-zone')).toEqual([])
    })

    it('supports negative weights (render before weight=0)', () => {
      registry.registerBlock('header', { component: MockComponentA, weight: 0, id: 'zero' })
      registry.registerBlock('header', { component: MockComponentB, weight: -10, id: 'negative' })
      registry.registerBlock('header', { component: MockComponentC, weight: 10, id: 'positive' })

      const blocks = registry.getBlocks('header')
      expect(blocks.map(b => b.id)).toEqual(['negative', 'zero', 'positive'])
    })

    it('caches sorted results', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'a' })

      const blocks1 = registry.getBlocks('header')
      const blocks2 = registry.getBlocks('header')

      expect(blocks1).toBe(blocks2) // Same reference (cached)
    })
  })

  describe('replace operation', () => {
    it('replaces target block entirely', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'logo', weight: 10 })
      registry.registerBlock('header', { component: MockComponentB, id: 'nav', weight: 50 })
      registry.registerBlock('header', {
        component: MockComponentC,
        operation: 'replace',
        replaces: 'logo'
      })

      const blocks = registry.getBlocks('header')
      expect(blocks).toHaveLength(2)
      expect(blocks.find(b => b.id === 'logo')).toBeUndefined()
      expect(blocks.find(b => b.component === MockComponentC)).toBeDefined()
    })

    it('inherits target weight when replacement has default weight', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'logo', weight: 10 })
      registry.registerBlock('header', {
        component: MockComponentC,
        operation: 'replace',
        replaces: 'logo'
      })

      const blocks = registry.getBlocks('header')
      expect(blocks[0].weight).toBe(10)
      expect(blocks[0].component).toBe(MockComponentC)
    })

    it('uses explicit weight when provided', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'logo', weight: 10 })
      registry.registerBlock('header', {
        component: MockComponentC,
        operation: 'replace',
        replaces: 'logo',
        weight: 90
      })

      const blocks = registry.getBlocks('header')
      expect(blocks[0].weight).toBe(90)
    })

    it('maintains position in sorted order after replace', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'first', weight: 10 })
      registry.registerBlock('header', { component: MockComponentB, id: 'second', weight: 50 })
      registry.registerBlock('header', { component: MockComponentC, id: 'third', weight: 90 })

      registry.registerBlock('header', {
        component: { name: 'NewSecond' },
        operation: 'replace',
        replaces: 'second'
      })

      const blocks = registry.getBlocks('header')
      expect(blocks[1].weight).toBe(50)
      expect(blocks[1].component.name).toBe('NewSecond')
    })

    it('adds replacement at default weight when target not found', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'logo', weight: 10 })
      registry.registerBlock('header', {
        component: MockComponentC,
        id: 'replacement',
        operation: 'replace',
        replaces: 'non-existent'
      })

      const blocks = registry.getBlocks('header')
      expect(blocks).toHaveLength(2)
      expect(blocks.find(b => b.id === 'replacement')).toBeDefined()
    })

    it('logs warning when target not found in debug mode', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      registry.setDebug(true)

      registry.registerBlock('header', {
        component: MockComponentC,
        operation: 'replace',
        replaces: 'non-existent'
      })

      registry.getBlocks('header')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('non-existent')
      )

      consoleSpy.mockRestore()
    })

    it('throws when replace operation has no replaces target', () => {
      expect(() =>
        registry.registerBlock('header', {
          component: MockComponentA,
          operation: 'replace'
        })
      ).toThrow("must specify 'replaces'")
    })

    it('handles multiple replace operations', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'a', weight: 10 })
      registry.registerBlock('header', { component: MockComponentB, id: 'b', weight: 50 })

      registry.registerBlock('header', {
        component: { name: 'NewA' },
        operation: 'replace',
        replaces: 'a'
      })
      registry.registerBlock('header', {
        component: { name: 'NewB' },
        operation: 'replace',
        replaces: 'b'
      })

      const blocks = registry.getBlocks('header')
      expect(blocks).toHaveLength(2)
      expect(blocks[0].component.name).toBe('NewA')
      expect(blocks[1].component.name).toBe('NewB')
    })

    it('cleans operation fields from returned blocks', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'logo', weight: 10 })
      registry.registerBlock('header', {
        component: MockComponentC,
        operation: 'replace',
        replaces: 'logo'
      })

      const blocks = registry.getBlocks('header')
      expect(blocks[0]).not.toHaveProperty('operation')
      expect(blocks[0]).not.toHaveProperty('replaces')
    })
  })

  describe('extend operation', () => {
    it('inserts block after target', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'logo', weight: 10 })
      registry.registerBlock('header', { component: MockComponentB, id: 'nav', weight: 50 })
      registry.registerBlock('header', {
        component: MockComponentC,
        id: 'extra',
        operation: 'extend',
        after: 'logo'
      })

      const blocks = registry.getBlocks('header')
      expect(blocks).toHaveLength(3)
      expect(blocks.map(b => b.id)).toEqual(['logo', 'extra', 'nav'])
    })

    it('inserts block before target', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'logo', weight: 10 })
      registry.registerBlock('header', { component: MockComponentB, id: 'nav', weight: 50 })
      registry.registerBlock('header', {
        component: MockComponentC,
        id: 'announcement',
        operation: 'extend',
        before: 'logo'
      })

      const blocks = registry.getBlocks('header')
      expect(blocks).toHaveLength(3)
      expect(blocks.map(b => b.id)).toEqual(['announcement', 'logo', 'nav'])
    })

    it('allows multiple extends on same target (registration order)', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'nav', weight: 50 })
      registry.registerBlock('header', {
        component: { name: 'Extra1' },
        id: 'extra1',
        operation: 'extend',
        after: 'nav'
      })
      registry.registerBlock('header', {
        component: { name: 'Extra2' },
        id: 'extra2',
        operation: 'extend',
        after: 'nav'
      })

      const blocks = registry.getBlocks('header')
      expect(blocks).toHaveLength(3)
      // extra1 inserted first after nav, then extra2 inserted after nav
      // Result: nav, extra2, extra1 (last extend inserted right after target)
      expect(blocks.map(b => b.id)).toEqual(['nav', 'extra2', 'extra1'])
    })

    it('allows before and after on same target', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'main', weight: 50 })
      registry.registerBlock('header', {
        component: { name: 'Before' },
        id: 'before-main',
        operation: 'extend',
        before: 'main'
      })
      registry.registerBlock('header', {
        component: { name: 'After' },
        id: 'after-main',
        operation: 'extend',
        after: 'main'
      })

      const blocks = registry.getBlocks('header')
      expect(blocks.map(b => b.id)).toEqual(['before-main', 'main', 'after-main'])
    })

    it('falls back to weight-based positioning when target not found', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'first', weight: 10 })
      registry.registerBlock('header', { component: MockComponentB, id: 'last', weight: 90 })
      registry.registerBlock('header', {
        component: MockComponentC,
        id: 'orphan',
        operation: 'extend',
        after: 'non-existent',
        weight: 50
      })

      const blocks = registry.getBlocks('header')
      expect(blocks).toHaveLength(3)
      expect(blocks.map(b => b.id)).toEqual(['first', 'orphan', 'last'])
    })

    it('logs warning when target not found in debug mode', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      registry.setDebug(true)

      registry.registerBlock('header', {
        component: MockComponentC,
        operation: 'extend',
        after: 'non-existent'
      })

      registry.getBlocks('header')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('non-existent')
      )

      consoleSpy.mockRestore()
    })

    it('throws when extend has no before or after', () => {
      expect(() =>
        registry.registerBlock('header', {
          component: MockComponentA,
          operation: 'extend'
        })
      ).toThrow("must specify either 'before' or 'after'")
    })

    it('throws when extend has both before and after', () => {
      expect(() =>
        registry.registerBlock('header', {
          component: MockComponentA,
          operation: 'extend',
          before: 'a',
          after: 'b'
        })
      ).toThrow("cannot specify both 'before' and 'after'")
    })

    it('works with replace and extend operations together', () => {
      // Original blocks
      registry.registerBlock('header', { component: MockComponentA, id: 'logo', weight: 10 })
      registry.registerBlock('header', { component: MockComponentB, id: 'nav', weight: 50 })

      // Replace logo
      registry.registerBlock('header', {
        component: { name: 'NewLogo' },
        id: 'new-logo',
        operation: 'replace',
        replaces: 'logo'
      })

      // Extend after new logo (targeting new-logo won't work since it takes original's ID)
      // Extend after nav
      registry.registerBlock('header', {
        component: { name: 'Extra' },
        id: 'extra',
        operation: 'extend',
        after: 'nav'
      })

      const blocks = registry.getBlocks('header')
      expect(blocks).toHaveLength(3)
      expect(blocks[0].component.name).toBe('NewLogo')
      expect(blocks[1].id).toBe('nav')
      expect(blocks[2].id).toBe('extra')
    })

    it('cleans extend fields from returned blocks', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'target', weight: 50 })
      registry.registerBlock('header', {
        component: MockComponentC,
        id: 'extend-block',
        operation: 'extend',
        after: 'target'
      })

      const blocks = registry.getBlocks('header')
      const extendBlock = blocks.find(b => b.id === 'extend-block')
      expect(extendBlock).not.toHaveProperty('operation')
      expect(extendBlock).not.toHaveProperty('before')
      expect(extendBlock).not.toHaveProperty('after')
    })

    it('preserves props on extended blocks', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'target', weight: 50 })
      registry.registerBlock('header', {
        component: MockComponentC,
        id: 'extra',
        operation: 'extend',
        after: 'target',
        props: { title: 'Extended Block' }
      })

      const blocks = registry.getBlocks('header')
      const extendBlock = blocks.find(b => b.id === 'extra')
      expect(extendBlock.props).toEqual({ title: 'Extended Block' })
    })
  })

  describe('wrap operation', () => {
    const MockWrapper = { name: 'Wrapper' }
    const MockOuterWrapper = { name: 'OuterWrapper' }

    it('wraps a target block with a single wrapper', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'main', weight: 50 })
      registry.registerBlock('header', {
        component: MockWrapper,
        id: 'wrapper',
        operation: 'wrap',
        wraps: 'main'
      })

      const blocks = registry.getBlocks('header')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].id).toBe('main')
      expect(blocks[0].component).toBe(MockComponentA)
      expect(blocks[0].wrappers).toHaveLength(1)
      expect(blocks[0].wrappers[0].component).toBe(MockWrapper)
    })

    it('handles nested wraps (wrapper wrapping another wrapper)', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'main', weight: 50 })
      // Inner wrapper wraps main
      registry.registerBlock('header', {
        component: MockWrapper,
        id: 'inner-wrapper',
        operation: 'wrap',
        wraps: 'main',
        weight: 20
      })
      // Outer wrapper wraps the inner wrapper
      registry.registerBlock('header', {
        component: MockOuterWrapper,
        id: 'outer-wrapper',
        operation: 'wrap',
        wraps: 'inner-wrapper',
        weight: 10
      })

      const blocks = registry.getBlocks('header')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].id).toBe('main')
      // Both wrappers should be in the chain, sorted by weight (lower = outer)
      expect(blocks[0].wrappers).toHaveLength(2)
      expect(blocks[0].wrappers[0].id).toBe('outer-wrapper')
      expect(blocks[0].wrappers[1].id).toBe('inner-wrapper')
    })

    it('orders multiple wrappers by weight (lower weight = outer wrapper)', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'content', weight: 50 })
      registry.registerBlock('header', {
        component: { name: 'HighWeight' },
        id: 'wrapper-high',
        operation: 'wrap',
        wraps: 'content',
        weight: 90
      })
      registry.registerBlock('header', {
        component: { name: 'LowWeight' },
        id: 'wrapper-low',
        operation: 'wrap',
        wraps: 'content',
        weight: 10
      })

      const blocks = registry.getBlocks('header')
      expect(blocks[0].wrappers).toHaveLength(2)
      // Lower weight first (outer wrapper)
      expect(blocks[0].wrappers[0].id).toBe('wrapper-low')
      expect(blocks[0].wrappers[1].id).toBe('wrapper-high')
    })

    it('preserves wrapper props', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'main', weight: 50 })
      registry.registerBlock('header', {
        component: MockWrapper,
        id: 'wrapper',
        operation: 'wrap',
        wraps: 'main',
        props: { border: true, color: 'blue' }
      })

      const blocks = registry.getBlocks('header')
      expect(blocks[0].wrappers[0].props).toEqual({ border: true, color: 'blue' })
    })

    it('throws when wrap operation has no wraps target', () => {
      expect(() =>
        registry.registerBlock('header', {
          component: MockWrapper,
          id: 'wrapper',
          operation: 'wrap'
        })
      ).toThrow("must specify 'wraps'")
    })

    it('throws when wrap operation has no id', () => {
      expect(() =>
        registry.registerBlock('header', {
          component: MockWrapper,
          operation: 'wrap',
          wraps: 'main'
        })
      ).toThrow("must have an 'id'")
    })

    it('throws on self-wrap (circular dependency)', () => {
      expect(() =>
        registry.registerBlock('header', {
          component: MockWrapper,
          id: 'self',
          operation: 'wrap',
          wraps: 'self'
        })
      ).toThrow('Circular wrap dependency')
    })

    it('throws on direct circular wrap (A wraps B, B wraps A)', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'block-a', weight: 50 })
      registry.registerBlock('header', {
        component: MockWrapper,
        id: 'wrapper-a',
        operation: 'wrap',
        wraps: 'block-a'
      })

      expect(() =>
        registry.registerBlock('header', {
          component: MockWrapper,
          id: 'block-a',
          operation: 'wrap',
          wraps: 'wrapper-a'
        })
      ).toThrow('Circular wrap dependency')
    })

    it('throws on indirect circular wrap (A wraps B, B wraps C, C wraps A)', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'original', weight: 50 })
      registry.registerBlock('header', {
        component: { name: 'WrapperA' },
        id: 'wrapper-a',
        operation: 'wrap',
        wraps: 'original'
      })
      registry.registerBlock('header', {
        component: { name: 'WrapperB' },
        id: 'wrapper-b',
        operation: 'wrap',
        wraps: 'wrapper-a'
      })

      expect(() =>
        registry.registerBlock('header', {
          component: { name: 'WrapperC' },
          id: 'original',
          operation: 'wrap',
          wraps: 'wrapper-b'
        })
      ).toThrow('Circular wrap dependency')
    })

    it('ignores wrapper when target not found (no wrappers added)', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'existing', weight: 50 })
      registry.registerBlock('header', {
        component: MockWrapper,
        id: 'orphan-wrapper',
        operation: 'wrap',
        wraps: 'non-existent'
      })

      const blocks = registry.getBlocks('header')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].id).toBe('existing')
      expect(blocks[0].wrappers).toBeUndefined()
    })

    it('logs warning when target not found in debug mode', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      registry.setDebug(true)

      registry.registerBlock('header', { component: MockComponentA, id: 'existing', weight: 50 })
      registry.registerBlock('header', {
        component: MockWrapper,
        id: 'orphan-wrapper',
        operation: 'wrap',
        wraps: 'non-existent'
      })

      registry.getBlocks('header')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('non-existent')
      )

      consoleSpy.mockRestore()
    })

    it('cleans wrap fields from returned blocks', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'main', weight: 50 })
      registry.registerBlock('header', {
        component: MockWrapper,
        id: 'wrapper',
        operation: 'wrap',
        wraps: 'main'
      })

      const blocks = registry.getBlocks('header')
      expect(blocks[0]).not.toHaveProperty('operation')
      expect(blocks[0]).not.toHaveProperty('wraps')
    })

    it('works with replace and wrap operations together', () => {
      // Original block
      registry.registerBlock('header', { component: MockComponentA, id: 'logo', weight: 10 })

      // Replace logo
      registry.registerBlock('header', {
        component: { name: 'NewLogo' },
        id: 'new-logo',
        operation: 'replace',
        replaces: 'logo'
      })

      // Note: replace operation does NOT transfer the ID, so we cannot wrap the replaced block
      // Instead, wrap a different block
      registry.registerBlock('header', { component: MockComponentB, id: 'nav', weight: 50 })
      registry.registerBlock('header', {
        component: MockWrapper,
        id: 'nav-wrapper',
        operation: 'wrap',
        wraps: 'nav'
      })

      const blocks = registry.getBlocks('header')
      expect(blocks).toHaveLength(2)
      const navBlock = blocks.find(b => b.id === 'nav')
      expect(navBlock.wrappers).toHaveLength(1)
    })

    it('works with extend and wrap operations together', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'main', weight: 50 })
      registry.registerBlock('header', {
        component: MockComponentB,
        id: 'extra',
        operation: 'extend',
        after: 'main'
      })
      registry.registerBlock('header', {
        component: MockWrapper,
        id: 'main-wrapper',
        operation: 'wrap',
        wraps: 'main'
      })

      const blocks = registry.getBlocks('header')
      expect(blocks).toHaveLength(2)
      expect(blocks[0].id).toBe('main')
      expect(blocks[0].wrappers).toHaveLength(1)
      expect(blocks[1].id).toBe('extra')
      expect(blocks[1].wrappers).toBeUndefined()
    })

    it('removeBlock clears wrap from wrap graph', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'main', weight: 50 })
      registry.registerBlock('header', {
        component: MockWrapper,
        id: 'wrapper',
        operation: 'wrap',
        wraps: 'main'
      })

      registry.removeBlock('header', 'wrapper')

      // Should now be able to register a wrap that would have created a cycle
      expect(() =>
        registry.registerBlock('header', {
          component: MockWrapper,
          id: 'main',
          operation: 'wrap',
          wraps: 'wrapper'
        })
      ).not.toThrow()
    })

    it('clearZone clears wrap graph for zone', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'main', weight: 50 })
      registry.registerBlock('header', {
        component: MockWrapper,
        id: 'wrapper',
        operation: 'wrap',
        wraps: 'main'
      })

      registry.clearZone('header')

      // Re-register should work without cycle issues
      registry.registerBlock('header', { component: MockComponentA, id: 'main', weight: 50 })
      expect(() =>
        registry.registerBlock('header', {
          component: MockWrapper,
          id: 'wrapper',
          operation: 'wrap',
          wraps: 'main'
        })
      ).not.toThrow()
    })

    it('clear() clears all wrap graphs', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'main', weight: 50 })
      registry.registerBlock('header', {
        component: MockWrapper,
        id: 'wrapper',
        operation: 'wrap',
        wraps: 'main'
      })

      registry.clear()

      // Re-register should work without cycle issues
      registry.registerBlock('header', { component: MockComponentA, id: 'main', weight: 50 })
      expect(() =>
        registry.registerBlock('header', {
          component: MockWrapper,
          id: 'wrapper',
          operation: 'wrap',
          wraps: 'main'
        })
      ).not.toThrow()
    })
  })

  describe('utility methods', () => {
    it('getDefault returns null for undefined zone', () => {
      expect(registry.getDefault('undefined-zone')).toBeNull()
    })

    it('getDefault returns null when zone has no default', () => {
      registry.defineZone('header')
      expect(registry.getDefault('header')).toBeNull()
    })

    it('hasBlocks returns correct state', () => {
      expect(registry.hasBlocks('header')).toBe(false)
      registry.registerBlock('header', { component: MockComponentA })
      expect(registry.hasBlocks('header')).toBe(true)
    })

    it('hasZone returns correct state', () => {
      expect(registry.hasZone('header')).toBe(false)
      registry.defineZone('header')
      expect(registry.hasZone('header')).toBe(true)
    })

    it('listZones returns all zones with metadata', () => {
      registry.defineZone('header')
      registry.defineZone('sidebar')
      registry.defineZone('footer')
      registry.registerBlock('header', { component: MockComponentA })
      registry.registerBlock('header', { component: MockComponentB })

      const zones = registry.listZones()
      expect(zones).toHaveLength(3)

      const zoneNames = zones.map(z => z.name)
      expect(zoneNames).toContain('header')
      expect(zoneNames).toContain('sidebar')
      expect(zoneNames).toContain('footer')

      const headerZone = zones.find(z => z.name === 'header')
      expect(headerZone.blockCount).toBe(2)

      const sidebarZone = zones.find(z => z.name === 'sidebar')
      expect(sidebarZone.blockCount).toBe(0)
    })

    it('getZoneInfo returns zone details', () => {
      registry.defineZone('header', { default: MockDefaultHeader })
      registry.registerBlock('header', { component: MockComponentA, id: 'a', weight: 10 })

      const info = registry.getZoneInfo('header')
      expect(info).toEqual({
        name: 'header',
        hasDefault: true,
        blockCount: 1,
        blocks: [{ id: 'a', weight: 10, hasProps: false }]
      })
    })

    it('getZoneInfo returns null for undefined zone', () => {
      expect(registry.getZoneInfo('undefined')).toBeNull()
    })

    it('clearZone removes all blocks', () => {
      registry.registerBlock('header', { component: MockComponentA })
      registry.registerBlock('header', { component: MockComponentB })
      registry.clearZone('header')

      expect(registry.getBlocks('header')).toHaveLength(0)
      expect(registry.hasZone('header')).toBe(true)
    })

    it('removeBlock removes specific block', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'a' })
      registry.registerBlock('header', { component: MockComponentB, id: 'b' })

      const removed = registry.removeBlock('header', 'a')

      expect(removed).toBe(true)
      expect(registry.getBlocks('header')).toHaveLength(1)
      expect(registry.getBlocks('header')[0].id).toBe('b')
    })

    it('removeBlock returns false for non-existent block', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'a' })
      expect(registry.removeBlock('header', 'non-existent')).toBe(false)
    })

    it('clear removes all zones', () => {
      registry.defineZone('header')
      registry.defineZone('sidebar')
      registry.clear()

      expect(registry.listZones()).toHaveLength(0)
    })
  })

  describe('inspect method', () => {
    it('returns null for undefined zone', () => {
      expect(registry.inspect('undefined')).toBeNull()
    })

    it('returns zone details with blocks', () => {
      registry.defineZone('header', { default: MockDefaultHeader })
      registry.registerBlock('header', { component: MockComponentA, id: 'logo', weight: 10 })
      registry.registerBlock('header', { component: MockComponentB, id: 'nav', weight: 50 })

      const inspection = registry.inspect('header')

      expect(inspection.name).toBe('header')
      expect(inspection.default).toBe('DefaultHeader')
      expect(inspection.blocks).toHaveLength(2)
      expect(inspection.blocks[0]).toEqual({
        id: 'logo',
        weight: 10,
        component: 'ComponentA'
      })
      expect(inspection.blocks[1]).toEqual({
        id: 'nav',
        weight: 50,
        component: 'ComponentB'
      })
    })

    it('includes wrapper info for wrapped blocks', () => {
      const MockWrapper = { name: 'Wrapper' }
      registry.registerBlock('header', { component: MockComponentA, id: 'main', weight: 50 })
      registry.registerBlock('header', {
        component: MockWrapper,
        id: 'wrapper',
        operation: 'wrap',
        wraps: 'main'
      })

      const inspection = registry.inspect('header')

      expect(inspection.blocks[0].wrappers).toHaveLength(1)
      expect(inspection.blocks[0].wrappers[0]).toEqual({
        id: 'wrapper',
        component: 'Wrapper'
      })
    })

    it('handles anonymous components', () => {
      registry.registerBlock('header', { component: {}, id: 'anon' })

      const inspection = registry.inspect('header')
      expect(inspection.blocks[0].component).toBe('(anonymous)')
    })

    it('returns sorted blocks', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'a', weight: 90 })
      registry.registerBlock('header', { component: MockComponentB, id: 'b', weight: 10 })

      const inspection = registry.inspect('header')
      expect(inspection.blocks[0].id).toBe('b')
      expect(inspection.blocks[1].id).toBe('a')
    })
  })

  describe('debug mode', () => {
    it('setDebug enables warnings', () => {
      registry.setDebug(true)
      expect(registry._debug).toBe(true)
    })

    it('setDebug supports chaining', () => {
      const result = registry.setDebug(true)
      expect(result).toBe(registry)
    })

    it('logs block registration in debug mode', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      registry.setDebug(true)

      registry.registerBlock('header', { component: MockComponentA, id: 'logo' })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[qdadm:zones] Registered block')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('header')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('logo')
      )

      consoleSpy.mockRestore()
    })

    it('logs anonymous blocks correctly', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      registry.setDebug(true)

      registry.registerBlock('header', { component: MockComponentA })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('(anonymous)')
      )

      consoleSpy.mockRestore()
    })

    it('logs operation type for non-add operations', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      registry.setDebug(true)

      registry.registerBlock('header', { component: MockComponentA, id: 'main' })
      registry.registerBlock('header', {
        component: MockComponentB,
        operation: 'replace',
        replaces: 'main'
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[replace]')
      )

      consoleSpy.mockRestore()
    })

    it('does not log when debug is disabled', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

      registry.registerBlock('header', { component: MockComponentA })

      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('createZoneRegistry factory', () => {
    it('creates new registry instance', () => {
      const r = createZoneRegistry()
      expect(r).toBeInstanceOf(ZoneRegistry)
    })

    it('accepts debug option', () => {
      const r = createZoneRegistry({ debug: true })
      expect(r._debug).toBe(true)
    })
  })

  describe('dynamic block injection (T195)', () => {
    describe('unregisterBlock method', () => {
      it('is an alias for removeBlock', () => {
        registry.registerBlock('header', { component: MockComponentA, id: 'a' })

        const removed = registry.unregisterBlock('header', 'a')

        expect(removed).toBe(true)
        expect(registry.getBlocks('header')).toHaveLength(0)
      })

      it('returns false when block not found', () => {
        registry.registerBlock('header', { component: MockComponentA, id: 'a' })

        expect(registry.unregisterBlock('header', 'non-existent')).toBe(false)
      })

      it('returns false when zone not found', () => {
        expect(registry.unregisterBlock('non-existent', 'a')).toBe(false)
      })

      it('logs warning in debug mode when block not found', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        registry.setDebug(true)

        registry.registerBlock('header', { component: MockComponentA, id: 'a' })
        registry.unregisterBlock('header', 'non-existent')

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('not found')
        )

        consoleSpy.mockRestore()
      })

      it('logs debug message when block is unregistered', () => {
        const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
        registry.setDebug(true)

        registry.registerBlock('header', { component: MockComponentA, id: 'my-block' })
        registry.unregisterBlock('header', 'my-block')

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unregistered block')
        )
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('my-block')
        )

        consoleSpy.mockRestore()
      })
    })

    describe('Vue reactivity integration', () => {
      it('has a version ref for reactivity tracking', () => {
        const versionRef = registry.getVersionRef()
        expect(versionRef).toBeDefined()
        expect(versionRef.value).toBe(0)
      })

      it('increments version when block is registered', () => {
        const versionRef = registry.getVersionRef()
        const initialVersion = versionRef.value

        registry.registerBlock('header', { component: MockComponentA, id: 'a' })

        expect(versionRef.value).toBe(initialVersion + 1)
      })

      it('increments version when block is unregistered', () => {
        registry.registerBlock('header', { component: MockComponentA, id: 'a' })
        const versionRef = registry.getVersionRef()
        const initialVersion = versionRef.value

        registry.unregisterBlock('header', 'a')

        expect(versionRef.value).toBe(initialVersion + 1)
      })

      it('increments version when zone is cleared', () => {
        registry.registerBlock('header', { component: MockComponentA, id: 'a' })
        const versionRef = registry.getVersionRef()
        const initialVersion = versionRef.value

        registry.clearZone('header')

        expect(versionRef.value).toBe(initialVersion + 1)
      })

      it('does not increment version when clearing empty zone', () => {
        registry.defineZone('empty')
        const versionRef = registry.getVersionRef()
        const initialVersion = versionRef.value

        registry.clearZone('empty')

        expect(versionRef.value).toBe(initialVersion)
      })

      it('increments version when clear() is called with zones', () => {
        registry.registerBlock('header', { component: MockComponentA, id: 'a' })
        const versionRef = registry.getVersionRef()
        const initialVersion = versionRef.value

        registry.clear()

        expect(versionRef.value).toBe(initialVersion + 1)
      })

      it('does not increment version when clear() called on empty registry', () => {
        const versionRef = registry.getVersionRef()
        const initialVersion = versionRef.value

        registry.clear()

        expect(versionRef.value).toBe(initialVersion)
      })

      it('does not increment version when unregister fails', () => {
        registry.registerBlock('header', { component: MockComponentA, id: 'a' })
        const versionRef = registry.getVersionRef()
        const initialVersion = versionRef.value

        registry.unregisterBlock('header', 'non-existent')

        expect(versionRef.value).toBe(initialVersion)
      })
    })

    describe('dynamic add/remove scenarios', () => {
      it('supports adding and removing blocks in sequence', () => {
        registry.registerBlock('sidebar', { component: MockComponentA, id: 'widget-1' })
        registry.registerBlock('sidebar', { component: MockComponentB, id: 'widget-2' })

        expect(registry.getBlocks('sidebar')).toHaveLength(2)

        registry.unregisterBlock('sidebar', 'widget-1')
        expect(registry.getBlocks('sidebar')).toHaveLength(1)
        expect(registry.getBlocks('sidebar')[0].id).toBe('widget-2')

        registry.unregisterBlock('sidebar', 'widget-2')
        expect(registry.getBlocks('sidebar')).toHaveLength(0)
      })

      it('supports re-registering a block after unregistering', () => {
        registry.registerBlock('sidebar', { component: MockComponentA, id: 'widget', weight: 10 })
        registry.unregisterBlock('sidebar', 'widget')

        registry.registerBlock('sidebar', { component: MockComponentB, id: 'widget', weight: 20 })

        const blocks = registry.getBlocks('sidebar')
        expect(blocks).toHaveLength(1)
        expect(blocks[0].component).toBe(MockComponentB)
        expect(blocks[0].weight).toBe(20)
      })

      it('maintains correct ordering after dynamic changes', () => {
        registry.registerBlock('nav', { component: MockComponentA, id: 'first', weight: 10 })
        registry.registerBlock('nav', { component: MockComponentB, id: 'second', weight: 50 })
        registry.registerBlock('nav', { component: MockComponentC, id: 'third', weight: 90 })

        // Remove middle element
        registry.unregisterBlock('nav', 'second')
        expect(registry.getBlocks('nav').map(b => b.id)).toEqual(['first', 'third'])

        // Add new element with middle weight
        registry.registerBlock('nav', { component: { name: 'NewMiddle' }, id: 'new-middle', weight: 50 })
        expect(registry.getBlocks('nav').map(b => b.id)).toEqual(['first', 'new-middle', 'third'])
      })

      it('handles rapid add/remove cycles', () => {
        // Simulate rapid toggling (feature flag scenario)
        for (let i = 0; i < 10; i++) {
          registry.registerBlock('sidebar', { component: MockComponentA, id: 'toggle', weight: 50 })
          registry.unregisterBlock('sidebar', 'toggle')
        }

        expect(registry.getBlocks('sidebar')).toHaveLength(0)

        // Final state - block is registered
        registry.registerBlock('sidebar', { component: MockComponentA, id: 'toggle', weight: 50 })
        expect(registry.getBlocks('sidebar')).toHaveLength(1)
      })

      it('handles multiple zones independently', () => {
        registry.registerBlock('header', { component: MockComponentA, id: 'header-block' })
        registry.registerBlock('sidebar', { component: MockComponentB, id: 'sidebar-block' })
        registry.registerBlock('footer', { component: MockComponentC, id: 'footer-block' })

        // Remove from sidebar only
        registry.unregisterBlock('sidebar', 'sidebar-block')

        expect(registry.getBlocks('header')).toHaveLength(1)
        expect(registry.getBlocks('sidebar')).toHaveLength(0)
        expect(registry.getBlocks('footer')).toHaveLength(1)
      })
    })

    describe('cache invalidation on dynamic changes', () => {
      it('invalidates cache when block is added', () => {
        registry.registerBlock('header', { component: MockComponentA, id: 'a' })
        const firstGet = registry.getBlocks('header')

        registry.registerBlock('header', { component: MockComponentB, id: 'b' })
        const secondGet = registry.getBlocks('header')

        expect(firstGet).not.toBe(secondGet)
        expect(secondGet).toHaveLength(2)
      })

      it('invalidates cache when block is removed', () => {
        registry.registerBlock('header', { component: MockComponentA, id: 'a' })
        registry.registerBlock('header', { component: MockComponentB, id: 'b' })
        const firstGet = registry.getBlocks('header')

        registry.unregisterBlock('header', 'a')
        const secondGet = registry.getBlocks('header')

        expect(firstGet).not.toBe(secondGet)
        expect(secondGet).toHaveLength(1)
      })

      it('re-caches after invalidation', () => {
        registry.registerBlock('header', { component: MockComponentA, id: 'a' })
        registry.unregisterBlock('header', 'a')

        const firstGet = registry.getBlocks('header')
        const secondGet = registry.getBlocks('header')

        expect(firstGet).toBe(secondGet) // Same cache reference
      })
    })
  })
})
