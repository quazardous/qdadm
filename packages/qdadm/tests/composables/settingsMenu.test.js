/**
 * The settings menu behind the gear (#5401): entries that say
 * `menu: 'settings'` leave the main menu for it; it exists for whoever sees
 * one of them, and passes the app's gate; a settings page opens it by itself;
 * the gear and the back row switch, the focus following.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useNavigation } from '../../src/composables/useNavigation'
import { useSettingsMenu, SETTINGS_MENU_IDS } from '../../src/composables/useSettingsMenu'
import { registry, resetRegistry } from '../../src/module/moduleRegistry'
import QdSidebarMenus from '../../src/components/layout/QdSidebarMenus.vue'

const page = { template: '<div />' }
const crumb = (name) => ({ breadcrumb: [{ kind: 'route', route: name }] })

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: page, meta: crumb('home') },
      { path: '/books', name: 'books', component: page, meta: crumb('books') },
      { path: '/groups', name: 'groups', component: page, meta: crumb('groups') },
      { path: '/security', name: 'security', component: page, meta: crumb('security') },
    ],
  })
}

/** The menus and a gear, as AppLayout draws them */
const Sidebar = defineComponent({
  setup() {
    const settings = useSettingsMenu(useNavigation())
    return () =>
      h('aside', [
        h(QdSidebarMenus, { settings }),
        settings.available.value
          ? h('button', { id: SETTINGS_MENU_IDS.toggle, 'aria-expanded': String(settings.open.value), 'data-settings-toggle': '', onClick: () => settings.toggle() }, 'gear')
          : null,
      ])
  },
})

async function mountSidebar({ at = '/', security = null, features = null } = {}) {
  const router = createTestRouter()
  await router.push(at)
  const w = mount(Sidebar, {
    attachTo: document.body,
    global: {
      plugins: [router],
      provide: {
        qdadmOrchestrator: null,
        qdadmHooks: null,
        ...(security ? { qdadmSecurityChecker: security } : {}),
        ...(features ? { qdadmFeatures: features } : {}),
      },
    },
  })
  await flushPromises()
  return { w, router }
}

const labels = (w, menu) => w.findAll(`[data-menu="${menu}"] .nav-item:not(.sidebar-menu-back) span`).map((s) => s.text())
const shown = (w) => (w.find('[data-menu="main"]').attributes('inert') === undefined ? 'main' : 'settings')

describe('the settings menu (#5401)', () => {
  beforeEach(() => {
    resetRegistry()
    registry.addNavItem({ section: 'Library', route: 'books', label: 'Books' })
    registry.addNavItem({ section: 'Access', route: 'groups', label: 'Groups', menu: 'settings', permission: 'groups:read' })
    registry.addNavItem({ section: 'Access', route: 'security', label: 'Security', menu: 'settings', permission: 'security:read' })
  })

  it('takes its entries out of the main menu', async () => {
    const { w } = await mountSidebar()
    expect(labels(w, 'main')).toEqual(['Books'])
    expect(labels(w, 'settings')).toEqual(['Groups', 'Security'])
  })

  it('exists for whoever sees one of its entries, behind the app gate', async () => {
    const none = await mountSidebar({ security: { isGranted: () => false } })
    expect(none.w.find('[data-menu="settings"]').exists()).toBe(false)
    expect(none.w.find('[data-settings-toggle]').exists()).toBe(false)
    const gated = await mountSidebar({ features: { settingsMenu: { visible: () => false } } })
    expect(gated.w.find('[data-settings-toggle]').exists()).toBe(false)
    const partial = await mountSidebar({ security: { isGranted: (a) => a !== 'security:read' } })
    expect(labels(partial.w, 'settings')).toEqual(['Groups'])
  })

  it('no settings entry: the main menu as before, no gear', async () => {
    resetRegistry()
    registry.addNavItem({ section: 'Library', route: 'books', label: 'Books' })
    const { w } = await mountSidebar()
    expect(w.findAll('nav').length).toBe(1)
    expect(w.find('nav').attributes('inert')).toBeUndefined()
    expect(w.find('[data-settings-toggle]').exists()).toBe(false)
  })

  it('a settings page opens it by itself; a main page brings the main menu back', async () => {
    const { w, router } = await mountSidebar({ at: '/groups' })
    expect(shown(w)).toBe('settings')
    expect(w.find('[data-settings-toggle]').attributes('aria-expanded')).toBe('true')
    await router.push('/books')
    await flushPromises()
    expect(shown(w)).toBe('main')
  })

  it('the gear opens it, the focus on its first entry; the back row closes it, the focus on the gear', async () => {
    const { w } = await mountSidebar({ features: { settingsMenu: { back: true } } })
    expect(shown(w)).toBe('main')
    await w.find('[data-settings-toggle]').trigger('click')
    await nextTick()
    await nextTick()
    expect(shown(w)).toBe('settings')
    expect(w.find('[data-menu="main"]').attributes('aria-hidden')).toBe('true')
    expect(document.activeElement?.textContent).toContain('Groups')
    await w.find('[data-settings-back]').trigger('click')
    await nextTick()
    await nextTick()
    expect(shown(w)).toBe('main')
    expect(document.activeElement?.id).toBe(SETTINGS_MENU_IDS.toggle)
    w.unmount()
  })

  it('ctx.crud nav takes menu', async () => {
    const { KernelContext } = await import('../../src/kernel/KernelContext')
    resetRegistry()
    const ctx = new KernelContext({ orchestrator: null }, { name: 'access' })
    ctx.crud('groups', { list: () => Promise.resolve({ default: page }) }, { nav: { section: 'Access', menu: 'settings' } })
    const { getNavSections } = await import('../../src/module/moduleRegistry')
    expect(getNavSections()[0].items[0].menu).toBe('settings')
  })
})

