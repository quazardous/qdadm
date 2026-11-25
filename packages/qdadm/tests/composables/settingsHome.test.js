/**
 * The settings home (#5500): `settingsMenu.home` mounts qdadm's page or names
 * the app's; the settings menu's first row leads to it; every settings page's
 * breadcrumb starts from it (`settingsMenu.breadcrumb`); the page shows the
 * menu's entries as cards, by section, as the menu shows them.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useNavContext } from '../../src/composables/useNavContext'
import { useNavigation } from '../../src/composables/useNavigation'
import { useSettingsMenu } from '../../src/composables/useSettingsMenu'
import { registry, resetRegistry } from '../../src/module/moduleRegistry'
import { settingsHomeRoute, settingsBreadcrumbMode, settingsHomeRecords, sameName, settingsSectionAnchor, SETTINGS_HOME_ROUTE } from '../../src/kernel/settingsHome'
import QdSidebarMenus from '../../src/components/layout/QdSidebarMenus.vue'
import QdSettingsHome from '../../src/components/pages/QdSettingsHome.vue'

const page = { template: '<div />' }
const crumb = (name) => ({ title: name[0].toUpperCase() + name.slice(1) })

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: page },
      { path: '/books', name: 'books', component: page, meta: crumb('books') },
      { path: '/groups', name: 'groups', component: page, meta: crumb('groups') },
      { path: '/policy', name: 'policy', component: page, meta: crumb('policy') },
      { path: '/own', name: 'own', component: page, meta: { breadcrumb: [{ kind: 'route', route: 'own', label: 'Own' }] } },
      { path: '/settings', name: SETTINGS_HOME_ROUTE, component: page },
    ],
  })
}

async function mountWith(at, settingsMenu, render = () => h('div')) {
  const router = createTestRouter()
  await router.push(at)
  await router.isReady()
  let nav
  const Harness = defineComponent({
    setup() {
      nav = useNavContext()
      return render
    },
  })
  const w = mount(Harness, {
    attachTo: document.body,
    global: {
      plugins: [router],
      provide: { qdadmOrchestrator: null, qdadmHooks: null, qdadmHomeRoute: 'home', qdadmStackHydrator: { getLevels: () => [] }, qdadmFeatures: { settingsMenu } },
    },
  })
  await flushPromises()
  return { nav, w, router }
}
const trail = (nav) => nav.breadcrumb.value.map((c) => `${c.label}${c.to ? '*' : ''}`).join(' › ')

describe('the settings home (#5500)', () => {
  beforeEach(() => {
    resetRegistry()
    registry.addNavItem({ section: 'Library', route: 'books', label: 'Books', icon: 'pi pi-book' })
    registry.addNavItem({ section: 'Access', route: 'groups', label: 'Groups', icon: 'pi pi-users', menu: 'settings' })
    registry.addNavItem({ section: 'Security', route: 'policy', label: 'Policy', menu: 'settings', permission: 'policy:read' })
    registry.addNavItem({ section: 'Security', route: 'own', label: 'Own', menu: 'settings' })
  })

  it('reads its config', () => {
    expect(settingsHomeRoute({ home: true })).toBe(SETTINGS_HOME_ROUTE)
    expect(settingsHomeRoute({ home: 'my-settings' })).toBe('my-settings')
    expect(settingsHomeRoute({})).toBe(null)
    expect(settingsBreadcrumbMode({ home: true })).toBe('section')
    expect(settingsBreadcrumbMode({ home: true, breadcrumb: 'home' })).toBe('home')
    expect(settingsBreadcrumbMode({ home: true, breadcrumb: false })).toBe(false)
    expect(settingsBreadcrumbMode({ breadcrumb: 'section' })).toBe(false)
  })

  it('home: true mounts qdadm\'s page on /settings, or /settings-home when the app has a /settings', () => {
    expect(settingsHomeRecords({ home: true }, () => false)[0]).toMatchObject({ path: 'settings', name: SETTINGS_HOME_ROUTE })
    expect(settingsHomeRecords({ home: true }, (p) => p === 'settings', () => {})[0]).toMatchObject({ path: 'settings-home' })
    expect(settingsHomeRecords({ home: 'mine' }, () => false)).toEqual([])
    expect(settingsHomeRecords(undefined, () => false)).toEqual([])
  })

  it('a settings page: Home › Settings › its section › the page', async () => {
    const { nav } = await mountWith('/groups', { home: true })
    expect(trail(nav)).toBe('Home* › Settings* › Access* › Groups')
    // The section step leads to its place on the home (#5501)
    expect(nav.breadcrumb.value[2].to).toEqual({ name: SETTINGS_HOME_ROUTE, hash: '#settings-access' })
  })

  it('the section step is left out when it is the home\'s own name, or the only section (#5501)', async () => {
    resetRegistry()
    registry.addNavItem({ section: 'Settings', route: 'groups', label: 'Groups', menu: 'settings' })
    registry.addNavItem({ section: 'Access', route: 'policy', label: 'Policy', menu: 'settings' })
    expect(trail((await mountWith('/groups', { home: true })).nav)).toBe('Home* › Settings* › Groups')
    expect(trail((await mountWith('/groups', { home: true, label: 'SETTINGS' })).nav)).toBe('Home* › SETTINGS* › Groups')
    resetRegistry()
    registry.addNavItem({ section: 'Access', route: 'groups', label: 'Groups', menu: 'settings' })
    expect(trail((await mountWith('/groups', { home: true })).nav)).toBe('Home* › Settings* › Groups')
  })

  it('names and anchors read the same without case or accents', () => {
    expect(sameName('Paramètres', 'parametres')).toBe(true)
    expect(sameName('Paramètres', 'Sécurité')).toBe(false)
    expect(settingsSectionAnchor('Sécurité & accès')).toBe('settings-securite-acces')
  })

  it("breadcrumb: 'home' leaves the section out; false, the settings too", async () => {
    expect(trail((await mountWith('/groups', { home: true, breadcrumb: 'home' })).nav)).toBe('Home* › Settings* › Groups')
    expect(trail((await mountWith('/groups', { home: true, breadcrumb: false })).nav)).toBe('Home* › Groups')
  })

  it('flat: no section step', async () => {
    expect(trail((await mountWith('/groups', { home: true, flat: true })).nav)).toBe('Home* › Settings* › Groups')
  })

  it("a route's own meta.breadcrumb wins; a main page and no home change nothing", async () => {
    expect(trail((await mountWith('/own', { home: true })).nav)).toBe('Home* › Own')
    expect(trail((await mountWith('/books', { home: true })).nav)).toBe('Home* › Books')
    expect(trail((await mountWith('/groups', {})).nav)).toBe('Home* › Groups')
  })

  it('the home itself: Home › Settings; it counts as a settings page', async () => {
    let settings
    const { nav } = await mountWith('/settings', { home: true }, () => h('div'))
    expect(trail(nav)).toBe('Home* › Settings')
    const S = defineComponent({ setup() { settings = useSettingsMenu(useNavigation()); return () => h(QdSidebarMenus, { settings }) } })
    const router = createTestRouter()
    await router.push('/settings')
    const w = mount(S, { attachTo: document.body, global: { plugins: [router], provide: { qdadmOrchestrator: null, qdadmHooks: null, qdadmFeatures: { settingsMenu: { home: true } } } } })
    await flushPromises()
    expect(settings.open.value).toBe(true)
    const row = w.find('[data-menu="settings"] [data-settings-home]')
    expect(row.exists()).toBe(true)
    expect(row.classes()).toContain('nav-item-active')
    expect(w.find('[data-menu="settings"] .nav-item').attributes('data-settings-home')).toBe('')
  })

  it("no home: no first row", async () => {
    let settings
    const S = defineComponent({ setup() { settings = useSettingsMenu(useNavigation()); return () => h(QdSidebarMenus, { settings }) } })
    const router = createTestRouter()
    await router.push('/books')
    const w = mount(S, { global: { plugins: [router], provide: { qdadmOrchestrator: null, qdadmHooks: null } } })
    await flushPromises()
    expect(w.find('[data-settings-home]').exists()).toBe(false)
  })

  it('its page: the entries as cards, by section, as the menu shows them', async () => {
    const router = createTestRouter()
    await router.push('/settings')
    const security = { isGranted: (a) => a !== 'policy:read' }
    const w = mount(QdSettingsHome, {
      global: {
        plugins: [router],
        provide: { qdadmOrchestrator: null, qdadmHooks: null, qdadmSecurityChecker: security, qdadmFeatures: { settingsMenu: { home: true } } },
        stubs: { PageLayout: { props: ['title'], template: '<div><h1>{{ title }}</h1><slot /></div>' } },
      },
    })
    await flushPromises()
    expect(w.find('h1').text()).toBe('Settings')
    expect(w.findAll('.qd-settings-home-title').map((t) => t.text())).toEqual(['Access', 'Security'])
    expect(w.findAll('.qd-settings-home-card').map((c) => c.text())).toEqual(['Groups', 'Own'])
    expect(w.find('.qd-settings-home-card').attributes('href')).toBe('/groups')
    expect(w.findAll('.qd-settings-home-section').map((x) => x.attributes('id'))).toEqual(['settings-access', 'settings-security'])
  })
})
