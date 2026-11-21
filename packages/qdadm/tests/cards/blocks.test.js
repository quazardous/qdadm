/**
 * Cards made of blocks (#5414): each block's schema, the viz geometry and
 * time axis, its tooltip by keyboard, a `blocks` card, blocks under any
 * card (envelope.blocks, a dashboard block's card.blocks), a type declared
 * by blocks, and the generic types rebuilt as assemblies.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { QdCardView, registerCard, getCard, checkBlock, checkBlocks, vizGeometry, timeTicks, periodOf, checkCardInput } from '../../src/cards/index'
import QdCardBlockScope from '../../src/cards/QdCardBlockScope.vue'

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] })
const card = (type, data, envelope = {}, options = {}) =>
  mount(QdCardView, { props: { type, data, options, envelope: { title: 'T', ...envelope } }, global: { plugins: [router] }, attachTo: document.body })

const DAY = 86_400_000
const t0 = Date.UTC(2026, 10, 13, 12)
const week = (vals) => vals.map((v, i) => [t0 + i * DAY, v])

describe('block schemas (#5414)', () => {
  it('each block is checked against its kind, a problem naming its field', () => {
    expect(checkBlock({ kind: 'value', value: 3 })).toEqual([])
    expect(checkBlock({ kind: 'viz', series: [1, 2, 3] })).toEqual([])
    expect(checkBlock({ kind: 'viz', series: [{ label: 'a', points: [[t0, 1], { t: '2026-11-14', v: 2, low: 1, high: 3 }, 4] }] })).toEqual([])
    expect(checkBlock({ kind: 'nope' })[0].message).toMatch(/no block kind 'nope'/)
    expect(checkBlock({ kind: 'value' })[0].path).toBe('block.value')
    expect(checkBlock({ kind: 'value', value: 'x' })[0].path).toBe('block.value')
    expect(checkBlocks([{ kind: 'text', text: 'ok' }, { kind: 'list', items: [{}] }]).map((p) => p.path)).toEqual(['blocks[1].items[0].label'])
  })

  it('a blocks card with a block that does not fit is invalid, saying where', () => {
    const def = getCard('blocks')
    const problems = checkCardInput(def, { blocks: [{ kind: 'value', value: 1 }, { kind: 'viz' }] })
    expect(problems[0].path).toBe('data.blocks[1].series')
    const w = card('blocks', { blocks: [{ kind: 'viz' }] })
    expect(w.find('.qd-card-invalid').exists()).toBe(true)
    expect(w.text()).toContain('data.blocks[0]')
  })
})

describe('the viz geometry (#5414)', () => {
  it('lines by time; the band; the points outside; the thresholds within the range', () => {
    const g = vizGeometry({ kind: 'viz', series: [{ points: week([5, 12, 7]) }], normal: { low: 4, high: 10 }, warning: 15, critical: 20 }, 40)
    expect(g.timed).toBe(true)
    expect(g.min).toBe(4)
    expect(g.max).toBe(20)
    expect(g.lines).toHaveLength(1)
    expect(g.lines[0].line.startsWith('M0.00,')).toBe(true)
    expect(g.band).toMatch(/Z$/)
    expect(g.outside.map((o) => o.v)).toEqual([12])
    expect(g.thresholds.map((th) => th.level)).toEqual(['warning', 'critical'])
    expect(g.thresholds[1].y).toBeLessThan(g.thresholds[0].y) // critical higher up
    expect(g.columns.map((c) => Math.round(c.x))).toEqual([0, 50, 100])
  })

  it('bars grouped side by side, stacked bars summing, both from zero', () => {
    const series = [{ label: 'a', points: [2, 4] }, { label: 'b', points: [1, 3] }]
    const grouped = vizGeometry({ kind: 'viz', chart: 'bars', series }, 40)
    expect(grouped.bars).toHaveLength(4)
    expect(grouped.min).toBe(0)
    expect(grouped.bars[0].x).toBeLessThan(grouped.bars[1].x)
    const stacked = vizGeometry({ kind: 'viz', chart: 'stacked', series }, 40)
    expect(stacked.max).toBe(7)
    // The second part sits on the first: its bottom is the first's top
    expect(stacked.bars[1].y + stacked.bars[1].h).toBeCloseTo(stacked.bars[0].y, 5)
    expect(stacked.columns[1].values.map((v) => v.v)).toEqual([4, 3])
  })

  it('a list of numbers is one series with no time; an area closes under its line', () => {
    const g = vizGeometry({ kind: 'viz', chart: 'area', series: [3, 1, 2] }, 28)
    expect(g.timed).toBe(false)
    expect(g.lines[0].tone).toBe('lead')
    expect(g.lines[0].area).toMatch(/Z$/)
    expect(g.last.x).toBe(100)
  })

  it('time ticks: hours for 24h, days for 7d, weeks for 30d', () => {
    expect(periodOf(20 * 3600_000)).toBe('24h')
    expect(periodOf(6 * DAY)).toBe('7d')
    expect(periodOf(29 * DAY)).toBe('30d')
    const day = timeTicks(t0, t0 + DAY, 'en', '24h')
    expect(day.length).toBeGreaterThanOrEqual(3)
    expect(day.every((tk) => new Date(tk.t).getHours() % 6 === 0)).toBe(true)
    const w = timeTicks(t0, t0 + 6 * DAY, 'en', '7d')
    expect(w.length).toBe(6)
    expect(w.every((tk) => new Date(tk.t).getHours() === 0)).toBe(true)
    const m = timeTicks(t0, t0 + 29 * DAY, 'en', '30d')
    expect(m.length).toBeGreaterThanOrEqual(4)
    expect(m.length).toBeLessThanOrEqual(5)
    expect(m.every((tk) => tk.x >= 0 && tk.x <= 100)).toBe(true)
  })
})

describe('the viz block (#5414)', () => {
  const viz = { kind: 'viz', chart: 'area', label: 'errors a day', warning: 10, series: [{ label: 'new', points: week([4, 9, 12]) }, { label: 'sorted', points: week([3, 5, 7]) }] }

  it('small: a sparkline, hidden from screen readers, no axis', () => {
    const w = card('blocks', { blocks: [{ ...viz }] }, { size: 's' })
    expect(w.find('.qd-viz--compact').exists()).toBe(true)
    expect(w.find('.qd-viz-plot').attributes('aria-hidden')).toBe('true')
    expect(w.find('.qd-viz-ticks').exists()).toBe(false)
  })

  it('larger: axis, legend, threshold, a summary; the arrow keys walk the columns', async () => {
    const w = card('blocks', { blocks: [{ ...viz }] }, { size: 'm' })
    const plot = w.find('.qd-viz-plot')
    expect(plot.attributes('tabindex')).toBe('0')
    expect(plot.attributes('aria-label')).toMatch(/errors a day/)
    // Three days from noon: the two midnights between
    expect(w.findAll('.qd-viz-ticks span').length).toBe(2)
    expect(w.findAll('.qd-viz-legend li').map((l) => l.text())).toEqual(['new', 'sorted'])
    expect(w.find('.qd-viz-threshold[data-level="warning"]').exists()).toBe(true)
    await plot.trigger('focus')
    await nextTick()
    expect(w.find('[data-viz-tip]').text()).toContain('12')
    await plot.trigger('keydown', { key: 'ArrowLeft' })
    await nextTick()
    expect(w.find('[data-viz-tip]').text()).toContain('9')
    expect(w.find('[aria-live]').text()).toContain('new 9')
    await plot.trigger('keydown', { key: 'Home' })
    await nextTick()
    expect(w.find('[data-viz-tip]').text()).toContain('4')
    await plot.trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(w.find('[data-viz-tip]').exists()).toBe(false)
  })
})

describe('composing (#5414)', () => {
  it('a blocks card draws its blocks in order; its pill is its first value', () => {
    const w = card('blocks', {
      blocks: [
        { kind: 'value', value: 8, label: 'new', delta: { value: 3 }, higherIs: 'worse' },
        { kind: 'text', text: 'Hello', tone: 'watch', strong: 'now' },
        { kind: 'list', look: 'feed', now: '2026-11-19T11:00', items: [{ at: '2026-11-19T10:00', label: 'A', status: 'good' }] },
        { kind: 'progress', look: 'goal', value: 30, target: 100 },
        { kind: 'parts', parts: [{ label: 'x', value: 2 }, { label: 'y', value: 1 }] },
      ],
    })
    expect(w.findAll('[data-block]').map((b) => b.attributes('data-block'))).toEqual(['value', 'text', 'list', 'progress', 'parts'])
    expect(w.find('.qd-card-delta').classes()).toContain('qd-tone--critical')
    expect(getCard('blocks').pill({ blocks: [{ kind: 'text', text: 'x' }, { kind: 'value', value: 1234 }] }, {}, 'en')).toEqual({ value: '1,234', count: 1234 })
  })

  it('envelope.blocks: blocks under any card, after its own body', () => {
    const w = card('metric', { value: 12 }, { blocks: [{ kind: 'viz', chart: 'bars', series: [1, 2, 3] }] })
    const extra = w.find('[data-card-extra]')
    expect(extra.exists()).toBe(true)
    expect(extra.findAll('.qd-viz-bar').length).toBe(3)
    // A block that does not fit says so, the card stands
    const bad = card('metric', { value: 12 }, { blocks: [{ kind: 'viz' }] })
    expect(bad.find('.qd-card-block--invalid').text()).toMatch(/blocks\[0\]/)
    expect(bad.find('.qd-card-value').text()).toBe('12')
  })

  it("a dashboard block's card.blocks reach its card", () => {
    const w = mount(QdCardBlockScope, {
      props: { blocks: [{ kind: 'text', text: 'from the block' }] },
      slots: { default: () => h(QdCardView, { type: 'metric', data: { value: 1 }, envelope: { title: 'T' } }) },
      global: { plugins: [router] },
    })
    expect(w.find('[data-card-extra]').text()).toBe('from the block')
  })

  it('a type declared by blocks: its data mapped, no component of its own', () => {
    registerCard({
      type: 'errors-test',
      meta: { type: 'errors-test', title: 'Errors', question: '?', readings: [], strengths: [], avoid: [], sizes: ['s'], options: {}, action: '', example: { envelope: { title: 'E' }, data: {} } },
      schema: { type: 'object', required: ['today'], properties: { today: { type: 'integer' }, days: { type: 'array' } } },
      blocks: (d, _o, size) => [{ kind: 'value', value: d.today }, { kind: 'viz', chart: 'bars', series: d.days, compact: size === 's' }],
    })
    const w = card('errors-test', { today: 5, days: [1, 2, 5] })
    expect(w.find('.qd-card-value').text()).toBe('5')
    expect(w.findAll('.qd-viz-bar').length).toBe(3)
    expect(() => registerCard({ type: 'nothing', meta: {}, schema: {} })).toThrow(/component or blocks/)
  })
})

describe('the generic types are assemblies (#5414)', () => {
  it('metric: value, sparkline with its dot, hot lines', () => {
    const w = card('metric', { value: 23, delta: { value: 4, period: 'week' }, series: [1, 3, 2], hot: [{ label: 'A', tag: 'urgent' }] }, {}, { higherIs: 'worse' })
    expect(w.findAll('.qd-metric [data-block]').map((b) => b.attributes('data-block'))).toEqual(['value', 'viz', 'list'])
    expect(w.find('.qd-viz--compact .qd-spark-line').exists()).toBe(true)
    expect(w.find('.qd-spark-dot').exists()).toBe(true)
    expect(w.find('.qd-card-hot-label').text()).toBe('A')
  })

  it('queue, goal, bullet, ranking, split, feed keep their parts', () => {
    expect(card('queue', { items: [{ label: 'x', age: 2, due: 2 }] }).find('.qd-queue-item').attributes('data-warmth')).toBe('overdue')
    expect(card('goal', { value: 50, target: 100 }).find('.qd-goal-fill').attributes('style')).toContain('50%')
    expect(card('bullet', { value: 5, thresholds: [3, 6] }).find('.qd-bullet-verdict').attributes('data-range')).toBe('fair')
    expect(card('ranking', { items: [{ label: 'a', value: 1 }, { label: 'b', value: 3 }] }).findAll('.qd-ranking-label').map((l) => l.text())).toEqual(['b', 'a'])
    expect(card('split', { parts: [{ label: 'a', value: 1 }, { label: 'b', value: 3 }] }).find('.qd-card-value').text()).toBe('4')
    expect(card('feed', { items: [{ at: '2026-11-19T10:00', label: 'e' }] }).find('.qd-feed-label').text()).toBe('e')
  })
})

describe('the flash block (#5414)', () => {
  const crit = { level: 'critical', text: 'Source down', to: '/connectors/logs' }
  const info = { level: 'info', text: 'Refreshed every 5 min' }
  const order = (w) => w.findAll('.qd-card-body, .qd-card-flash, .qd-card-foot, .qd-card-head').map((e) => (e.classes('qd-card-flash') ? `flash:${e.attributes('data-place')}` : e.classes()[0]))

  it('its schema: messages, or one text and its level', () => {
    expect(checkBlock({ kind: 'flash', messages: [crit, info] })).toEqual([])
    expect(checkBlock({ kind: 'flash', level: 'warning', text: 'x' })).toEqual([])
    expect(checkBlock({ kind: 'flash' })[0].message).toMatch(/messages, or a text and its level/)
    expect(checkBlock({ kind: 'flash', level: 'loud', text: 'x' })[0].path).toBe('block.level')
  })

  it('the most serious first, a critical one an alert, its level written, a link', () => {
    const w = card('metric', { value: 1 }, { blocks: [{ kind: 'flash', messages: [info, crit] }] })
    const flash = w.find('.qd-card-flash')
    expect(flash.attributes('role')).toBe('alert')
    expect(flash.findAll('.qd-card-flash-item').map((i) => i.attributes('data-level'))).toEqual(['critical', 'info'])
    expect(flash.find('.qd-card-sr').text()).toBe('core.cards.flash.critical:')
    expect(flash.find('a.qd-card-flash-text').attributes('href')).toBe('/connectors/logs')
    const calm = card('metric', { value: 1 }, { blocks: [{ kind: 'flash', ...info }] })
    expect(calm.find('.qd-card-flash').attributes('role')).toBe('status')
  })

  it('at its place in the card: top under the header, bottom above the foot', () => {
    const w = card('metric', { value: 1 }, { source: 'logs', blocks: [{ kind: 'flash', place: 'bottom', ...info }, { kind: 'flash', ...crit }] })
    expect(order(w)).toEqual(['qd-card-head', 'flash:top', 'qd-card-body', 'flash:bottom', 'qd-card-foot'])
  })

  it("from a blocks card's data too, whatever its rank in the list", async () => {
    const w = card('blocks', { blocks: [{ kind: 'value', value: 3 }, { kind: 'flash', ...crit }] })
    await nextTick()
    expect(order(w)).toEqual(['qd-card-head', 'flash:top', 'qd-card-body'])
    expect(w.find('.qd-card-body .qd-card-flash').exists()).toBe(false)
  })

  it("from a dashboard block's card.blocks", () => {
    const w = mount(QdCardBlockScope, {
      props: { blocks: [{ kind: 'flash', place: 'bottom', ...info }] },
      slots: { default: () => h(QdCardView, { type: 'metric', data: { value: 1 }, envelope: { title: 'T' } }) },
      global: { plugins: [router] },
    })
    expect(w.find('.qd-card-flash[data-place="bottom"]').exists()).toBe(true)
  })

  it('shown whatever the state: a source down is said when the card cannot draw', () => {
    const w = card('metric', undefined, { state: 'unreachable', blocks: [{ kind: 'flash', ...crit }] })
    expect(w.find('.qd-card-unreachable').exists()).toBe(true)
    expect(w.find('.qd-card-flash').exists()).toBe(true)
  })

  it('dismissible: gone at once; with an id, for the session', async () => {
    sessionStorage.clear()
    const w = card('metric', { value: 1 }, { blocks: [{ kind: 'flash', dismissible: true, id: 'logs-down', ...crit }] })
    await w.find('[data-flash-dismiss]').trigger('click')
    expect(w.find('.qd-card-flash').exists()).toBe(false)
    const again = card('metric', { value: 1 }, { blocks: [{ kind: 'flash', dismissible: true, id: 'logs-down', ...crit }] })
    expect(again.find('.qd-card-flash').exists()).toBe(false)
    const other = card('metric', { value: 1 }, { blocks: [{ kind: 'flash', dismissible: true, ...crit }] })
    expect(other.find('.qd-card-flash').exists()).toBe(true)
    expect(card('metric', { value: 1 }, { blocks: [{ kind: 'flash', ...crit }] }).find('[data-flash-dismiss]').exists()).toBe(false)
  })

  it('alone (no card), drawn where it is; the card keeps its type and status', () => {
    const w = card('metric', { value: 7 }, { status: 'good', blocks: [{ kind: 'flash', ...crit }] })
    expect(w.attributes('data-card-type')).toBe('metric')
    expect(w.classes()).toContain('qd-card--good')
  })
})
