/**
 * Tests for useZoneRegistry composable
 *
 * Tests cover:
 * - Injection and error handling
 * - Reactive block access
 * - Dynamic registration/unregistration
 * - useBlocks computed helper
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick, computed } from 'vue'
import { useZoneRegistry } from '../../src/composables/useZoneRegistry'
import { createZoneRegistry } from '../../src/zones/ZoneRegistry'

// Mock components
const MockComponentA = { name: 'ComponentA' }
const MockComponentB = { name: 'ComponentB' }
const MockComponentC = { name: 'ComponentC' }

describe('useZoneRegistry', () => {
  let registry

  beforeEach(() => {
    registry = createZoneRegistry()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('injection', () => {
    it('throws error when registry not provided', () => {
      const TestComponent = defineComponent({
        setup() {
          expect(() => useZoneRegistry()).toThrow(
            '[qdadm] Zone registry not provided. Ensure Kernel is initialized.'
          )
          return () => h('div', 'test')
        }
      })

      mount(TestComponent)
    })

    it('returns composable when registry is provided', () => {
      let result = null

      const TestComponent = defineComponent({
        setup() {
          result = useZoneRegistry()
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          provide: { qdadmZoneRegistry: registry }
        }
      })

      expect(result).toBeDefined()
      expect(result.registry).toBe(registry)
    })
  })

  describe('returned methods', () => {
    it('exposes registry directly for advanced usage', () => {
      let result = null

      const TestComponent = defineComponent({
        setup() {
          result = useZoneRegistry()
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          provide: { qdadmZoneRegistry: registry }
        }
      })

      expect(result.registry).toBe(registry)
    })

    it('exposes getBlocks function', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'a' })
      let result = null

      const TestComponent = defineComponent({
        setup() {
          result = useZoneRegistry()
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          provide: { qdadmZoneRegistry: registry }
        }
      })

      const blocks = result.getBlocks('header')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].id).toBe('a')
    })

    it('exposes registerBlock function', () => {
      let result = null

      const TestComponent = defineComponent({
        setup() {
          result = useZoneRegistry()
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          provide: { qdadmZoneRegistry: registry }
        }
      })

      result.registerBlock('sidebar', { component: MockComponentA, id: 'widget' })

      expect(registry.getBlocks('sidebar')).toHaveLength(1)
    })

    it('exposes unregisterBlock function', () => {
      registry.registerBlock('sidebar', { component: MockComponentA, id: 'widget' })
      let result = null

      const TestComponent = defineComponent({
        setup() {
          result = useZoneRegistry()
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          provide: { qdadmZoneRegistry: registry }
        }
      })

      const removed = result.unregisterBlock('sidebar', 'widget')

      expect(removed).toBe(true)
      expect(registry.getBlocks('sidebar')).toHaveLength(0)
    })

    it('exposes passthrough methods', () => {
      let result = null

      const TestComponent = defineComponent({
        setup() {
          result = useZoneRegistry()
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          provide: { qdadmZoneRegistry: registry }
        }
      })

      // Test each passthrough method
      expect(typeof result.defineZone).toBe('function')
      expect(typeof result.hasBlocks).toBe('function')
      expect(typeof result.hasZone).toBe('function')
      expect(typeof result.getDefault).toBe('function')
      expect(typeof result.listZones).toBe('function')
      expect(typeof result.getZoneInfo).toBe('function')
      expect(typeof result.inspect).toBe('function')
    })
  })

  describe('useBlocks computed helper', () => {
    it('returns a computed ref for zone blocks', async () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'a' })
      let blocksRef = null

      const TestComponent = defineComponent({
        setup() {
          const { useBlocks } = useZoneRegistry()
          blocksRef = useBlocks('header')
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          provide: { qdadmZoneRegistry: registry }
        }
      })

      expect(blocksRef.value).toHaveLength(1)
      expect(blocksRef.value[0].id).toBe('a')
    })

    it('updates when blocks are added', async () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'a' })
      let blocksRef = null

      const TestComponent = defineComponent({
        setup() {
          const { useBlocks } = useZoneRegistry()
          blocksRef = useBlocks('header')
          return () => h('div', `count: ${blocksRef.value.length}`)
        }
      })

      const wrapper = mount(TestComponent, {
        global: {
          provide: { qdadmZoneRegistry: registry }
        }
      })

      expect(wrapper.text()).toBe('count: 1')

      // Add another block
      registry.registerBlock('header', { component: MockComponentB, id: 'b' })
      await nextTick()

      expect(blocksRef.value).toHaveLength(2)
    })

    it('updates when blocks are removed', async () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'a' })
      registry.registerBlock('header', { component: MockComponentB, id: 'b' })
      let blocksRef = null

      const TestComponent = defineComponent({
        setup() {
          const { useBlocks } = useZoneRegistry()
          blocksRef = useBlocks('header')
          return () => h('div', `count: ${blocksRef.value.length}`)
        }
      })

      mount(TestComponent, {
        global: {
          provide: { qdadmZoneRegistry: registry }
        }
      })

      expect(blocksRef.value).toHaveLength(2)

      // Remove a block
      registry.unregisterBlock('header', 'a')
      await nextTick()

      expect(blocksRef.value).toHaveLength(1)
      expect(blocksRef.value[0].id).toBe('b')
    })
  })

  describe('reactive getBlocks', () => {
    it('getBlocks returns fresh data when version changes', async () => {
      let result = null

      const TestComponent = defineComponent({
        setup() {
          result = useZoneRegistry()
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          provide: { qdadmZoneRegistry: registry }
        }
      })

      expect(result.getBlocks('header')).toHaveLength(0)

      registry.registerBlock('header', { component: MockComponentA, id: 'a' })

      // getBlocks should now return fresh data
      expect(result.getBlocks('header')).toHaveLength(1)
    })
  })

  describe('component lifecycle integration', () => {
    it('supports register on mount, unregister on unmount pattern', async () => {
      const DynamicWidget = defineComponent({
        setup() {
          const { registerBlock, unregisterBlock } = useZoneRegistry()

          // Register on component setup
          registerBlock('sidebar', {
            id: 'dynamic-widget',
            component: MockComponentA,
            weight: 50
          })

          // Return cleanup function (simulates onUnmounted)
          return () => h('div', 'widget')
        }
      })

      const wrapper = mount(DynamicWidget, {
        global: {
          provide: { qdadmZoneRegistry: registry }
        }
      })

      expect(registry.getBlocks('sidebar')).toHaveLength(1)

      // Simulate unmount by using registry directly
      // (in real app, would use onUnmounted)
      registry.unregisterBlock('sidebar', 'dynamic-widget')

      expect(registry.getBlocks('sidebar')).toHaveLength(0)
    })
  })

  describe('dynamic block management scenarios', () => {
    it('handles feature flag toggling', async () => {
      let result = null
      let featureEnabled = false

      const TestComponent = defineComponent({
        setup() {
          result = useZoneRegistry()
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          provide: { qdadmZoneRegistry: registry }
        }
      })

      // Toggle feature on
      featureEnabled = true
      if (featureEnabled) {
        result.registerBlock('sidebar', { id: 'feature-widget', component: MockComponentA })
      }
      expect(result.getBlocks('sidebar')).toHaveLength(1)

      // Toggle feature off
      featureEnabled = false
      if (!featureEnabled) {
        result.unregisterBlock('sidebar', 'feature-widget')
      }
      expect(result.getBlocks('sidebar')).toHaveLength(0)

      // Toggle back on
      featureEnabled = true
      if (featureEnabled) {
        result.registerBlock('sidebar', { id: 'feature-widget', component: MockComponentB })
      }
      expect(result.getBlocks('sidebar')).toHaveLength(1)
      expect(result.getBlocks('sidebar')[0].component).toBe(MockComponentB)
    })

    it('handles conditional block registration based on user state', async () => {
      let result = null

      const TestComponent = defineComponent({
        setup() {
          result = useZoneRegistry()
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          provide: { qdadmZoneRegistry: registry }
        }
      })

      // Simulate user login -> show premium widget
      const isLoggedIn = true
      const isPremium = true

      if (isLoggedIn) {
        result.registerBlock('header', { id: 'user-menu', component: MockComponentA })
      }
      if (isPremium) {
        result.registerBlock('sidebar', { id: 'premium-widget', component: MockComponentB })
      }

      expect(result.getBlocks('header')).toHaveLength(1)
      expect(result.getBlocks('sidebar')).toHaveLength(1)

      // Simulate logout -> remove both
      result.unregisterBlock('header', 'user-menu')
      result.unregisterBlock('sidebar', 'premium-widget')

      expect(result.getBlocks('header')).toHaveLength(0)
      expect(result.getBlocks('sidebar')).toHaveLength(0)
    })

    it('handles multiple components managing different blocks in same zone', async () => {
      // Simulate two components each adding a block to sidebar
      let result1 = null
      let result2 = null

      const Component1 = defineComponent({
        setup() {
          result1 = useZoneRegistry()
          result1.registerBlock('sidebar', { id: 'widget-1', component: MockComponentA, weight: 10 })
          return () => h('div', 'widget1')
        }
      })

      const Component2 = defineComponent({
        setup() {
          result2 = useZoneRegistry()
          result2.registerBlock('sidebar', { id: 'widget-2', component: MockComponentB, weight: 20 })
          return () => h('div', 'widget2')
        }
      })

      mount(Component1, {
        global: {
          provide: { qdadmZoneRegistry: registry }
        }
      })

      mount(Component2, {
        global: {
          provide: { qdadmZoneRegistry: registry }
        }
      })

      // Both blocks should be in sidebar, ordered by weight
      const blocks = registry.getBlocks('sidebar')
      expect(blocks).toHaveLength(2)
      expect(blocks[0].id).toBe('widget-1')
      expect(blocks[1].id).toBe('widget-2')

      // Component 1 unmounts -> removes its block
      result1.unregisterBlock('sidebar', 'widget-1')
      expect(registry.getBlocks('sidebar')).toHaveLength(1)
      expect(registry.getBlocks('sidebar')[0].id).toBe('widget-2')
    })
  })
})
