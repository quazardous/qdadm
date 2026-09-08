/**
 * `show` is a real layout now (#1922).
 *
 * `crud({ show })` had been emitting `meta: { layout: 'show' }` since forever,
 * for a layout that existed nowhere: LAYOUT_TYPES knew four names and `show`
 * was not one, the Kernel built its layout map as a closed literal that threw
 * away any `layouts: { show }` an app passed, and no name pattern could reach
 * it either. The resolver returned 'show', found nothing, and fell back to
 * `base` — gracefully, which is precisely what made it invisible. The only way
 * to dress a detail page was to lie and call it a form.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useLayoutResolver, LAYOUT_TYPES } from '../../src/composables/useLayoutResolver'

const mockRoute = { name: undefined, meta: {} }
vi.mock('vue-router', () => ({ useRoute: () => mockRoute }))

const ShowLayout = defineComponent({ name: 'ShowLayout', render: () => h('div', 'show') })
const BaseLayout = defineComponent({ name: 'BaseLayout', render: () => h('div', 'base') })

/** Resolves the layout as `componentName` would, under `route`. */
function resolve({ componentName, routeName, meta = {}, layouts = {} } = {}) {
  mockRoute.name = routeName
  mockRoute.meta = meta
  let result
  const Page = defineComponent({
    name: componentName,
    setup() {
      const r = useLayoutResolver()
      result = { type: r.layoutType.value, component: r.layoutComponent.value }
      return () => h('div')
    },
  })
  mount(Page, { global: { provide: { qdadmLayoutComponents: layouts } } })
  return result
}

describe('the show layout exists', () => {
  it('is in LAYOUT_TYPES', () => {
    expect(LAYOUT_TYPES.SHOW).toBe('show')
  })

  it('resolves from route meta — what crud({ show }) emits', () => {
    const r = resolve({ componentName: 'Anything', meta: { layout: 'show' }, layouts: { show: ShowLayout } })

    expect(r.type).toBe('show')
    expect(r.component).toBe(ShowLayout)
  })

  it('resolves from a *-show route name — the hand-declared case', () => {
    // The load-bearing path: an app that declares its detail route itself has
    // no meta.layout, and this is the only way it can reach `show`.
    const r = resolve({ componentName: 'RunShow', routeName: 'run-show', layouts: { show: ShowLayout } })

    expect(r.type).toBe('show')
  })

  it('resolves from a *Show component name', () => {
    const r = resolve({ componentName: 'CountryShowPage', layouts: { show: ShowLayout } })

    expect(r.type).toBe('show')
  })

  it('still falls back to base when the app provides no show layout', () => {
    // This is what makes the change inert for every existing app: nothing
    // changes appearance unless someone asked for it.
    const r = resolve({ componentName: 'RunShow', routeName: 'run-show', layouts: { base: BaseLayout } })

    expect(r.type).toBe('show')
    expect(r.component).toBe(BaseLayout)
  })
})

describe('show does not steal from the other layouts', () => {
  it.each([
    ['RunList', undefined, 'list'],
    ['RunForm', undefined, 'form'],
    ['RunEdit', undefined, 'form'],
    ['RunCreate', undefined, 'form'],
    ['RunDashboard', undefined, 'dashboard'],
  ])('%s still resolves to %s', (componentName, routeName, expected) => {
    expect(resolve({ componentName, routeName }).type).toBe(expected)
  })

  it.each([
    ['run-list', 'list'],
    ['run-edit', 'form'],
    ['run-create', 'form'],
    ['run-dashboard', 'dashboard'],
  ])('route %s still resolves to %s', (routeName, expected) => {
    expect(resolve({ componentName: 'Neutral', routeName }).type).toBe(expected)
  })

  it('an unrelated name still lands on base', () => {
    expect(resolve({ componentName: 'Neutral', routeName: 'whatever' }).type).toBe('base')
  })
})

describe('the Kernel stops dropping a show layout on the floor', () => {
  it('keeps layouts.show instead of discarding it', async () => {
    // Kernel.vue.ts built this map as a closed four-key literal, so an app
    // that passed `layouts: { show }` had it thrown away without a word —
    // while crud({ show }) kept emitting a layout name for it (#1922).
    const { Kernel } = await import('../../src/kernel/Kernel')
    const kernel = new Kernel({ root: {}, moduleDefs: [], layouts: { show: ShowLayout } })
    kernel._createLayoutComponents()

    expect(kernel.layoutComponents.show).toBe(ShowLayout)
  })

  it('accepts the ShowLayout alias, like the other four', async () => {
    const { Kernel } = await import('../../src/kernel/Kernel')
    const kernel = new Kernel({ root: {}, moduleDefs: [], layouts: { ShowLayout } })
    kernel._createLayoutComponents()

    expect(kernel.layoutComponents.show).toBe(ShowLayout)
  })

  it('leaves it null when the app provides none', async () => {
    const { Kernel } = await import('../../src/kernel/Kernel')
    const kernel = new Kernel({ root: {}, moduleDefs: [] })
    kernel._createLayoutComponents()

    expect(kernel.layoutComponents.show).toBeNull()
  })
})
