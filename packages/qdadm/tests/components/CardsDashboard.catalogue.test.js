/**
 * CardsDashboard (#5348): the catalogue to add a card with its parameters,
 * several of one, the size each person picks, named sections.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import CardsDashboard from '../../src/components/layout/CardsDashboard.vue'
import Zone from '../../src/components/layout/Zone.vue'
import { ZoneRegistry } from '../../src/zones/ZoneRegistry'
import { DASHBOARD_ZONES } from '../../src/zones/zones'
import { resetDashboards } from '../../src/dashboard/dashboardConfig'

const Card = (label) => defineComponent({ name: `Card${label}`, render: () => h('div', { class: 'body' }, label) })
const Search = defineComponent({
  name: 'SearchCard',
  props: { genre: String, max: Number },
  render() {
    return h('div', { class: 'body search-body' }, `${this.genre} · ${this.max ?? 'all'}`)
  },
})
const KEY = `qdadm.dashboard.${DASHBOARD_ZONES.WIDGETS}.bob`

function makeRegistry() {
  const registry = new ZoneRegistry()
  registry.defineZone(DASHBOARD_ZONES.WIDGETS)
  registry.registerBlock(DASHBOARD_ZONES.WIDGETS, { id: 'sales', component: Card('Sales'), weight: 10, card: { title: 'Sales', sizes: ['s', 'm'] } })
  registry.registerBlock(DASHBOARD_ZONES.WIDGETS, { id: 'stock', component: Card('Stock'), weight: 20, card: { title: 'Stock' } })
  registry.registerBlock(DASHBOARD_ZONES.WIDGETS, {
    id: 'search',
    component: Search,
    weight: 30,
    card: {
      title: 'Saved search',
      description: 'Books of one genre',
      repeatable: true,
      params: {
        type: 'object',
        required: ['genre'],
        properties: {
          genre: { type: 'string', title: 'Genre', enum: ['sci-fi', 'fantasy'], enumLabels: { 'sci-fi': 'Science fiction', fantasy: 'Fantasy' } },
          max: { type: 'integer', title: 'At most', minimum: 1, description: 'How many books to show' },
        },
      },
    },
  })
  return registry
}

let wrapper
function mountDashboard(registry = makeRegistry(), component = CardsDashboard) {
  wrapper = mount(component, {
    props: component === Zone ? { name: DASHBOARD_ZONES.WIDGETS } : {},
    attachTo: document.body,
    global: {
      provide: {
        qdadmZoneRegistry: registry,
        qdadmFeatures: { auth: true },
        authAdapter: { user: { username: 'bob' }, isAuthenticated: () => true, login: async () => ({}), logout() {}, getCurrentUser: async () => null },
      },
      stubs: {
        QdButton: {
          inheritAttrs: false,
          props: ['label', 'loading', 'type'],
          emits: ['click'],
          template: '<button v-bind="$attrs" :type="type || \'button\'" @click="$emit(\'click\')">{{ label }}</button>',
        },
      },
    },
  })
  return wrapper
}

const order = (w) => w.findAll('.qd-cards-slot[data-card-id]').map((s) => s.attributes('data-card-id'))
const button = (w, text) => w.findAll('button').find((b) => b.text() === text)
const status = (w) => w.find('[role=status]').text()

async function addSearch(w, genre, max) {
  await button(w, 'Add a card').trigger('click')
  await w.find('[data-catalogue-card="search"] button').trigger('click')
  const form = w.find('.qd-cards-catalogue form')
  await form.find('select').setValue(genre)
  if (max !== undefined) await form.find('input[type=number]').setValue(String(max))
  await form.trigger('submit')
  await flushPromises()
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  wrapper?.unmount()
  resetDashboards()
})

describe('CardsDashboard: the catalogue (#5348)', () => {
  it('a repeatable block is not shown, by the dashboard nor by a classic Zone', async () => {
    const w = mountDashboard()
    expect(order(w)).toEqual(['sales', 'stock'])
    w.unmount()
    const z = mountDashboard(makeRegistry(), Zone)
    expect(z.text()).not.toContain('undefined')
    expect(z.findAll('.search-body').length).toBe(0)
  })

  it('lists the cards to add with their description, and the hidden ones', async () => {
    const w = mountDashboard()
    await button(w, 'Customise').trigger('click')
    await w.find('[data-card-id="stock"] [aria-label="Hide Stock"]').trigger('click')
    await button(w, 'Add a card').trigger('click')
    const catalogue = w.find('.qd-cards-catalogue')
    expect(catalogue.find('[data-catalogue-card="search"]').text()).toContain('Books of one genre')
    expect(catalogue.find('[data-catalogue-hidden="stock"]').exists()).toBe(true)
    await catalogue.find('[data-catalogue-hidden="stock"] button').trigger('click')
    expect(order(w)).toContain('stock')
  })

  it('the form asks for what is required, then adds the card with its parameters, twice over', async () => {
    const w = mountDashboard()
    await button(w, 'Customise').trigger('click')
    await button(w, 'Add a card').trigger('click')
    await w.find('[data-catalogue-card="search"] button').trigger('click')
    const form = w.find('.qd-cards-catalogue form')
    // Labels, help and the choice's own words
    expect(form.text()).toContain('Genre')
    expect(form.text()).toContain('How many books to show')
    expect(form.find('select').text()).toContain('Science fiction')
    await form.trigger('submit')
    await flushPromises()
    expect(form.find('.qd-card-params-error').text()).toBe('Fill this in')
    expect(form.find('select').attributes('aria-invalid')).toBe('true')
    expect(order(w)).toEqual(['sales', 'stock'])

    await form.find('select').setValue('sci-fi')
    await form.find('input[type=number]').setValue('3')
    await form.trigger('submit')
    await flushPromises()
    expect(w.find('.qd-cards-catalogue').exists()).toBe(false)
    expect(status(w)).toBe('Saved search added')
    expect(w.findAll('.search-body').map((b) => b.text())).toEqual(['sci-fi · 3'])

    await addSearch(w, 'fantasy')
    expect(w.findAll('.search-body').map((b) => b.text())).toEqual(['sci-fi · 3', 'fantasy · all'])
    await button(w, 'Done').trigger('click')
    await flushPromises()
    const saved = JSON.parse(localStorage.getItem(KEY))
    expect(saved.instances.map((i) => i.params)).toEqual([{ genre: 'sci-fi', max: 3 }, { genre: 'fantasy' }])
  })

  it('an added card is removed for good', async () => {
    const w = mountDashboard()
    await button(w, 'Customise').trigger('click')
    await addSearch(w, 'fantasy')
    const id = order(w).find((x) => x.startsWith('search~'))
    await w.find(`[data-card-id="${id}"] .qd-cards-remove`).trigger('click')
    expect(order(w)).toEqual(['sales', 'stock'])
    expect(status(w)).toBe('Saved search removed')
  })
})

describe('CardsDashboard: size and sections (#5348)', () => {
  it('a card takes the size its person picks, among the ones it allows', async () => {
    const w = mountDashboard()
    await button(w, 'Customise').trigger('click')
    const select = w.find('[data-card-id="sales"] .qd-cards-size')
    expect(select.findAll('option').map((o) => o.text())).toEqual(['Small', 'Medium'])
    await select.setValue('m')
    expect(w.find('[data-card-id="sales"]').attributes('style')).toContain('--qd-card-span: 2')
    expect(status(w)).toBe('Sales: Medium')
  })

  it('sections: added, named, a card moved to one, removed', async () => {
    const w = mountDashboard()
    await button(w, 'Customise').trigger('click')
    expect(w.findAll('.qd-cards-section-head').length).toBe(0)
    await button(w, 'Add a section').trigger('click')
    await flushPromises()
    // The first section takes every card, the new one is there to fill
    const heads = w.findAll('.qd-cards-section-input')
    expect(heads.map((h) => h.element.value)).toEqual(['Main', 'New section'])
    await heads[1].setValue('Stock room')
    await heads[1].trigger('change')

    const select = w.find('[data-card-id="stock"] .qd-cards-section')
    const target = select.findAll('option').find((o) => o.text() === 'Stock room').element.value
    await select.setValue(target)
    const groups = w.findAll('.qd-cards-group').map((g) => g.findAll('[data-card-id]').map((s) => s.attributes('data-card-id')))
    expect(groups).toEqual([['sales'], ['stock']])
    expect(status(w)).toBe('Stock moved to Stock room')

    await button(w, 'Done').trigger('click')
    await flushPromises()
    expect(w.findAll('.qd-cards-section-title').map((t) => t.text())).toEqual(['Main', 'Stock room'])

    await button(w, 'Customise').trigger('click')
    await w.find('[aria-label="Remove the section Stock room"]').trigger('click')
    expect(w.findAll('.qd-cards-group').map((g) => g.findAll('[data-card-id]').map((s) => s.attributes('data-card-id')))).toEqual([['sales', 'stock']])
  })
})
