/**
 * EntityTimeline (#4111): one entity's history across actors.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import PrimeVue from 'primevue/config'
import EntityTimeline from '../../src/components/display/EntityTimeline.vue'

const ACTORS = {
  marketplace: { label: 'Marketplace', color: '#7c3aed', icon: 'pi pi-shopping-bag' },
  shop: { label: 'Shop', color: '#2563eb', icon: 'pi pi-shop' },
  carrier: { label: 'Carrier', color: '#16a34a', icon: 'pi pi-truck' },
}

const EVENTS = [
  { id: 3, at: '2026-10-18T09:00:00Z', actor: 'carrier', title: 'Label requested', kind: 'label' },
  { id: 1, at: '2026-10-17T15:00:00Z', actor: 'marketplace', title: 'Order injected', kind: 'injected' },
  { id: 2, at: '2026-10-17T15:02:30Z', actor: 'shop', title: 'Order imported', kind: 'imported' },
  { id: 4, at: '2026-10-18T08:00:00Z', actor: 'shop', title: 'Ready to ship', kind: 'ready' },
]

function titles(wrapper) {
  return wrapper.findAll('.qd-timeline-title').map((e) => e.text())
}

function mountTimeline(props = {}, { slots, provide, router } = {}) {
  return mount(EntityTimeline, {
    props: { actors: ACTORS, ...props },
    slots,
    global: { plugins: [PrimeVue, ...(router ? [router] : [])], directives: { tooltip: {} }, provide },
  })
}

describe('EntityTimeline (#4111)', () => {
  it('orders events by time, with a separator per day', () => {
    const wrapper = mountTimeline({ events: EVENTS })
    expect(titles(wrapper)).toEqual(['Order injected', 'Order imported', 'Ready to ship', 'Label requested'])
    expect(wrapper.findAll('.qd-timeline-day')).toHaveLength(2)
    expect(wrapper.find('.qd-timeline-event').attributes('style')).toContain('#7c3aed')
  })

  it('flips the order from the toolbar', async () => {
    const wrapper = mountTimeline({ events: EVENTS })
    await wrapper.find('.qd-timeline-order').trigger('click')
    expect(titles(wrapper)[0]).toBe('Label requested')
  })

  it('hides an actor, and keeps the filter in the URL when asked', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
    await router.push('/')
    const wrapper = mountTimeline({ events: EVENTS, queryKey: 'hide' }, { router })

    const shop = wrapper.findAll('.qd-timeline-chip').find((c) => c.text() === 'Shop')
    await shop.trigger('click')
    await flushPromises()
    expect(titles(wrapper)).toEqual(['Order injected', 'Label requested'])
    expect(router.currentRoute.value.query.hide).toBe('shop')

    const again = mountTimeline({ events: EVENTS, queryKey: 'hide' }, { router })
    expect(titles(again)).toEqual(['Order injected', 'Label requested'])
  })

  it('shows the time since the previous event, and named durations', () => {
    const wrapper = mountTimeline({ events: EVENTS, gaps: true })
    // Under a day separator the gap is left out: the date says it.
    expect(wrapper.findAll('.qd-timeline-since').map((e) => e.text())).toEqual(['+2 min 30 s', '+1 h'])

    // Newest first: each gap still reads from the row above it, and the
    // first event of a day carries none, so nothing sits over the date (#4147).
    const desc = mountTimeline({ events: EVENTS, gaps: true, order: 'desc' })
    const rows = desc.findAll('.qd-timeline-list > li').map((li) =>
      li.classes('qd-timeline-day') ? 'day' : `${li.find('.qd-timeline-title').text()}${li.find('.qd-timeline-since').exists() ? ` ${li.find('.qd-timeline-since').text()}` : ''}`
    )
    expect(rows).toEqual(['day', 'Label requested', 'Ready to ship +1 h', 'day', 'Order imported', 'Order injected +2 min 30 s'])

    const named = mountTimeline({
      events: EVENTS,
      gaps: [
        { label: 'order → ready to ship', from: (e) => e.kind === 'imported', to: (e) => e.kind === 'ready' },
        { label: 'never', from: (e) => e.kind === 'refund', to: () => true },
      ],
    })
    expect(named.findAll('.qd-timeline-gap-chip').map((e) => e.text())).toEqual([
      'order → ready to ship: 16 h 57 min',
      'never: —',
    ])
  })

  it('expands an event into the detail slot', async () => {
    const wrapper = mountTimeline(
      { events: EVENTS },
      { slots: { detail: ({ event }) => h('pre', { class: 'payload' }, `kind=${event.kind}`) } }
    )
    expect(wrapper.find('.payload').exists()).toBe(false)
    await wrapper.findAll('button.qd-timeline-head')[1].trigger('click')
    expect(wrapper.find('.payload').text()).toBe('kind=imported')
  })

  it('is not clickable without a detail slot', () => {
    const wrapper = mountTimeline({ events: EVENTS })
    expect(wrapper.find('button.qd-timeline-head').exists()).toBe(false)
  })

  it('maps app events of its own shape', () => {
    const wrapper = mountTimeline({
      events: [{ ts: 1760000000000, who: 'shop', what: 'Shipped' }],
      map: (e) => ({ at: e.ts, actor: e.who, title: e.what }),
    })
    expect(titles(wrapper)).toEqual(['Shipped'])
    expect(wrapper.find('.qd-timeline-actor').text()).toBe('Shop')
  })

  it('reads a source through its manager, rereads on a remote change, and flashes what is new', async () => {
    const rows = [EVENTS[1], EVENTS[2]]
    const manager = { list: vi.fn(async () => ({ items: [...rows] })) }
    const handlers = {}
    const signals = {
      on: (name, fn) => ((handlers[name] = fn), () => delete handlers[name]),
    }
    const wrapper = mountTimeline(
      { source: { entity: 'order_events', filters: { order_id: 7 } } },
      { provide: { qdadmOrchestrator: { get: () => manager }, qdadmSignals: signals } }
    )
    await flushPromises()
    expect(manager.list).toHaveBeenCalledWith({ filters: { order_id: 7 }, page_size: 500 })
    expect(titles(wrapper)).toEqual(['Order injected', 'Order imported'])
    expect(wrapper.find('.qd-timeline-event--fresh').exists()).toBe(false)

    rows.push(EVENTS[3])
    vi.useFakeTimers()
    handlers['entity:data-invalidate']?.({ data: { entity: 'order_events', action: 'updated', source: 'remote' } })
    await vi.advanceTimersByTimeAsync(400)
    vi.useRealTimers()
    await flushPromises()
    expect(titles(wrapper)).toEqual(['Order injected', 'Order imported', 'Ready to ship'])
    expect(wrapper.findAll('.qd-timeline-event--fresh').map((e) => e.find('.qd-timeline-title').text())).toEqual(['Ready to ship'])
  })
})