describe('settingsMenu.sections (#5401)', () => {
  it('moves whole sections, a module of its own among them', async () => {
    resetRegistry()
    registry.addNavItem({ section: 'Library', route: 'books', label: 'Books' })
    registry.addNavItem({ section: 'Security', route: 'security', label: 'Roles' })
    const { w } = await mountSidebar({ features: { settingsMenu: { sections: ['Security'] } } })
    expect(labels(w, 'main')).toEqual(['Books'])
    expect(labels(w, 'settings')).toEqual(['Roles'])
  })
})

describe('the settings menu, lighter (#5410)', () => {
  const titles = (w, menu) => w.findAll(`[data-menu="${menu}"] .nav-section-title span`).map((s) => s.text())

  // The menu is read once and kept: each case declares its own
  const declare = (two = false) => {
    resetRegistry()
    registry.addNavItem({ section: 'Library', route: 'books', label: 'Books' })
    registry.addNavItem({ section: 'Access', route: 'groups', label: 'Groups', menu: 'settings' })
    if (two) registry.addNavItem({ section: 'System', route: 'security', label: 'Security', menu: 'settings' })
  }
  beforeEach(() => declare())

  it('has no back row by default; with back: true, it says where it goes', async () => {
    const plain = await mountSidebar()
    expect(plain.w.find('[data-settings-back]').exists()).toBe(false)
    const withBack = await mountSidebar({ features: { settingsMenu: { back: true } } })
    const row = withBack.w.find('[data-settings-back]')
    expect(row.text()).toBe('Menu')
    expect(row.attributes('aria-label')).toBe('Back to the menu')
  })

  it('Escape closes it, the focus back on the gear', async () => {
    const { w } = await mountSidebar({ at: '/groups' })
    expect(shown(w)).toBe('settings')
    await w.find('[data-menu="settings"] a.nav-item').trigger('keydown', { key: 'Escape' })
    await nextTick()
    await nextTick()
    expect(shown(w)).toBe('main')
    expect(document.activeElement?.id).toBe(SETTINGS_MENU_IDS.toggle)
    w.unmount()
  })

  it('a lone section keeps its title (#5418); several keep theirs; the main menu keeps its own', async () => {
    const lone = await mountSidebar()
    expect(titles(lone.w, 'settings')).toEqual(['Access'])
    expect(labels(lone.w, 'settings')).toEqual(['Groups'])
    expect(titles(lone.w, 'main')).toEqual(['Library'])
    declare(true)
    const two = await mountSidebar()
    expect(titles(two.w, 'settings')).toEqual(['Access', 'System'])
  })

  it('flat: true takes every title away', async () => {
    declare(true)
    const never = await mountSidebar({ features: { settingsMenu: { flat: true } } })
    expect(titles(never.w, 'settings')).toEqual([])
    expect(labels(never.w, 'settings')).toEqual(['Groups', 'Security'])
  })

  it('a section without its title is never left folded', async () => {
    localStorage.setItem('qdadm_nav_collapsed', JSON.stringify({ Access: true }))
    const { w } = await mountSidebar({ features: { settingsMenu: { flat: true } } })
    expect(w.find('[data-menu="settings"] .nav-section-collapsed').exists()).toBe(false)
    localStorage.removeItem('qdadm_nav_collapsed')
  })

  it('wears its own colours, unless tone: false', async () => {
    const toned = await mountSidebar()
    expect(toned.w.find('[data-menu="settings"]').classes()).toContain('sidebar-menu--toned')
    expect(toned.w.find('[data-menu="main"]').classes()).not.toContain('sidebar-menu--toned')
    const plain = await mountSidebar({ features: { settingsMenu: { tone: false } } })
    expect(plain.w.find('[data-menu="settings"]').classes()).not.toContain('sidebar-menu--toned')
  })
})
