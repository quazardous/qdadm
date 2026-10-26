/**
 * CardsDashboard (#4320): a zone's blocks as cards the user arranges in edit
 * mode (keyboard moves, pin, hide, restore, reset), saved per user.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import CardsDashboard from '../../src/components/layout/CardsDashboard.vue'
import DashboardLayout from '../../src/components/layout/DashboardLayout.vue'
import Zone from '../../src/components/layout/Zone.vue'
import { ZoneRegistry } from '../../src/zones/ZoneRegistry'
import { DASHBOARD_ZONES } from '../../src/zones/zones'
import { configureDashboards, resetDashboards } from '../../src/dashboard/dashboardConfig'

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
function mountDashboard(props = {}, provide = {}) {
  wrapper = mount(CardsDashboard, {
    props,
    attachTo: document.body,
    global: {
      provide: {
        ...provide,
        qdadmZoneRegistry: makeRegistry(),
        qdadmFeatures: { auth: true },
        authAdapter: { user: { username: 'bob' }, isAuthenticated: () => true, login: async () => ({}), logout() {}, getCurrentUser: async () => null },
      },
      stubs: {
        QdButton: {
          inheritAttrs: false,
          props: ['label', 'loading'],
          emits: ['click'],
          template: '<button v-bind="$attrs" :data-loading="loading || undefined" @click="$emit(\'click\')">{{ label }}</button>',
        },
      },
    },
  })
  return wrapper
}

const order = (w) => w.findAll('.qd-cards-slot[data-card-id]').map((s) => s.attributes('data-card-id'))
const slot = (w, id) => w.find(`[data-card-id="${id}"]`)
const button = (w, text) => w.findAll('button').find((b) => b.text() === text)
const status = (w) => w.find('[role=status]').text()

beforeEach(() => localStorage.clear())
afterEach(() => {
  wrapper?.unmount()
  resetDashboards()
  vi.useRealTimers()
})

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
    // Saved when the edit ends (#4338), not at each move
    expect(localStorage.getItem(KEY)).toBeNull()
    await button(w, 'Done').trigger('click')
    await flushPromises()
    expect(JSON.parse(localStorage.getItem(KEY)).order.indexOf('stock')).toBeLessThan(JSON.parse(localStorage.getItem(KEY)).order.indexOf('sales'))
    // End: the last place, but the fixed card keeps its index (the last one)
    await button(w, 'Customise').trigger('click')
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

  it('the tray shows hidden cards whole, inert; Compact turns them into chips, remembered per user', async () => {
    const w = mountDashboard()
    await button(w, 'Customise').trigger('click')
    await slot(w, 'stock').find('[aria-label="Hide Stock"]').trigger('click')
    await flushPromises()
    const hidden = w.find('[data-hidden-card-id="stock"]')
    expect(hidden.find('.body').text()).toBe('Stock')
    expect(hidden.find('.qd-cards-hidden-body').attributes()).toHaveProperty('inert')
    expect(w.find('.qd-cards-chips').exists()).toBe(false)

    await w.findAll('.qd-cards-tray-view-option').find((b) => b.text() === 'Compact').trigger('click')
    expect(w.find('[data-hidden-card-id="stock"]').exists()).toBe(false)
    expect(w.find('.qd-cards-chips [aria-label="Show Stock"]').exists()).toBe(true)
    expect(localStorage.getItem(`${KEY}.tray`)).toBe('compact')
    w.unmount()

    const again = mountDashboard()
    await button(again, 'Customise').trigger('click')
    expect(again.find('.qd-cards-chips').exists()).toBe(true)
    // Show restores from either view
    await again.find('.qd-cards-chips [aria-label="Show Stock"]').trigger('click')
    await flushPromises()
    expect(order(again)).toContain('stock')
  })

  it('hiddenView sets the default view', async () => {
    const w = mountDashboard({ hiddenView: 'compact' })
    await button(w, 'Customise').trigger('click')
    expect(w.findAll('.qd-cards-tray-view-option').find((b) => b.text() === 'Compact').attributes('aria-pressed')).toBe('true')
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

/** A server-like storage: answers after `delay` ms, records each save */
function fakeServer(initial = {}, { delay = 50, failLoad = false, failSave = false } = {}) {
  const data = new Map(Object.entries(initial))
  const saves = []
  const later = (fn) => new Promise((resolve, reject) => setTimeout(() => { try { resolve(fn()) } catch (e) { reject(e) } }, delay))
  return {
    data,
    saves,
    failSave,
    load: vi.fn((key) => later(() => { if (failLoad) throw new Error('503'); return data.get(key) ?? null })),
    save: vi.fn(function (key, arrangement) {
      return later(() => {
        if (this.failSave) throw new Error('503')
        saves.push([key, arrangement && JSON.parse(JSON.stringify(arrangement))])
        if (arrangement) data.set(key, JSON.parse(JSON.stringify(arrangement)))
        else data.delete(key)
      })
    }),
  }
}

