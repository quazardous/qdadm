/**
 * The other card types (#5355): compare, trend, ranking, split, funnel, heat,
 * agenda, feed. Each says what it reads in words, not only in colour.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { QdCardView, getCard, validateCardData } from '../../src/cards/index'

const LOT5 = ['compare', 'trend', 'ranking', 'split', 'funnel', 'heat', 'agenda', 'feed']

async function card(type, data, options = {}) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] })
  await router.push('/')
  const wrapper = mount(QdCardView, { props: { type, envelope: { title: type }, data, options }, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('the other card types (#5355)', () => {
  it('are registered, and their examples fit their schemas', () => {
    for (const type of LOT5) {
      const def = getCard(type)
      expect(def, type).toBeTruthy()
      expect(validateCardData(def.meta.example.data, def.schema), type).toEqual([])
    }
  })

  it('compare: both values with their labels, the change signed and toned', async () => {
    const w = await card('compare', { now: { value: 11.8, label: 'November' }, then: { value: 13.1, label: 'November 2025' } }, { unit: '%', decimals: 1 })
    expect(w.find('.qd-card-value').text()).toBe('11.8%')
    expect(w.find('.qd-compare-then').text()).toContain('November 2025')
    const delta = w.find('.qd-card-delta')
    expect(delta.text()).toBe('−1.3 core.cards.compare.points')
    expect(delta.classes()).toContain('qd-tone--critical')
    const pct = await card('compare', { now: { value: 120 }, then: { value: 100 } }, { changeAs: 'percent', decimals: 0, higherIs: 'worse' })
    expect(pct.find('.qd-card-delta').text()).toBe('+20 %')
    expect(pct.find('.qd-card-delta').classes()).toContain('qd-tone--critical')
  })

  it('trend: the band, the points outside marked and counted in words', async () => {
    const w = await card('trend', { normal: { low: 20, high: 40 }, series: [{ value: 28 }, { value: 44 }, { value: 30 }, { value: 17 }] })
    expect(w.find('.qd-trend-band').exists()).toBe(true)
    expect(w.findAll('.qd-trend-out').length).toBe(2)
    expect(w.find('.qd-trend-reading').text()).toBe('core.cards.trend.outside')
    const calm = await card('trend', { series: [{ value: 3, low: 1, high: 5 }, { value: 4, low: 1, high: 6 }] })
    expect(calm.find('.qd-trend-reading').text()).toBe('core.cards.trend.within')
  })

  it('ranking: sorted, ranked, cut at maxItems, bars when asked', async () => {
    const w = await card('ranking', { items: [{ label: 'B', value: 97 }, { label: 'A', value: 142, to: '/a' }, { label: 'C', value: 88 }] }, { maxItems: 2, bars: true })
    expect(w.findAll('.qd-ranking-item').map((li) => li.text())).toEqual(['1A142', '2B97'])
    expect(w.find('a.qd-ranking-label').attributes('href')).toBe('/a')
    expect(w.findAll('.qd-ranking-bar').map((b) => b.attributes('style'))).toEqual(['width: 100%;', expect.stringMatching(/^width: 68\.3/)])
  })

  it('split: the total, the parts by rank, the rest in "others", every value written', async () => {
    const w = await card('split', { parts: [{ label: 'Shop', value: 50 }, { label: 'Amazon', value: 82 }, { label: 'Fnac', value: 12 }, { label: 'Rakuten', value: 7 }] }, { maxParts: 2 })
    expect(w.find('.qd-card-value').text()).toBe('151')
    expect(w.findAll('.qd-split-legend li').map((li) => li.text())).toEqual(['Amazon82', 'Shop50', 'core.cards.split.others19'])
    expect(w.findAll('.qd-split-part').map((p) => p.attributes('data-tone'))).toEqual(['1', '2', 'others'])
  })

  it('funnel: bars scaled to the first step, the loss between steps in words', async () => {
    const w = await card('funnel', { steps: [{ label: 'sent', value: 84 }, { label: 'followed up', value: 42 }, { label: 'signed', value: 42 }] })
    expect(w.findAll('.qd-funnel-bar').map((b) => b.attributes('style'))).toEqual(['width: 100%;', 'width: 50%;', 'width: 50%;'])
    // A loss is said between sent and followed up; none where nothing is lost
    expect(w.findAll('.qd-funnel-loss').map((l) => l.text())).toEqual(['core.cards.funnel.loss'])
  })

  it('heat: five steps of shade, each cell its value in its title and for screen readers', async () => {
    const w = await card('heat', { columns: ['8h', '12h'], rows: [{ label: 'Mon', cells: [0, 10] }, { label: 'Tue', cells: [5, 2] }] })
    const cells = w.findAll('td[data-level]')
    expect(cells.map((c) => c.attributes('data-level'))).toEqual(['0', '4', '2', '1'])
    expect(cells[1].attributes('title')).toBe('Mon · 12h: 10')
    expect(cells[1].text()).toBe('10')
    expect(w.findAll('.qd-heat-key').length).toBe(5)
  })

  it('agenda: the first ones first, a time today, "tomorrow", a date after', async () => {
    const w = await card('agenda', {
      now: '2026-11-19T09:00:00',
      items: [
        { at: '2026-11-25T10:00:00', label: 'Later' },
        { at: '2026-11-20T10:00:00', label: 'Tomorrow', allDay: true },
        { at: '2026-11-19T14:00:00', label: 'Today', to: '/p/1' },
      ],
    })
    const lines = w.findAll('.qd-agenda-item')
    expect(lines.map((l) => l.find('.qd-agenda-label').text())).toEqual(['Today', 'Tomorrow', 'Later'])
    expect(lines[0].find('time').text()).toMatch(/02:00|14:00/)
    expect(lines[1].find('time').text()).toBe('core.cards.agenda.tomorrow')
    expect(lines[0].find('a').attributes('href')).toBe('/p/1')
  })

  it('feed: the latest first, its status as a mark and a word', async () => {
    const w = await card('feed', {
      now: '2026-11-19T11:00:00',
      items: [
        { at: '2026-11-19T08:03:00', label: 'Bad review', status: 'critical' },
        { at: '2026-11-19T10:42:00', label: 'Order to approve', status: 'watch' },
        { at: '2026-11-18T17:00:00', label: 'Yesterday' },
      ],
    })
    const lines = w.findAll('.qd-feed-item')
    expect(lines.map((l) => l.find('.qd-feed-label').text())).toEqual(['Order to approve', 'Bad review', 'Yesterday'])
    expect(lines[0].attributes('data-status')).toBe('watch')
    expect(lines[0].find('.qd-feed-status').text()).toBe('core.cards.status.watch')
    expect(lines[2].find('time').text()).toBe('core.cards.agenda.yesterdayAt')
  })
})
