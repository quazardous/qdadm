/**
 * CardsDashboard (#4320): a zone's blocks as cards the user arranges in edit
 * mode (keyboard moves, pin, hide, restore, reset), saved per user.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import CardsDashboard from '../../src/components/layout/CardsDashboard.vue'
import DashboardLayout from '../../src/components/layout/DashboardLayout.vue'
import Zone from '../../src/components/layout/Zone.vue'
import { ZoneRegistry } from '../../src/zones/ZoneRegistry'
import { DASHBOARD_ZONES } from '../../src/zones/zones'

const Card = (label) => defineComponent({ name: `Card${label}`, render: () => h('div', { class: 'body' }, label) })
const KEY = `qdadm.dashboard.${DASHBOARD_ZONES.WIDGETS}.bob`

function makeRegistry() {
  const registry = new ZoneRegistry()
  registry.defineZone(DASHBOARD_ZONES.WIDGETS)
  registry.registerBlock(DASHBOARD_ZONES.WIDGETS, { id: 'sales', component: Card('Sales'), weight: 10, card: { title: 'Sales', required: true, span: 2 } })
  registry.registerBlock(DASHBOARD_ZONES.WIDGETS, { id: 'stock', component: Card('Stock'), weight: 20, card: { title: 'Stock' } })
  registry.registerBlock(DASHBOARD_ZONES.WIDGETS, { id: 'news', component: Card('News'), weight: 30, card: { title: 'News', fixed: true } })
  registry.registerBlock(DASHBOARD_ZONES.WIDGETS, { id: 'alerts', component: Card('Alerts'), weight: 40, card: { title: 'Alerts', pinned: true } })
  return registry
}

let wrapper
function mountDashboard(props = {}) {
  wrapper = mount(CardsDashboard, {
    props,
    attachTo: document.body,
    global: {
      provide: {
        qdadmZoneRegistry: makeRegistry(),
        qdadmFeatures: { auth: true },
        authAdapter: { user: { username: 'bob' }, isAuthenticated: () => true, login: async () => ({}), logout() {}, getCurrentUser: async () => null },
      },
      stubs: {
        QdButton: {
          inheritAttrs: false,
          props: ['label'],
          emits: ['click'],
          template: '<button v-bind="$attrs" @click="$emit(\'click\')">{{ label }}</button>',
        },
      },
    },
  })
  return wrapper
}

const order = (w) => w.findAll('.qd-cards-slot').map((s) => s.attributes('data-card-id'))
const slot = (w, id) => w.find(`[data-card-id="${id}"]`)
const button = (w, text) => w.findAll('button').find((b) => b.text() === text)
const status = (w) => w.find('[role=status]').text()

beforeEach(() => localStorage.clear())
afterEach(() => wrapper?.unmount())

describe('CardsDashboard (#4320)', () => {
  it('renders the cards, pinned first, with no edit controls outside edit mode', () => {
    const w = mountDashboard()
    expect(order(w)).toEqual(['alerts', 'sales', 'stock', 'news'])
    expect(slot(w, 'sales').attributes('style')).toContain('--qd-card-span: 2')
    expect(w.find('.qd-cards-bar').exists()).toBe(false)
    expect(button(w, 'Customise')).toBeTruthy()
  })

  it('in edit mode: no hide on a required card, no handle or pin on a fixed one', async () => {
    const w = mountDashboard()
    await button(w, 'Customise').trigger('click')
    expect(slot(w, 'sales').find('[aria-label="Hide Sales"]').exists()).toBe(false)
    expect(slot(w, 'stock').find('[aria-label="Hide Stock"]').exists()).toBe(true)
    expect(slot(w, 'news').find('.qd-cards-handle').exists()).toBe(false)
    expect(slot(w, 'news').find('[aria-pressed]').exists()).toBe(false)
  })

  it('moves a card with the keyboard, keeps focus on it, announces and saves', async () => {
    const w = mountDashboard()
    await button(w, 'Customise').trigger('click')
    const handle = slot(w, 'stock').find('.qd-cards-handle')
    handle.element.focus()
    await handle.trigger('keydown', { key: 'ArrowUp' })
    await flushPromises()
    expect(order(w)).toEqual(['alerts', 'stock', 'sales', 'news'])
    expect(document.activeElement).toBe(slot(w, 'stock').find('.qd-cards-handle').element)
    expect(status(w)).toBe('Stock: card 1 of 3')
    expect(JSON.parse(localStorage.getItem(KEY)).order.indexOf('stock')).toBeLessThan(JSON.parse(localStorage.getItem(KEY)).order.indexOf('sales'))
    // End: the last place, but the fixed card keeps its index (the last one)
    await slot(w, 'stock').find('.qd-cards-handle').trigger('keydown', { key: 'End' })
    await flushPromises()
    expect(order(w)).toEqual(['alerts', 'sales', 'stock', 'news'])
  })

  it('hides a card to the tray and restores it in place', async () => {
    const w = mountDashboard()
    await button(w, 'Customise').trigger('click')
    await slot(w, 'stock').find('[aria-label="Hide Stock"]').trigger('click')
    await flushPromises()
    expect(order(w)).toEqual(['alerts', 'sales', 'news'])
    expect(status(w)).toBe('Stock hidden')
    const chip = w.find('.qd-cards-tray [aria-label="Show Stock"]')
    expect(chip.exists()).toBe(true)
    await chip.trigger('click')
    await flushPromises()
    expect(order(w)).toEqual(['alerts', 'sales', 'stock', 'news'])
  })

  it('pins and unpins; reset brings the default back and clears storage', async () => {
    const w = mountDashboard()
    await button(w, 'Customise').trigger('click')
    await slot(w, 'stock').find('[aria-label="Pin Stock at the top"]').trigger('click')
    await flushPromises()
    expect(order(w)).toEqual(['alerts', 'stock', 'sales', 'news'])
    expect(slot(w, 'stock').find('[aria-pressed="true"]').exists()).toBe(true)
    await button(w, 'Reset').trigger('click')
    await flushPromises()
    expect(order(w)).toEqual(['alerts', 'sales', 'stock', 'news'])
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(status(w)).toBe('Default arrangement restored')
  })

  it('reads the saved arrangement back on the next mount', async () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, order: ['news', 'stock', 'sales', 'alerts'], hidden: ['stock'], pinned: [] }))
    const w = mountDashboard()
    // news is fixed: back at its default index in the full order (stock, hidden,
    // still counts); alerts stays unpinned, as the user left it
    expect(order(w)).toEqual(['sales', 'news', 'alerts'])
  })

  it('one block serves both: a classic Zone ignores `card`; a block without `card` is a card titled by its prop', async () => {
    const registry = makeRegistry()
    registry.registerBlock(DASHBOARD_ZONES.WIDGETS, { id: 'plain', component: Card('Plain'), weight: 50, props: { title: 'Plain card' } })
    const classic = mount(Zone, { props: { name: DASHBOARD_ZONES.WIDGETS }, global: { provide: { qdadmZoneRegistry: registry } } })
    expect(classic.findAll('.body').map((b) => b.text())).toEqual(['Sales', 'Stock', 'News', 'Alerts', 'Plain'])
    classic.unmount()

    wrapper = mount(CardsDashboard, {
      global: { provide: { qdadmZoneRegistry: registry }, stubs: { QdButton: { props: ['label'], emits: ['click'], template: '<button @click="$emit(\'click\')">{{ label }}</button>' } } },
    })
    expect(order(wrapper)).toContain('plain')
    await button(wrapper, 'Customise').trigger('click')
    expect(slot(wrapper, 'plain').find('.qd-cards-title').text()).toBe('Plain card')
    expect(slot(wrapper, 'plain').find('[aria-label="Hide Plain card"]').exists()).toBe(true)
  })

  it('DashboardLayout customizable renders the widgets zone as cards', () => {
    wrapper = mount(DashboardLayout, {
      props: { customizable: true },
      global: {
        provide: { qdadmZoneRegistry: makeRegistry() },
        stubs: { BaseLayout: { template: '<div><slot name="main" /></div>' }, Zone: true, QdButton: true },
      },
    })
    expect(wrapper.find('.qd-cards-dashboard').exists()).toBe(true)
    expect(wrapper.findAll('.qd-cards-slot')).toHaveLength(4)
  })
})
