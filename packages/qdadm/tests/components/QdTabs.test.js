/**
 * QdTabs (#5398): tabs on a page of the app's own, over PrimeVue's Tabs. The
 * current tab is in the address, a badge per tab, a tab the user may not see
 * is not drawn, a panel mounts when first opened and stays.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import PrimeVue from 'primevue/config'
import { QdTabs } from '../../src/components/index'

// PrimeVue's TabList measures itself
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const Page = defineComponent({ setup: () => () => h('div') })
let mounts

const TABS = [
  { key: 'profile', label: 'Profile', icon: 'pi pi-user' },
  { key: 'groups', label: 'Groups', badge: 3 },
  { key: 'audit', label: 'Audit', permission: 'audit:read' },
  { key: 'alerts', label: 'Alerts', badge: { count: 2, tone: 'critical' } },
]

async function mountTabs(path = '/profile', props = {}, granted = () => true) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/profile', component: Page }] })
  await router.push(path)
  mounts = {}
  // Counts its own mounts, not the slot's renders
  const panels = {}
  const slot = (key) => {
    panels[key] = defineComponent({
      setup() {
        mounts[key] = (mounts[key] ?? 0) + 1
        return () => h('p', { class: `panel-${key}` }, key)
      },
    })
    return () => h(panels[key])
  }
  const w = mount(QdTabs, {
    props: { tabs: TABS, ...props },
    slots: { profile: slot('profile'), groups: slot('groups'), audit: slot('audit'), alerts: slot('alerts') },
    attachTo: document.body,
    global: { plugins: [router, PrimeVue], provide: { qdadmSecurityChecker: { isGranted: granted } } },
  })
  await flushPromises()
  return { w, router }
}

const selected = (w) => w.find('[role="tab"][aria-selected="true"]').attributes('data-tab')

describe('QdTabs (#5398)', () => {
  it('the first tab without ?tab=, the one the address names with it, the first again for an unknown one', async () => {
    expect(selected((await mountTabs()).w)).toBe('profile')
    expect(selected((await mountTabs('/profile?tab=groups')).w)).toBe('groups')
    expect(selected((await mountTabs('/profile?tab=nope')).w)).toBe('profile')
  })

  it('a click puts the tab in the address, without a history entry, keeping the rest of the query', async () => {
    const { w, router } = await mountTabs('/profile?q=x')
    const before = window.history.length
    await w.find('[data-tab="groups"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ q: 'x', tab: 'groups' })
    expect(selected(w)).toBe('groups')
    expect(w.emitted('update:modelValue')[0]).toEqual(['groups'])
    // Back on the first tab: no parameter
    await w.find('[data-tab="profile"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ q: 'x' })
    expect(window.history.length).toBe(before)
  })

  it('follows the address when it changes (a link, back)', async () => {
    const { w, router } = await mountTabs()
    await router.replace({ query: { tab: 'alerts' } })
    await flushPromises()
    expect(selected(w)).toBe('alerts')
  })

  it(':query="false" leaves the address alone', async () => {
    const { w, router } = await mountTabs('/profile', { query: false })
    await w.find('[data-tab="groups"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})
    expect(selected(w)).toBe('groups')
  })

  it('a badge per tab, toned, hidden at zero', async () => {
    const { w } = await mountTabs('/profile', { tabs: [...TABS.slice(0, 3), { key: 'alerts', label: 'Alerts', badge: { count: 2, tone: 'critical' } }, { key: 'none', label: 'None', badge: 0 }] })
    expect(w.find('[data-tab="groups"] .qd-badge').text()).toContain('3')
    expect(w.find('[data-tab="alerts"] .qd-badge').classes()).toContain('qd-badge--critical')
    expect(w.find('[data-tab="none"] .qd-badge').exists()).toBe(false)
  })

  it('a tab the user may not see is not drawn, nor reached by the address', async () => {
    const { w } = await mountTabs('/profile?tab=audit', {}, (p) => p !== 'audit:read')
    expect(w.find('[data-tab="audit"]').exists()).toBe(false)
    expect(selected(w)).toBe('profile')
  })

  it('a panel mounts when first opened, then stays', async () => {
    const { w } = await mountTabs()
    expect(mounts).toEqual({ profile: 1 })
    await w.find('[data-tab="groups"]').trigger('click')
    await flushPromises()
    await w.find('[data-tab="profile"]').trigger('click')
    await w.find('[data-tab="groups"]').trigger('click')
    await flushPromises()
    expect(mounts).toEqual({ profile: 1, groups: 1 })
    expect(w.find('.panel-audit').exists()).toBe(false)
  })
})
