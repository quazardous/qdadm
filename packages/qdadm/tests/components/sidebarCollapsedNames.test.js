/**
 * The sidebar collapsed to its icons (#5465): each entry says where it
 * leads, « Section › Item », in a tooltip on its right and as its
 * accessible name; its label alone without a section title; nothing
 * expanded, nor on a phone (its labels shown).
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import PrimeVue from 'primevue/config'
import { useNavigation } from '../../src/composables/useNavigation'
import { useSettingsMenu } from '../../src/composables/useSettingsMenu'
import { SIDEBAR_COLLAPSED_KEY } from '../../src/composables/useSidebarState'
import { registry, resetRegistry } from '../../src/module/moduleRegistry'
import QdSidebarMenus from '../../src/components/layout/QdSidebarMenus.vue'

const page = { template: '<div />' }
const crumb = (name) => ({ breadcrumb: [{ kind: 'route', route: name }] })

const Sidebar = defineComponent({
  setup() {
    const settings = useSettingsMenu(useNavigation())
    return () => h('aside', [h(QdSidebarMenus, { settings })])
  },
})

let phone = false
async function mountSidebar(collapsed, features = { settingsMenu: { flat: true } }) {
  window.matchMedia = vi.fn(() => ({ matches: phone, addEventListener() {}, removeEventListener() {} }))
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['home', 'it-board', 'it-tasks', 'b2c-board', 'loose', 'groups'].map((n) => ({ path: n === 'home' ? '/' : `/${n}`, name: n, component: page, meta: crumb(n) })),
  })
  await router.push('/')
  const state = ref(collapsed)
  const w = mount(Sidebar, {
    attachTo: document.body,
    global: { plugins: [router, PrimeVue], provide: { qdadmOrchestrator: null, qdadmHooks: null, qdadmFeatures: features, [SIDEBAR_COLLAPSED_KEY]: state } },
  })
  await flushPromises()
  return { w, state }
}

const names = (w, menu) => w.findAll(`[data-menu="${menu}"] .nav-item`).map((a) => a.attributes('aria-label') ?? null)

describe('the sidebar collapsed to its icons (#5465)', () => {
  beforeEach(() => {
    phone = false
    resetRegistry()
    registry.addNavItem({ section: 'IT', route: 'it-board', label: 'Board', icon: 'pi pi-th-large' })
    registry.addNavItem({ section: 'IT', route: 'it-tasks', label: 'Tasks', icon: 'pi pi-check-square' })
    registry.addNavItem({ section: 'B2C orders', route: 'b2c-board', label: 'Board', icon: 'pi pi-th-large' })
    registry.addNavItem({ section: 'Access', route: 'groups', label: 'Groups', menu: 'settings' })
  })
  afterEach(() => document.body.replaceChildren())

  it('collapsed: « Section › Item » for each entry, both menus; a flat settings menu, its label alone', async () => {
    const { w } = await mountSidebar(true)
    expect(names(w, 'main')).toEqual(['IT › Board', 'IT › Tasks', 'B2C orders › Board'])
    expect(names(w, 'settings')).toEqual(['Groups'])
    w.unmount()
  })

  it('expanded: no name added, the label says it', async () => {
    const { w, state } = await mountSidebar(false)
    expect(names(w, 'main')).toEqual([null, null, null])
    // Collapsed on the fly
    state.value = true
    await flushPromises()
    expect(names(w, 'main')[0]).toBe('IT › Board')
    w.unmount()
  })

  it('a titled settings menu: its section too', async () => {
    const { w } = await mountSidebar(true, {})
    expect(names(w, 'settings')).toEqual(['Access › Groups'])
    w.unmount()
  })

  it('on a phone: nothing, the panel shows the labels', async () => {
    phone = true
    const { w } = await mountSidebar(true)
    expect(names(w, 'main')).toEqual([null, null, null])
    w.unmount()
  })
})
