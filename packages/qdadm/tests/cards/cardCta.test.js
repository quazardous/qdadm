/**
 * Every card's CTA zone (#5405): `links` beside the action, a `#cta` slot
 * instead of them, and a dashboard block's `card.links` reaching the card.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { QdCardView } from '../../src/cards/index'
import QdCardBlockScope from '../../src/cards/QdCardBlockScope.vue'

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] })
const metric = { value: 3 }

describe('the CTA zone (#5405)', () => {
  it('links beside the action: a route is a link, a gesture a button', async () => {
    const onClick = vi.fn()
    const w = mount(QdCardView, {
      props: { type: 'metric', data: metric, envelope: { title: 'T', action: { verb: 'Go', to: '/go' }, links: [{ label: 'See all', to: '/all' }, { label: 'Refresh', onClick }] } },
      global: { plugins: [router] },
    })
    const links = w.findAll('[data-card-cta] [data-card-link]')
    expect(links.map((l) => l.text())).toEqual(['See all', 'Refresh'])
    expect(links[0].element.tagName).toBe('A')
    await links[1].trigger('click')
    expect(onClick).toHaveBeenCalled()
    expect(w.find('.qd-card-action').exists()).toBe(true)
  })

  it('the #cta slot adds the app\'s own buttons, between the links and the action', () => {
    const w = mount(QdCardView, {
      props: { type: 'metric', data: metric, envelope: { title: 'T', action: { verb: 'Go', to: '/go' }, links: [{ label: 'x', to: '/x' }] } },
      slots: { cta: () => h('button', { class: 'mine' }, 'Mine') },
      global: { plugins: [router] },
    })
    const zone = w.find('[data-card-cta]')
    expect([...zone.element.children].map((e) => e.className.split(' ')[0])).toEqual(['qd-card-link', 'mine', 'qd-card-action'])
  })

  it("a block's card.links reach the card it draws, after its own", () => {
    const Block = defineComponent({ setup: () => () => h(QdCardView, { type: 'metric', data: metric, envelope: { title: 'T', links: [{ label: 'Own', to: '/own' }] } }) })
    const w = mount(QdCardBlockScope, { props: { links: [{ label: 'From the block', to: '/b' }] }, slots: { default: () => h(Block) }, global: { plugins: [router] } })
    expect(w.findAll('[data-card-link]').map((l) => l.text())).toEqual(['Own', 'From the block'])
  })

  it('no links, no action, no source: no foot', () => {
    const w = mount(QdCardView, { props: { type: 'metric', data: metric, envelope: { title: 'T' } }, global: { plugins: [router] } })
    expect(w.find('.qd-card-foot').exists()).toBe(false)
  })
})

describe('a CTA label too long for the card (#5413)', () => {
  it('sits in a span that can be cut, the whole label in title and aria-label', () => {
    const verb = 'Sort the 8 new unhandled errors now'
    const w = mount(QdCardView, {
      props: { type: 'metric', data: metric, envelope: { title: 'T', action: { verb, to: '/go' }, links: [{ label: 'See all of them', icon: 'pi pi-list', to: '/all' }] } },
      global: { plugins: [router] },
    })
    const action = w.find('.qd-card-action')
    expect(action.attributes('title')).toBe(verb)
    expect(action.attributes('aria-label')).toBe(verb)
    expect(action.find('.qd-card-cta-label').text()).toBe(verb)
    const link = w.find('[data-card-link]')
    expect(link.attributes('title')).toBe('See all of them')
    expect(link.attributes('aria-label')).toBe('See all of them')
    expect(link.find('.qd-card-cta-label').text()).toBe('See all of them')
  })
})
