/**
 * Nav entries that point out of the app (#3675).
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import DefaultMenu from '../../src/components/layout/defaults/DefaultMenu.vue'
import { useNavigation } from '../../src/composables/useNavigation'
import { registry, resetRegistry } from '../../src/module/moduleRegistry'

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/users', name: 'users', component: { template: '<div />' } },
    ],
  })
}

async function mountMenu({ security = null } = {}) {
  const router = createTestRouter()
  await router.push('/')
  let nav
  const wrapper = mount(
    {
      components: { DefaultMenu },
      template: '<DefaultMenu />',
      setup() {
        nav = useNavigation()
        return {}
      },
    },
    {
      global: {
        plugins: [router],
        provide: { qdadmOrchestrator: null, qdadmHooks: null, ...(security ? { qdadmSecurityChecker: security } : {}) },
      },
    }
  )
  await flushPromises()
  return { wrapper, nav }
}

describe('a nav entry with href (#3675)', () => {
  beforeEach(() => resetRegistry())

  it('needs exactly one of route and href', () => {
    expect(() => registry.addNavItem({ section: 'Admin', label: 'Nothing' })).toThrow(/exactly one of route and href/)
    expect(() => registry.addNavItem({ section: 'Admin', label: 'Both', route: 'users', href: 'https://x.test' })).toThrow(/exactly one/)
  })

  it('renders an <a> in its section that opens an absolute URL in a new tab', async () => {
    registry.addNavItem({ section: 'Admin', route: 'users', label: 'Users' })
    registry.addNavItem({ section: 'Admin', label: 'BI (Metabase)', icon: 'pi pi-chart-bar', href: 'https://bi.example.test' })
    const { wrapper } = await mountMenu()

    const links = wrapper.findAll('.nav-section-items .nav-item')
    expect(links.map((l) => l.text())).toEqual(['Users', 'BI (Metabase)'])
    const a = wrapper.find('a.nav-item-link')
    expect(a.attributes()).toMatchObject({ href: 'https://bi.example.test', target: '_blank', rel: 'noopener noreferrer' })
    expect(a.find('.nav-item-external').exists()).toBe(true)
  })

  it('keeps a relative href in the same tab, and honours an explicit target', async () => {
    registry.addNavItem({ section: 'Tools', label: 'Status', href: '/status' })
    registry.addNavItem({ section: 'Tools', label: 'Munin', href: 'https://munin.example.test', target: 'munin' })
    const { wrapper } = await mountMenu()

    const [status, munin] = wrapper.findAll('a.nav-item-link')
    expect(status.attributes('target')).toBeUndefined()
    expect(status.attributes('rel')).toBeUndefined()
    expect(status.find('.nav-item-external').exists()).toBe(false)
    expect(munin.attributes('target')).toBe('munin')
    expect(munin.find('.nav-item-external').exists()).toBe(false)
  })

  it('is never active and leaves its click to the browser', async () => {
    registry.addNavItem({ section: 'Admin', label: 'Home', href: '/', exact: true })
    const { nav } = await mountMenu()
    const item = nav.navSections.value[0].items[0]
    expect(nav.isNavActive(item)).toBe(false)
    const event = { preventDefault: () => { throw new Error('intercepted') } }
    expect(() => nav.handleNavClick(event, item)).not.toThrow()
  })

  it('is hidden from whoever is not granted its permission', async () => {
    registry.addNavItem({ section: 'Admin', label: 'Adminer', href: 'https://db.example.test', permission: 'tools:adminer' })
    const denied = await mountMenu({ security: { isGranted: () => false } })
    expect(denied.wrapper.find('a.nav-item-link').exists()).toBe(false)

    const granted = await mountMenu({ security: { isGranted: (attr) => attr === 'tools:adminer' } })
    expect(granted.wrapper.find('a.nav-item-link').exists()).toBe(true)
  })
})
