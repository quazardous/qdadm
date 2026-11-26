/**
 * A domain bar's layout, chosen by the app (#5526), on the dashboards' layout
 * core: the bar profile (new items hidden, at most N), added indicators with
 * their parameters, the bar drawn from a layout, the zone reading
 * features.domainBar.layout(domain), and the shared building blocks.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { registerDomain, getDomain, QdDomainBar, domainLayoutItems, domainBarIndicators, reconcileDomainLayout, reloadDomainBar } from '../../src/domain/index'
import QdDomainBarZone from '../../src/domain/QdDomainBarZone.vue'
import { resetDomains } from '../../src/domain/registry'
import { shownItems, setParams, reconcileLayout, setShown, BAR_PROFILE } from '../../src/composables/useCardsArrangement'
import QdLayoutOrder from '../../src/components/layout/QdLayoutOrder.vue'
import QdLayoutCatalogue from '../../src/components/layout/QdLayoutCatalogue.vue'
// The built-in card types (metric…), as the app has them
import '../../src/cards/index'

const Page = defineComponent({ setup: () => () => h('div') })
const TYPE_PARAMS = { type: 'object', required: ['type'], properties: { type: { type: 'string', title: 'Type', enum: ['bug', 'feature'] } } }

function library(extra = {}) {
  registerDomain('library', {
    label: 'Library',
    indicators: [
      { id: 'toCheck', card: 'metric', title: 'To check', data: { value: 5 } },
      { id: 'onLoan', card: 'metric', title: 'On loan', data: { value: 2 } },
      { id: 'read', card: 'metric', title: 'Read', data: { value: 1 } },
      { id: 'byType', card: 'metric', title: (d, p) => `Type ${p?.type}`, repeatable: true, params: TYPE_PARAMS, load: (p) => ({ value: p?.type === 'bug' ? 7 : 3 }) },
    ],
    ...extra,
  }, 'library')
  return getDomain('library')
}

async function mountBar(layout) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/board', name: 'board', component: Page, meta: { module: 'library' } }] })
  await router.push('/board')
  const w = mount(QdDomainBar, { props: { domain: library(), layout }, attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return w
}
const pills = (w) => w.findAll('[data-indicator]').map((p) => p.attributes('data-indicator'))

beforeEach(() => {
  resetDomains()
  localStorage.clear()
})

describe('the layout core, with the bar profile (#5526)', () => {
  it('a new item waits hidden; the dashboards keep showing theirs', () => {
    const items = domainLayoutItems(library())
    const saved = { v: 2, order: ['onLoan'], hidden: [], pinned: [], sizes: {}, sections: [], sectionOf: {}, instances: [] }
    const bar = reconcileLayout(saved, items, BAR_PROFILE)
    expect(shownItems(bar, items).map((c) => c.id)).toEqual(['onLoan'])
    expect(bar.hidden.sort()).toEqual(['read', 'toCheck'])
    const board = reconcileLayout(saved, items)
    expect(shownItems(board, items).map((c) => c.id)).toEqual(['toCheck', 'onLoan', 'read'])
  })

  it('at most N shown; setShown; an added item\'s parameters changed only when they fit', () => {
    const items = domainLayoutItems(library())
    let l = reconcileDomainLayout({ v: 2, order: ['toCheck', 'onLoan', 'read'], instances: [{ id: 'byType~a', block: 'byType', params: { type: 'bug' } }] }, library())
    expect(shownItems(l, items, 2).map((c) => c.id)).toEqual(['toCheck', 'onLoan'])
    l = setShown(l, items, 'onLoan', false)
    expect(shownItems(l, items).map((c) => c.id)).toEqual(['toCheck', 'read', 'byType~a'])
    expect(setParams(l, items, 'byType~a', { type: 'nope' })).toBe(l)
    expect(setParams(l, items, 'byType~a', { type: 'feature' }).instances[0].params).toEqual({ type: 'feature' })
  })
})

describe('the bar drawn from a layout (#5526)', () => {
  it('no layout: the declared indicators, the repeatable one left out', async () => {
    const w = await mountBar(undefined)
    expect(pills(w)).toEqual(['toCheck', 'onLoan', 'read'])
  })

  it('a layout: its order, its hidden ones out, an added one with its parameters', async () => {
    const w = await mountBar({ v: 2, order: ['read', 'byType~a', 'toCheck'], hidden: ['toCheck'], instances: [{ id: 'byType~a', block: 'byType', params: { type: 'bug' } }] })
    expect(pills(w)).toEqual(['read', 'byType~a'])
    const added = w.find('[data-indicator="byType~a"]')
    expect(added.text()).toContain('Type bug')
    expect(added.text()).toContain('7')
  })

  it('at most maxCards', async () => {
    const d = library({ maxCards: 1 })
    expect(domainBarIndicators(d, { v: 2, order: ['onLoan', 'read'] }).shown).toEqual(['onLoan'])
  })
})

describe('the zone reads features.domainBar.layout (#5526)', () => {
  async function mountZone(layout) {
    library()
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/board', name: 'board', component: Page, meta: { module: 'library' } }] })
    await router.push('/board')
    const w = mount(QdDomainBarZone, { attachTo: document.body, global: { plugins: [router], provide: { qdadmFeatures: { domainBar: { layout } } } } })
    await flushPromises()
    return w
  }

  it('sync, promise, null', async () => {
    const w1 = await mountZone(() => ({ v: 2, order: ['read'], hidden: ['toCheck', 'onLoan'] }))
    expect(pills(w1)).toEqual(['read'])
    w1.unmount()
    const w2 = await mountZone(() => Promise.resolve({ v: 2, order: ['onLoan'], hidden: ['toCheck', 'read'] }))
    expect(pills(w2)).toEqual(['onLoan'])
    w2.unmount()
    const w3 = await mountZone(() => null)
    expect(pills(w3)).toEqual(['toCheck', 'onLoan', 'read'])
    w3.unmount()
  })

  it('reloadDomainBar() reads it again', async () => {
    let saved = { v: 2, order: ['read'], hidden: ['toCheck', 'onLoan'] }
    const source = vi.fn(() => saved)
    const w = await mountZone(source)
    expect(pills(w)).toEqual(['read'])
    saved = { v: 2, order: ['toCheck'], hidden: ['onLoan', 'read'] }
    reloadDomainBar('library')
    await flushPromises()
    expect(pills(w)).toEqual(['toCheck'])
    w.unmount()
  })
})

describe('the building blocks (#5526)', () => {
  const items = () => domainLayoutItems(library())

  it('QdLayoutOrder: the keyboard moves, hide and remove, the count against max', async () => {
    let layout = reconcileDomainLayout({ v: 2, order: ['toCheck', 'onLoan', 'read', 'byType~a'], instances: [{ id: 'byType~a', block: 'byType', params: { type: 'bug' } }] }, library())
    const w = mount(QdLayoutOrder, {
      attachTo: document.body,
      props: { modelValue: layout, items: items(), max: 3, 'onUpdate:modelValue': (v) => { layout = v; w.setProps({ modelValue: v }) } },
    })
    const order = () => w.findAll('[data-layout-item]').map((i) => i.attributes('data-layout-item'))
    expect(order()).toEqual(['toCheck', 'onLoan', 'read', 'byType~a'])
    expect(w.find('.qd-layout-count').text()).toBe('3 of 3 shown')
    expect(w.find('[data-layout-item="byType~a"]').classes()).toContain('qd-layout-item--over')
    await w.find('[data-layout-item="toCheck"] .qd-layout-handle').trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(order()).toEqual(['onLoan', 'toCheck', 'read', 'byType~a'])
    await w.find('[data-layout-item="read"] [data-layout-hide]').trigger('click')
    await nextTick()
    expect(order()).toEqual(['onLoan', 'toCheck', 'byType~a'])
    expect(layout.hidden).toContain('read')
    await w.find('[data-layout-item="byType~a"] [data-layout-remove]').trigger('click')
    await nextTick()
    expect(layout.instances).toEqual([])
    w.unmount()
  })

  it('QdLayoutCatalogue: add with parameters, show a hidden one', async () => {
    const all = items()
    const w = mount(QdLayoutCatalogue, { attachTo: document.body, props: { templates: all.filter((c) => c.card.repeatable), hidden: [all[2]] } })
    await w.find('[data-catalogue-hidden="read"] button').trigger('click')
    expect(w.emitted('restore')[0][0].id).toBe('read')
    await w.find('[data-catalogue-card="byType"] button').trigger('click')
    await nextTick()
    await w.find('select').setValue(w.findAll('select option').find((o) => o.text() === 'bug').element.value)
    await w.find('form').trigger('submit')
    expect(w.emitted('add')[0][0].id).toBe('byType')
    expect(w.emitted('add')[0][1].params).toEqual({ type: 'bug' })
    w.unmount()
  })
})
