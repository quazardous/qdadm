/**
 * Unit tests for Zone component
 *
 * Tests cover:
 * - Rendering blocks from ZoneRegistry
 * - Default content when no blocks registered
 * - Wrapped blocks with nested wrappers
 * - Edge cases (missing registry, undefined zone)
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, defineComponent } from 'vue'
import Zone from '../../src/components/layout/Zone.vue'
import { ZoneRegistry } from '../../src/zones/ZoneRegistry.js'

// Mock components for testing
const MockComponentA = defineComponent({
  name: 'ComponentA',
  props: ['title'],
  template: '<div class="component-a">ComponentA: {{ title }}</div>'
})

const MockComponentB = defineComponent({
  name: 'ComponentB',
  props: ['count'],
  template: '<div class="component-b">ComponentB: {{ count }}</div>'
})

const MockComponentC = defineComponent({
  name: 'ComponentC',
  template: '<div class="component-c">ComponentC</div>'
})

const MockDefaultComponent = defineComponent({
  name: 'DefaultComponent',
  template: '<div class="default-component">Default Content</div>'
})

const MockWrapper = defineComponent({
  name: 'Wrapper',
  props: ['border'],
  template: '<div class="wrapper" :class="{ bordered: border }"><slot /></div>'
})

const MockOuterWrapper = defineComponent({
  name: 'OuterWrapper',
  template: '<div class="outer-wrapper"><slot /></div>'
})

describe('Zone', () => {
  let registry

  beforeEach(() => {
    registry = new ZoneRegistry()
  })

  /**
   * Helper to mount Zone with a mocked ZoneRegistry injection
   */
  function mountZone(props, registryOverride = registry) {
    return mount(Zone, {
      props,
      global: {
        provide: {
          qdadmZoneRegistry: registryOverride
        }
      }
    })
  }

  describe('rendering blocks', () => {
    it('renders blocks from registry sorted by weight', () => {
      registry.registerBlock('header', { component: MockComponentA, weight: 30, id: 'a' })
      registry.registerBlock('header', { component: MockComponentB, weight: 10, id: 'b' })
      registry.registerBlock('header', { component: MockComponentC, weight: 50, id: 'c' })

      const wrapper = mountZone({ name: 'header' })

      const components = wrapper.findAll('.component-a, .component-b, .component-c')
      expect(components).toHaveLength(3)
      // Sorted by weight: b(10), a(30), c(50)
      expect(components[0].classes()).toContain('component-b')
      expect(components[1].classes()).toContain('component-a')
      expect(components[2].classes()).toContain('component-c')
    })

    it('passes block props to component', () => {
      registry.registerBlock('header', {
        component: MockComponentA,
        id: 'a',
        props: { title: 'Hello World' }
      })

      const wrapper = mountZone({ name: 'header' })

      expect(wrapper.text()).toContain('ComponentA: Hello World')
    })

    it('merges blockProps with block.props', () => {
      registry.registerBlock('header', {
        component: MockComponentB,
        id: 'b',
        props: { count: 42 }
      })

      const wrapper = mountZone({
        name: 'header',
        blockProps: { extra: 'prop' }
      })

      expect(wrapper.text()).toContain('ComponentB: 42')
    })

    it('renders nothing for empty zone', () => {
      registry.defineZone('empty')

      const wrapper = mountZone({ name: 'empty' })

      expect(wrapper.text()).toBe('')
    })

    it('renders nothing for undefined zone', () => {
      const wrapper = mountZone({ name: 'undefined-zone' })

      expect(wrapper.text()).toBe('')
    })
  })

  describe('default content', () => {
    it('renders defaultComponent prop when no blocks registered', () => {
      registry.defineZone('sidebar')

      const wrapper = mountZone({
        name: 'sidebar',
        defaultComponent: MockDefaultComponent
      })

      expect(wrapper.find('.default-component').exists()).toBe(true)
      expect(wrapper.text()).toContain('Default Content')
    })

    it('renders registry default when no blocks and no prop default', () => {
      registry.defineZone('footer', { default: MockDefaultComponent })

      const wrapper = mountZone({ name: 'footer' })

      expect(wrapper.find('.default-component').exists()).toBe(true)
    })

    it('prefers defaultComponent prop over registry default', () => {
      const PropDefault = defineComponent({
        name: 'PropDefault',
        template: '<div class="prop-default">From Prop</div>'
      })

      registry.defineZone('footer', { default: MockDefaultComponent })

      const wrapper = mountZone({
        name: 'footer',
        defaultComponent: PropDefault
      })

      expect(wrapper.find('.prop-default').exists()).toBe(true)
      expect(wrapper.find('.default-component').exists()).toBe(false)
    })

    it('renders blocks instead of default when blocks exist', () => {
      registry.defineZone('sidebar', { default: MockDefaultComponent })
      registry.registerBlock('sidebar', { component: MockComponentA, id: 'a' })

      const wrapper = mountZone({ name: 'sidebar' })

      expect(wrapper.find('.component-a').exists()).toBe(true)
      expect(wrapper.find('.default-component').exists()).toBe(false)
    })

    it('passes blockProps to default component', () => {
      const DefaultWithProps = defineComponent({
        name: 'DefaultWithProps',
        props: ['title'],
        template: '<div class="default-props">{{ title }}</div>'
      })

      registry.defineZone('sidebar')

      const wrapper = mountZone({
        name: 'sidebar',
        defaultComponent: DefaultWithProps,
        blockProps: { title: 'Default Title' }
      })

      expect(wrapper.text()).toContain('Default Title')
    })
  })

  describe('wrapped blocks', () => {
    it('renders block with single wrapper', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'main' })
      registry.registerBlock('header', {
        component: MockWrapper,
        id: 'wrapper',
        operation: 'wrap',
        wraps: 'main',
        props: { border: true }
      })

      const wrapper = mountZone({ name: 'header' })

      // Wrapper should contain the main component
      expect(wrapper.find('.wrapper').exists()).toBe(true)
      expect(wrapper.find('.wrapper .component-a').exists()).toBe(true)
      expect(wrapper.find('.wrapper').classes()).toContain('bordered')
    })

    it('renders block with nested wrappers (outer wraps inner)', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'content' })
      // Inner wrapper wraps content
      registry.registerBlock('header', {
        component: MockWrapper,
        id: 'inner-wrapper',
        operation: 'wrap',
        wraps: 'content',
        weight: 20
      })
      // Outer wrapper wraps inner wrapper
      registry.registerBlock('header', {
        component: MockOuterWrapper,
        id: 'outer-wrapper',
        operation: 'wrap',
        wraps: 'inner-wrapper',
        weight: 10
      })

      const wrapper = mountZone({ name: 'header' })

      // Structure: outer-wrapper > wrapper > component-a
      expect(wrapper.find('.outer-wrapper').exists()).toBe(true)
      expect(wrapper.find('.outer-wrapper .wrapper').exists()).toBe(true)
      expect(wrapper.find('.outer-wrapper .wrapper .component-a').exists()).toBe(true)
    })

    it('renders multiple wrappers on same block (sorted by weight)', () => {
      registry.registerBlock('header', { component: MockComponentA, id: 'main' })
      // High weight wrapper (inner)
      registry.registerBlock('header', {
        component: MockWrapper,
        id: 'inner',
        operation: 'wrap',
        wraps: 'main',
        weight: 90,
        props: { border: true }
      })
      // Low weight wrapper (outer)
      registry.registerBlock('header', {
        component: MockOuterWrapper,
        id: 'outer',
        operation: 'wrap',
        wraps: 'main',
        weight: 10
      })

      const wrapper = mountZone({ name: 'header' })

      // Lower weight = outer, so outer-wrapper should be outermost
      expect(wrapper.find('.outer-wrapper').exists()).toBe(true)
      expect(wrapper.find('.outer-wrapper .wrapper').exists()).toBe(true)
      expect(wrapper.find('.outer-wrapper .wrapper .component-a').exists()).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('warns in dev mode when registry not injected', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Temporarily override import.meta.env.DEV
      const originalDev = import.meta.env.DEV

      const wrapper = mount(Zone, {
        props: { name: 'header' },
        global: {
          provide: {
            qdadmZoneRegistry: null
          }
        }
      })

      // In dev mode, should warn
      if (import.meta.env.DEV) {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('ZoneRegistry not injected')
        )
      }

      consoleSpy.mockRestore()
    })

    it('handles blocks without id (uses weight as key)', () => {
      registry.registerBlock('header', { component: MockComponentA, weight: 10 })
      registry.registerBlock('header', { component: MockComponentB, weight: 20 })

      const wrapper = mountZone({ name: 'header' })

      expect(wrapper.find('.component-a').exists()).toBe(true)
      expect(wrapper.find('.component-b').exists()).toBe(true)
    })

    it('renders correctly when registry returns empty blocks', () => {
      registry.defineZone('empty-zone')

      const wrapper = mountZone({ name: 'empty-zone' })

      expect(wrapper.html()).toBe('<!--v-if-->')
    })

    it('handles zone with blocks and blockProps together', () => {
      registry.registerBlock('header', {
        component: MockComponentA,
        id: 'a',
        props: { title: 'Block Title' }
      })
      registry.registerBlock('header', {
        component: MockComponentB,
        id: 'b',
        props: { count: 100 }
      })

      const wrapper = mountZone({
        name: 'header',
        blockProps: { sharedProp: 'shared' }
      })

      expect(wrapper.text()).toContain('ComponentA: Block Title')
      expect(wrapper.text()).toContain('ComponentB: 100')
    })
  })

  describe('reactivity', () => {
    it('updates when blocks are added to registry', async () => {
      registry.defineZone('dynamic')

      const wrapper = mountZone({ name: 'dynamic' })

      expect(wrapper.find('.component-a').exists()).toBe(false)

      // Add block to registry
      registry.registerBlock('dynamic', { component: MockComponentA, id: 'a' })

      // Wait for Vue to update
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.component-a').exists()).toBe(true)
    })

    it('updates when blocks are removed from registry', async () => {
      registry.registerBlock('dynamic', { component: MockComponentA, id: 'a' })
      registry.registerBlock('dynamic', { component: MockComponentB, id: 'b' })

      const wrapper = mountZone({ name: 'dynamic' })

      expect(wrapper.findAll('.component-a, .component-b')).toHaveLength(2)

      // Remove a block
      registry.unregisterBlock('dynamic', 'a')

      // Wait for Vue to update
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.component-a').exists()).toBe(false)
      expect(wrapper.find('.component-b').exists()).toBe(true)
    })

    it('updates when all blocks are cleared from zone', async () => {
      registry.registerBlock('dynamic', { component: MockComponentA, id: 'a' })

      const wrapper = mountZone({ name: 'dynamic' })

      expect(wrapper.find('.component-a').exists()).toBe(true)

      // Clear zone
      registry.clearZone('dynamic')

      // Wait for Vue to update
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.component-a').exists()).toBe(false)
    })

    it('handles rapid add/remove cycles', async () => {
      const wrapper = mountZone({ name: 'toggle' })

      // Rapid toggle
      for (let i = 0; i < 5; i++) {
        registry.registerBlock('toggle', { component: MockComponentA, id: 'toggle-block' })
        await wrapper.vm.$nextTick()
        expect(wrapper.find('.component-a').exists()).toBe(true)

        registry.unregisterBlock('toggle', 'toggle-block')
        await wrapper.vm.$nextTick()
        expect(wrapper.find('.component-a').exists()).toBe(false)
      }
    })

    it('shows default slot after all blocks removed', async () => {
      const SlotContent = defineComponent({
        name: 'SlotContent',
        template: '<div class="slot-content">Slot Content</div>'
      })

      registry.registerBlock('main', { component: MockComponentA, id: 'a' })

      const wrapper = mount(Zone, {
        props: { name: 'main' },
        global: {
          provide: { qdadmZoneRegistry: registry }
        },
        slots: {
          default: SlotContent
        }
      })

      expect(wrapper.find('.component-a').exists()).toBe(true)
      expect(wrapper.find('.slot-content').exists()).toBe(false)

      // Remove block
      registry.unregisterBlock('main', 'a')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.component-a').exists()).toBe(false)
      expect(wrapper.find('.slot-content').exists()).toBe(true)
    })
  })

  describe('slot content', () => {
    it('renders slot content when no blocks and no default component', () => {
      const SlotContent = defineComponent({
        name: 'SlotContent',
        template: '<div class="slot-content">Slot Content</div>'
      })

      registry.defineZone('main')

      const wrapper = mount(Zone, {
        props: { name: 'main' },
        global: {
          provide: {
            qdadmZoneRegistry: registry
          }
        },
        slots: {
          default: SlotContent
        }
      })

      expect(wrapper.find('.slot-content').exists()).toBe(true)
      expect(wrapper.text()).toContain('Slot Content')
    })

    it('renders blocks instead of slot when blocks exist', () => {
      const SlotContent = defineComponent({
        name: 'SlotContent',
        template: '<div class="slot-content">Slot Content</div>'
      })

      registry.registerBlock('main', { component: MockComponentA, id: 'a' })

      const wrapper = mount(Zone, {
        props: { name: 'main' },
        global: {
          provide: {
            qdadmZoneRegistry: registry
          }
        },
        slots: {
          default: SlotContent
        }
      })

      expect(wrapper.find('.component-a').exists()).toBe(true)
      expect(wrapper.find('.slot-content').exists()).toBe(false)
    })

    it('renders default component instead of slot when default exists', () => {
      const SlotContent = defineComponent({
        name: 'SlotContent',
        template: '<div class="slot-content">Slot Content</div>'
      })

      registry.defineZone('main')

      const wrapper = mount(Zone, {
        props: { name: 'main', defaultComponent: MockDefaultComponent },
        global: {
          provide: {
            qdadmZoneRegistry: registry
          }
        },
        slots: {
          default: SlotContent
        }
      })

      expect(wrapper.find('.default-component').exists()).toBe(true)
      expect(wrapper.find('.slot-content').exists()).toBe(false)
    })
  })
})