describe('CardsDashboard storage (#4338)', () => {
  const SAVED = { v: 1, order: ['stock', 'sales', 'news', 'alerts'], hidden: [], pinned: [] }

  it('an answer within the grace: the saved order shows, never the default one', async () => {
    vi.useFakeTimers()
    const server = fakeServer({ [KEY]: SAVED }, { delay: 50 })
    const w = mountDashboard({ storage: server })
    expect(w.find('.qd-cards-grid').classes()).toContain('qd-cards-loading')
    await vi.advanceTimersByTimeAsync(60)
    expect(w.find('.qd-cards-grid').classes()).not.toContain('qd-cards-loading')
    expect(order(w)).toEqual(['stock', 'sales', 'news', 'alerts'])
    expect(server.load).toHaveBeenCalledWith(KEY)
  })

  it('a slow answer: the default order after the grace, then the saved one', async () => {
    vi.useFakeTimers()
    configureDashboards({ storage: fakeServer({ [KEY]: SAVED }, { delay: 600 }), loadGrace: 100 })
    const w = mountDashboard()
    await vi.advanceTimersByTimeAsync(150)
    expect(w.find('.qd-cards-grid').classes()).not.toContain('qd-cards-loading')
    expect(order(w)).toEqual(['alerts', 'sales', 'stock', 'news'])
    await vi.advanceTimersByTimeAsync(500)
    expect(order(w)).toEqual(['stock', 'sales', 'news', 'alerts'])
  })

  it('a failed load keeps the defaults', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountDashboard({ storage: fakeServer({}, { failLoad: true }) })
    await vi.advanceTimersByTimeAsync(100)
    expect(order(w)).toEqual(['alerts', 'sales', 'stock', 'news'])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('an edit saves once, on Done; Done with nothing changed saves nothing; Reset saves null', async () => {
    vi.useFakeTimers()
    const server = fakeServer({}, { delay: 20 })
    const w = mountDashboard({ storage: server })
    await vi.advanceTimersByTimeAsync(30)
    await button(w, 'Customise').trigger('click')
    for (const key of ['ArrowUp', 'ArrowUp', 'End']) {
      await slot(w, 'stock').find('.qd-cards-handle').trigger('keydown', { key })
    }
    await slot(w, 'stock').find('[aria-label="Hide Stock"]').trigger('click')
    expect(server.save).not.toHaveBeenCalled()
    await button(w, 'Done').trigger('click')
    expect(button(w, 'Done').attributes('data-loading')).toBe('true')
    await vi.advanceTimersByTimeAsync(30)
    expect(server.saves).toEqual([[KEY, expect.objectContaining({ hidden: ['stock'] })]])
    expect(button(w, 'Customise')).toBeTruthy()

    await button(w, 'Customise').trigger('click')
    await button(w, 'Done').trigger('click')
    await vi.advanceTimersByTimeAsync(30)
    expect(server.save).toHaveBeenCalledTimes(1)

    await button(w, 'Customise').trigger('click')
    await button(w, 'Reset').trigger('click')
    await vi.advanceTimersByTimeAsync(30)
    expect(server.saves.at(-1)).toEqual([KEY, null])
    expect(order(w)).toEqual(['alerts', 'sales', 'stock', 'news'])
  })

  it('a failed save: a toast, the arrangement as shown, the edit still open', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const toast = { error: vi.fn() }
    const server = fakeServer({}, { delay: 10 })
    server.failSave = true
    const w = mountDashboard({ storage: server }, { qdadmOrchestrator: { toast } })
    await vi.advanceTimersByTimeAsync(20)
    await button(w, 'Customise').trigger('click')
    await slot(w, 'stock').find('[aria-label="Hide Stock"]').trigger('click')
    await button(w, 'Done').trigger('click')
    await vi.advanceTimersByTimeAsync(20)
    expect(toast.error).toHaveBeenCalledWith('Could not save the arrangement', expect.any(String), 'CardsDashboard')
    expect(order(w)).toEqual(['alerts', 'sales', 'news'])
    expect(button(w, 'Done')).toBeTruthy()
    // Back up: Done again saves
    server.failSave = false
    await button(w, 'Done').trigger('click')
    await vi.advanceTimersByTimeAsync(20)
    expect(server.saves).toHaveLength(1)
    warn.mockRestore()
  })

  it('an answer after the user started arranging does not undo it', async () => {
    vi.useFakeTimers()
    const w = mountDashboard({ storage: fakeServer({ [KEY]: SAVED }, { delay: 500 }), loadGrace: 50 })
    await vi.advanceTimersByTimeAsync(60)
    await button(w, 'Customise').trigger('click')
    await slot(w, 'stock').find('[aria-label="Hide Stock"]').trigger('click')
    await vi.advanceTimersByTimeAsync(500)
    expect(order(w)).toEqual(['alerts', 'sales', 'news'])
  })
})
