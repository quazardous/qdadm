/**
 * Tests for useLayoutResolver composable
 *
 * Tests automatic layout resolution based on:
 * - Route meta configuration
 * - Page name conventions
 * - Route name patterns
 * - Explicit layout prop
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, markRaw } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import {
  useLayoutResolver,
  createLayoutComponents,
  layoutMeta,
  LAYOUT_TYPES
} from '../../src/composables/useLayoutResolver'

// Mock layout components
const MockListLayout = defineComponent({ name: 'ListLayout', render: () => h('div', 'list') })
const MockFormLayout = defineComponent({ name: 'FormLayout', render: () => h('div', 'form') })
const MockDashboardLayout = defineComponent({ name: 'DashboardLayout', render: () => h('div', 'dashboard') })
const MockBaseLayout = defineComponent({ name: 'BaseLayout', render: () => h('div', 'base') })

// Create a test router
function createTestRouter(routes = []) {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
      ...routes
    ]
  })
}

describe('useLayoutResolver', () => {
  describe('LAYOUT_TYPES', () => {
    it('exports layout type constants', () => {
      expect(LAYOUT_TYPES.LIST).toBe('list')
      expect(LAYOUT_TYPES.FORM).toBe('form')
      expect(LAYOUT_TYPES.DASHBOARD).toBe('dashboard')
      expect(LAYOUT_TYPES.BASE).toBe('base')
    })
  })

  describe('layoutMeta helper', () => {
    it('creates route meta object with layout', () => {
      expect(layoutMeta('list')).toEqual({ layout: 'list' })
      expect(layoutMeta('form')).toEqual({ layout: 'form' })
      expect(layoutMeta('dashboard')).toEqual({ layout: 'dashboard' })
    })
  })

  describe('createLayoutComponents helper', () => {
    it('maps layout components by type', () => {
      const layouts = createLayoutComponents({
        list: MockListLayout,
        form: MockFormLayout,
        dashboard: MockDashboardLayout,
        base: MockBaseLayout
      })

      expect(layouts.list).toBe(MockListLayout)
      expect(layouts.form).toBe(MockFormLayout)
      expect(layouts.dashboard).toBe(MockDashboardLayout)
      expect(layouts.base).toBe(MockBaseLayout)
    })

    it('supports alternate naming (ListLayout, FormLayout, etc.)', () => {
      const layouts = createLayoutComponents({
        ListLayout: MockListLayout,
        FormLayout: MockFormLayout
      })

      expect(layouts.list).toBe(MockListLayout)
      expect(layouts.form).toBe(MockFormLayout)
    })

    it('returns null for missing layouts', () => {
      const layouts = createLayoutComponents({})

      expect(layouts.list).toBeNull()
      expect(layouts.form).toBeNull()
      expect(layouts.dashboard).toBeNull()
      expect(layouts.base).toBeNull()
    })
  })

  describe('layout resolution priority', () => {
    it('priority 1: uses explicit layout option', async () => {
      const router = createTestRouter()
      await router.push('/')
      let capturedLayout = null

      const TestComponent = defineComponent({
        setup() {
          const { layoutType } = useLayoutResolver({ layout: 'form' })
          capturedLayout = layoutType
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          plugins: [router]
        }
      })

      expect(capturedLayout.value).toBe('form')
    })

    it('priority 2: uses route meta.layout', async () => {
      const router = createTestRouter([
        { path: '/books', name: 'books', component: { template: '<div/>' }, meta: { layout: 'list' } }
      ])
      await router.push('/books')
      let capturedLayout = null

      const TestComponent = defineComponent({
        setup() {
          const { layoutType } = useLayoutResolver()
          capturedLayout = layoutType
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          plugins: [router]
        }
      })

      expect(capturedLayout.value).toBe('list')
    })

    it('priority 3: detects from component name (ListPage)', async () => {
      const router = createTestRouter()
      await router.push('/')
      let capturedLayout = null

      const BookListPage = defineComponent({
        name: 'BookListPage',
        setup() {
          const { layoutType } = useLayoutResolver()
          capturedLayout = layoutType
          return () => h('div', 'test')
        }
      })

      mount(BookListPage, {
        global: {
          plugins: [router]
        }
      })

      expect(capturedLayout.value).toBe('list')
    })

    it('priority 3: detects from component name (EditPage)', async () => {
      const router = createTestRouter()
      await router.push('/')
      let capturedLayout = null

      const BookEditPage = defineComponent({
        name: 'BookEditPage',
        setup() {
          const { layoutType } = useLayoutResolver()
          capturedLayout = layoutType
          return () => h('div', 'test')
        }
      })

      mount(BookEditPage, {
        global: {
          plugins: [router]
        }
      })

      expect(capturedLayout.value).toBe('form')
    })

    it('priority 3: detects from component name (CreatePage)', async () => {
      const router = createTestRouter()
      await router.push('/')
      let capturedLayout = null

      const BookCreatePage = defineComponent({
        name: 'BookCreatePage',
        setup() {
          const { layoutType } = useLayoutResolver()
          capturedLayout = layoutType
          return () => h('div', 'test')
        }
      })

      mount(BookCreatePage, {
        global: {
          plugins: [router]
        }
      })

      expect(capturedLayout.value).toBe('form')
    })

    it('priority 3: detects from component name (DashboardPage)', async () => {
      const router = createTestRouter()
      await router.push('/')
      let capturedLayout = null

      const HomeDashboardPage = defineComponent({
        name: 'HomeDashboardPage',
        setup() {
          const { layoutType } = useLayoutResolver()
          capturedLayout = layoutType
          return () => h('div', 'test')
        }
      })

      mount(HomeDashboardPage, {
        global: {
          plugins: [router]
        }
      })

      expect(capturedLayout.value).toBe('dashboard')
    })

    it('priority 4: detects from route name (-list suffix)', async () => {
      const router = createTestRouter([
        { path: '/books', name: 'book-list', component: { template: '<div/>' } }
      ])
      await router.push('/books')
      let capturedLayout = null

      const TestComponent = defineComponent({
        setup() {
          const { layoutType } = useLayoutResolver()
          capturedLayout = layoutType
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          plugins: [router]
        }
      })

      expect(capturedLayout.value).toBe('list')
    })

    it('priority 4: detects from route name (-edit suffix)', async () => {
      const router = createTestRouter([
        { path: '/books/:id/edit', name: 'book-edit', component: { template: '<div/>' } }
      ])
      await router.push('/books/1/edit')
      let capturedLayout = null

      const TestComponent = defineComponent({
        setup() {
          const { layoutType } = useLayoutResolver()
          capturedLayout = layoutType
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          plugins: [router]
        }
      })

      expect(capturedLayout.value).toBe('form')
    })

    it('priority 4: detects from route name (-create suffix)', async () => {
      const router = createTestRouter([
        { path: '/books/create', name: 'book-create', component: { template: '<div/>' } }
      ])
      await router.push('/books/create')
      let capturedLayout = null

      const TestComponent = defineComponent({
        setup() {
          const { layoutType } = useLayoutResolver()
          capturedLayout = layoutType
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          plugins: [router]
        }
      })

      expect(capturedLayout.value).toBe('form')
    })

    it('priority 4: detects dashboard route', async () => {
      const router = createTestRouter([
        { path: '/dashboard', name: 'dashboard', component: { template: '<div/>' } }
      ])
      await router.push('/dashboard')
      let capturedLayout = null

      const TestComponent = defineComponent({
        setup() {
          const { layoutType } = useLayoutResolver()
          capturedLayout = layoutType
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          plugins: [router]
        }
      })

      expect(capturedLayout.value).toBe('dashboard')
    })

    it('priority 5: defaults to base layout', async () => {
      const router = createTestRouter([
        { path: '/settings', name: 'settings', component: { template: '<div/>' } }
      ])
      await router.push('/settings')
      let capturedLayout = null

      const TestComponent = defineComponent({
        setup() {
          const { layoutType } = useLayoutResolver()
          capturedLayout = layoutType
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          plugins: [router]
        }
      })

      expect(capturedLayout.value).toBe('base')
    })

    it('uses custom default when specified', async () => {
      const router = createTestRouter([
        { path: '/settings', name: 'settings', component: { template: '<div/>' } }
      ])
      await router.push('/settings')
      let capturedLayout = null

      const TestComponent = defineComponent({
        setup() {
          const { layoutType } = useLayoutResolver({ default: 'dashboard' })
          capturedLayout = layoutType
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          plugins: [router]
        }
      })

      expect(capturedLayout.value).toBe('dashboard')
    })
  })

  describe('layoutComponent', () => {
    it('returns injected layout component for type', async () => {
      const router = createTestRouter([
        { path: '/books', name: 'books', meta: { layout: 'list' }, component: { template: '<div/>' } }
      ])
      await router.push('/books')
      let capturedComponent = null

      const layoutComponents = {
        list: markRaw(MockListLayout),
        form: markRaw(MockFormLayout),
        base: markRaw(MockBaseLayout)
      }

      const TestComponent = defineComponent({
        setup() {
          const { layoutComponent } = useLayoutResolver()
          capturedComponent = layoutComponent
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          plugins: [router],
          provide: {
            qdadmLayoutComponents: layoutComponents
          }
        }
      })

      expect(capturedComponent.value).toBe(MockListLayout)
    })

    it('returns null when no layout components injected', async () => {
      const router = createTestRouter()
      await router.push('/')
      let capturedComponent = null

      const TestComponent = defineComponent({
        setup() {
          const { layoutComponent } = useLayoutResolver({ layout: 'list' })
          capturedComponent = layoutComponent
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          plugins: [router]
        }
      })

      expect(capturedComponent.value).toBeNull()
    })
  })

  describe('isLayout helper', () => {
    it('returns true for matching layout type', async () => {
      const router = createTestRouter([
        { path: '/books', name: 'books', meta: { layout: 'list' }, component: { template: '<div/>' } }
      ])
      await router.push('/books')
      let result = null

      const TestComponent = defineComponent({
        setup() {
          const { isLayout } = useLayoutResolver()
          result = { list: isLayout('list'), form: isLayout('form') }
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          plugins: [router]
        }
      })

      expect(result.list).toBe(true)
      expect(result.form).toBe(false)
    })
  })

  describe('resolveLayout helper', () => {
    it('resolves layout from provided context', async () => {
      const router = createTestRouter()
      await router.push('/')
      let resolveLayout = null

      const TestComponent = defineComponent({
        setup() {
          const resolver = useLayoutResolver()
          resolveLayout = resolver.resolveLayout
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          plugins: [router]
        }
      })

      // Test explicit
      expect(resolveLayout({ explicit: 'form' })).toBe('form')

      // Test route meta
      expect(resolveLayout({ routeMeta: { layout: 'list' } })).toBe('list')

      // Test component name
      expect(resolveLayout({ componentName: 'BookListPage' })).toBe('list')
      expect(resolveLayout({ componentName: 'BookEditPage' })).toBe('form')
      expect(resolveLayout({ componentName: 'HomeDashboard' })).toBe('dashboard')

      // Test route name
      expect(resolveLayout({ routeName: 'book-list' })).toBe('list')
      expect(resolveLayout({ routeName: 'book-create' })).toBe('form')
      expect(resolveLayout({ routeName: 'dashboard' })).toBe('dashboard')

      // Test default fallback
      expect(resolveLayout({ routeName: 'settings' })).toBe('base')
    })

    it('respects priority order in context', async () => {
      const router = createTestRouter()
      await router.push('/')
      let resolveLayout = null

      const TestComponent = defineComponent({
        setup() {
          const resolver = useLayoutResolver()
          resolveLayout = resolver.resolveLayout
          return () => h('div', 'test')
        }
      })

      mount(TestComponent, {
        global: {
          plugins: [router]
        }
      })

      // Explicit > routeMeta > componentName > routeName
      expect(resolveLayout({
        explicit: 'dashboard',
        routeMeta: { layout: 'list' },
        componentName: 'BookEditPage',
        routeName: 'book-create'
      })).toBe('dashboard')

      expect(resolveLayout({
        routeMeta: { layout: 'list' },
        componentName: 'BookEditPage',
        routeName: 'book-create'
      })).toBe('list')

      expect(resolveLayout({
        componentName: 'BookEditPage',
        routeName: 'book-list'
      })).toBe('form')
    })
  })

  describe('component name patterns', () => {
    const testCases = [
      // List patterns
      { name: 'BookList', expected: 'list' },
      { name: 'UserListPage', expected: 'list' },
      { name: 'ProductsListPage', expected: 'list' },
      // Form patterns (Edit)
      { name: 'BookEdit', expected: 'form' },
      { name: 'UserEditPage', expected: 'form' },
      { name: 'ProductEditPage', expected: 'form' },
      // Form patterns (Create)
      { name: 'BookCreate', expected: 'form' },
      { name: 'UserCreatePage', expected: 'form' },
      { name: 'ProductCreatePage', expected: 'form' },
      // Form patterns (Form suffix)
      { name: 'BookForm', expected: 'form' },
      { name: 'UserFormPage', expected: 'form' },
      // Dashboard patterns
      { name: 'HomeDashboard', expected: 'dashboard' },
      { name: 'AdminDashboardPage', expected: 'dashboard' },
      // No match
      { name: 'SettingsPage', expected: 'base' },
      { name: 'AboutPage', expected: 'base' }
    ]

    testCases.forEach(({ name, expected }) => {
      it(`detects ${expected} from component name: ${name}`, async () => {
        const router = createTestRouter()
        await router.push('/')
        let capturedLayout = null

        const TestComponent = defineComponent({
          name,
          setup() {
            const { layoutType } = useLayoutResolver()
            capturedLayout = layoutType
            return () => h('div', 'test')
          }
        })

        mount(TestComponent, {
          global: {
            plugins: [router]
          }
        })

        expect(capturedLayout.value).toBe(expected)
      })
    })
  })
})
