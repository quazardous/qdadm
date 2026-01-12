/**
 * Tests for useNavigation composable and menu:alter hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useNavigation } from '../../src/composables/useNavigation.js'
import { createHookRegistry } from '../../src/hooks/HookRegistry'
import {
  registry,
  resetRegistry,
  getNavSections,
  alterMenuSections,
  isMenuAltered,
  setSectionOrder
} from '../../src/module/moduleRegistry.js'

// Create a simple router for testing
function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
      { path: '/users', name: 'users', component: { template: '<div>Users</div>' } },
      { path: '/settings', name: 'settings', component: { template: '<div>Settings</div>' } }
    ]
  })
}

describe('menu:alter hook', () => {
  let hooks

  beforeEach(() => {
    resetRegistry()
    hooks = createHookRegistry()
  })

  afterEach(() => {
    hooks.dispose()
  })

  describe('alterMenuSections()', () => {
    it('returns raw sections when no hooks registered', async () => {
      registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users', icon: 'pi pi-users' })

      await alterMenuSections(hooks)

      const sections = getNavSections()
      expect(sections).toHaveLength(1)
      expect(sections[0].title).toBe('Admin')
      expect(sections[0].items).toHaveLength(1)
    })

    it('allows adding new section via hook', async () => {
      registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users' })

      hooks.register('menu:alter', (context) => {
        context.sections.push({
          title: 'Tools',
          items: [{ route: 'tools', label: 'Tools', icon: 'pi pi-wrench' }]
        })
        return context
      })

      await alterMenuSections(hooks)

      const sections = getNavSections()
      expect(sections).toHaveLength(2)
      expect(sections[1].title).toBe('Tools')
    })

    it('allows adding item to existing section via hook', async () => {
      registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users' })

      hooks.register('menu:alter', (context) => {
        const adminSection = context.sections.find(s => s.title === 'Admin')
        if (adminSection) {
          adminSection.items.push({ route: 'settings', label: 'Settings' })
        }
        return context
      })

      await alterMenuSections(hooks)

      const sections = getNavSections()
      expect(sections[0].items).toHaveLength(2)
      expect(sections[0].items[1].route).toBe('settings')
    })

    it('allows removing section via hook', async () => {
      registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users' })
      registry.addNavItem({ section: 'Legacy', route: 'old-stuff', label: 'Old Stuff' })

      hooks.register('menu:alter', (context) => {
        const idx = context.sections.findIndex(s => s.title === 'Legacy')
        if (idx !== -1) context.sections.splice(idx, 1)
        return context
      })

      await alterMenuSections(hooks)

      const sections = getNavSections()
      expect(sections).toHaveLength(1)
      expect(sections[0].title).toBe('Admin')
    })

    it('allows removing item from section via hook', async () => {
      registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users' })
      registry.addNavItem({ section: 'Admin', route: 'hidden', label: 'Hidden' })

      hooks.register('menu:alter', (context) => {
        const adminSection = context.sections.find(s => s.title === 'Admin')
        if (adminSection) {
          const idx = adminSection.items.findIndex(i => i.route === 'hidden')
          if (idx !== -1) adminSection.items.splice(idx, 1)
        }
        return context
      })

      await alterMenuSections(hooks)

      const sections = getNavSections()
      expect(sections[0].items).toHaveLength(1)
      expect(sections[0].items[0].route).toBe('users')
    })

    it('allows reordering sections via hook', async () => {
      registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users' })
      registry.addNavItem({ section: 'Tools', route: 'tools', label: 'Tools' })

      hooks.register('menu:alter', (context) => {
        // Reverse the order
        context.sections.reverse()
        return context
      })

      await alterMenuSections(hooks)

      const sections = getNavSections()
      expect(sections[0].title).toBe('Tools')
      expect(sections[1].title).toBe('Admin')
    })

    it('allows modifying item properties via hook', async () => {
      registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users', icon: 'pi pi-users' })

      hooks.register('menu:alter', (context) => {
        const adminSection = context.sections.find(s => s.title === 'Admin')
        if (adminSection) {
          const usersItem = adminSection.items.find(i => i.route === 'users')
          if (usersItem) {
            usersItem.label = 'Team Members'
            usersItem.icon = 'pi pi-users'
          }
        }
        return context
      })

      await alterMenuSections(hooks)

      const sections = getNavSections()
      expect(sections[0].items[0].label).toBe('Team Members')
    })

    it('respects hook priority ordering', async () => {
      registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users' })

      const callOrder = []

      hooks.register('menu:alter', (context) => {
        callOrder.push('low')
        return context
      }, { priority: 25 })

      hooks.register('menu:alter', (context) => {
        callOrder.push('high')
        return context
      }, { priority: 75 })

      await alterMenuSections(hooks)

      expect(callOrder).toEqual(['high', 'low'])
    })

    it('chains multiple hooks correctly', async () => {
      registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users' })

      hooks.register('menu:alter', (context) => {
        context.sections.push({ title: 'First', items: [] })
        return context
      }, { priority: 75 })

      hooks.register('menu:alter', (context) => {
        context.sections.push({ title: 'Second', items: [] })
        return context
      }, { priority: 50 })

      await alterMenuSections(hooks)

      const sections = getNavSections()
      expect(sections).toHaveLength(3)
      expect(sections[1].title).toBe('First')
      expect(sections[2].title).toBe('Second')
    })

    it('only runs alteration once (idempotent)', async () => {
      registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users' })

      let callCount = 0
      hooks.register('menu:alter', (context) => {
        callCount++
        return context
      })

      await alterMenuSections(hooks)
      await alterMenuSections(hooks)
      await alterMenuSections(hooks)

      expect(callCount).toBe(1)
    })

    it('works without hooks registry', async () => {
      registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users' })

      await alterMenuSections(null)

      const sections = getNavSections()
      expect(sections).toHaveLength(1)
      expect(isMenuAltered()).toBe(true)
    })

    it('respects section order from setSectionOrder', async () => {
      setSectionOrder(['Tools', 'Admin'])
      registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users' })
      registry.addNavItem({ section: 'Tools', route: 'tools', label: 'Tools' })

      await alterMenuSections(hooks)

      const sections = getNavSections()
      expect(sections[0].title).toBe('Tools')
      expect(sections[1].title).toBe('Admin')
    })
  })

  describe('isMenuAltered()', () => {
    it('returns false before alteration', () => {
      expect(isMenuAltered()).toBe(false)
    })

    it('returns true after alteration', async () => {
      await alterMenuSections(hooks)
      expect(isMenuAltered()).toBe(true)
    })

    it('returns false after resetRegistry', async () => {
      await alterMenuSections(hooks)
      resetRegistry()
      expect(isMenuAltered()).toBe(false)
    })
  })
})

describe('useNavigation with menu:alter', () => {
  let hooks
  let router

  beforeEach(async () => {
    resetRegistry()
    hooks = createHookRegistry()
    router = createTestRouter()
    await router.push('/')
  })

  afterEach(() => {
    hooks.dispose()
  })

  it('invokes menu:alter on mount', async () => {
    registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users' })

    let hookCalled = false
    hooks.register('menu:alter', (context) => {
      hookCalled = true
      return context
    })

    const TestComponent = defineComponent({
      setup() {
        const { navSections, isReady } = useNavigation()
        return () => h('div', [
          h('span', { class: 'ready' }, isReady.value ? 'ready' : 'loading'),
          h('span', { class: 'count' }, navSections.value.length)
        ])
      }
    })

    const wrapper = mount(TestComponent, {
      global: {
        plugins: [router],
        provide: {
          qdadmHooks: hooks,
          qdadmOrchestrator: null
        }
      }
    })

    // Wait for mount + async alterMenuSections
    await flushPromises()
    await nextTick()

    expect(hookCalled).toBe(true)
    expect(wrapper.find('.ready').text()).toBe('ready')
  })

  it('reflects altered sections in navSections computed', async () => {
    registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users' })

    hooks.register('menu:alter', (context) => {
      context.sections.push({
        title: 'Extra',
        items: [{ route: 'extra', label: 'Extra' }]
      })
      return context
    })

    let capturedSections = null

    const TestComponent = defineComponent({
      setup() {
        const { navSections } = useNavigation()
        capturedSections = navSections
        return () => h('div')
      }
    })

    mount(TestComponent, {
      global: {
        plugins: [router],
        provide: {
          qdadmHooks: hooks,
          qdadmOrchestrator: null
        }
      }
    })

    await flushPromises()
    await nextTick()

    expect(capturedSections.value).toHaveLength(2)
    expect(capturedSections.value[1].title).toBe('Extra')
  })

  it('filters altered sections by entity permissions', async () => {
    registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users', entity: 'users' })

    hooks.register('menu:alter', (context) => {
      context.sections[0].items.push({
        route: 'secrets',
        label: 'Secrets',
        entity: 'secrets'
      })
      return context
    })

    // Mock orchestrator that denies access to 'secrets'
    const mockOrchestrator = {
      get(name) {
        if (name === 'secrets') {
          return { canRead: () => false }
        }
        return { canRead: () => true }
      }
    }

    let capturedSections = null

    const TestComponent = defineComponent({
      setup() {
        const { navSections } = useNavigation()
        capturedSections = navSections
        return () => h('div')
      }
    })

    mount(TestComponent, {
      global: {
        plugins: [router],
        provide: {
          qdadmHooks: hooks,
          qdadmOrchestrator: mockOrchestrator
        }
      }
    })

    await flushPromises()
    await nextTick()

    // Should only have 'users' item, 'secrets' filtered out
    expect(capturedSections.value[0].items).toHaveLength(1)
    expect(capturedSections.value[0].items[0].route).toBe('users')
  })

  it('returns isReady false initially if not altered', async () => {
    registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users' })

    let initialIsReady = null

    const TestComponent = defineComponent({
      setup() {
        const { isReady } = useNavigation()
        initialIsReady = isReady.value
        return () => h('div')
      }
    })

    mount(TestComponent, {
      global: {
        plugins: [router],
        provide: {
          qdadmHooks: hooks,
          qdadmOrchestrator: null
        }
      }
    })

    expect(initialIsReady).toBe(false)
  })

  it('returns isReady true if already altered before mount', async () => {
    registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users' })

    // Pre-alter
    await alterMenuSections(hooks)

    let initialIsReady = null

    const TestComponent = defineComponent({
      setup() {
        const { isReady } = useNavigation()
        initialIsReady = isReady.value
        return () => h('div')
      }
    })

    mount(TestComponent, {
      global: {
        plugins: [router],
        provide: {
          qdadmHooks: hooks,
          qdadmOrchestrator: null
        }
      }
    })

    expect(initialIsReady).toBe(true)
  })
})
