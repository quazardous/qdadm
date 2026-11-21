/**
 * Charts (#5441): stacked areas, N series, the metric's chart picked by its
 * options (a line by default) and the same in its domain bar pill, and the
 * app's own charts registered by name.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { QdCardView, QdVizBlock, vizGeometry, getCard, checkCardInput, checkBlock, registerChart, getChart, toneColor } from '../../src/cards/index'
import { resetCharts } from '../../src/cards/blocks/charts'
import { registerDomain, domainOfRoute, QdDomainBar } from '../../src/domain/index'
import { resetDomains } from '../../src/domain/registry'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/board', component: { template: '<div />' }, meta: { module: 'ops' } }, { path: '/:p(.*)*', component: { template: '<div />' } }],
})
const card = (type, data, options = {}) =>
  mount(QdCardView, { props: { type, data, options, envelope: { title: 'T' } }, global: { plugins: [router] }, attachTo: document.body })
const io = [
  { label: 'in', points: [5, 6, 7, 8] },
  { label: 'out', points: [2, 3, 2, 4] },
  { label: 'errors', points: [1, 0, 1, 2] },
]

beforeEach(() => {
  resetCharts()
  resetDomains()
  localStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

describe('the viz geometry, stacked (#5441)', () => {
  it('stacked areas: each band on the one below, the range over the pile', () => {
    const g = vizGeometry({ kind: 'viz', chart: 'area', stacked: true, series: io }, 40)
    expect(g.min).toBe(5)
    expect(g.max).toBe(14)
    expect(g.lines).toHaveLength(3)
    // The first band down to the frame's bottom, the next ones down to the line below
    expect(g.lines[0].area.endsWith('L100.00,40 L0.00,40 Z')).toBe(true)
    const below = g.lines[0].line.split(' ').map((c) => c.slice(1)).reverse()
    expect(g.lines[1].area.endsWith(`${below.map((c) => `L${c}`).join(' ')} Z`)).toBe(true)
    // The dot on the top of the pile
    expect(g.last.y).toBeCloseTo(g.y(14), 5)
    // The tooltip still reads each series' own value
    expect(g.columns[3].values.map((v) => v.v)).toEqual([8, 4, 2])
  })

  it('areas not stacked: each from its own value; bars with the flag stack as `stacked` does', () => {
    const plain = vizGeometry({ kind: 'viz', chart: 'area', series: io }, 40)
    expect(plain.max).toBe(8)
    expect(plain.min).toBe(0)
    const flagged = vizGeometry({ kind: 'viz', chart: 'bars', stacked: true, series: io }, 40)
    const legacy = vizGeometry({ kind: 'viz', chart: 'stacked', series: io }, 40)
    expect(flagged.bars).toEqual(legacy.bars)
    expect(flagged.max).toBe(14)
  })

  it('a high, flat series reads as a line, the range min-max', () => {
    const g = vizGeometry({ kind: 'viz', series: [92, 95, 95, 95, 95, 95] }, 28)
    expect([g.min, g.max]).toEqual([92, 95])
    expect(g.lines[0].area).toBe('')
  })

  it('a chart nobody registered: the geometry of a line', () => {
    const g = vizGeometry({ kind: 'viz', chart: 'sankey', series: [1, 2, 3] }, 28)
    expect(g.lines[0].area).toBe('')
    expect(g.bars).toEqual([])
    expect(checkBlock({ kind: 'viz', chart: 'sankey', stacked: true, series: io })).toEqual([])
  })
})

describe("the metric's chart (#5441)", () => {
  it('a line by default, in the card and in the pill', () => {
    const w = card('metric', { value: 95, series: [92, 95, 95, 95] })
    expect(w.find('[data-block="viz"]').attributes('data-chart')).toBe('line')
    expect(w.find('.qd-spark-area').exists()).toBe(false)
    expect(getCard('metric').pill({ value: 95, series: [92, 95] }, {}, 'en').blocks[0]).toMatchObject({ kind: 'viz', chart: 'line' })
    w.unmount()
  })

  it('N series, stacked areas, picked by its options; the pill builds the same chart', () => {
    const def = getCard('metric')
    const data = { value: 14, series: io }
    const options = { chart: 'area', stacked: true }
    expect(checkCardInput(def, data, options)).toEqual([])
    const w = card('metric', data, options)
    const viz = w.find('[data-block="viz"]')
    expect(viz.attributes('data-chart')).toBe('area')
    expect(viz.attributes('data-stacked')).toBe('true')
    expect(viz.findAll('path.qd-viz-area')).toHaveLength(3)
    // One reading per series, for screen readers
    expect(viz.find('.qd-card-sr').text().split(';')).toHaveLength(3)
    expect(def.pill(data, options, 'en').blocks[0]).toEqual(expect.objectContaining({ chart: 'area', stacked: true, series: io }))
    w.unmount()
  })

  it('a larger card with several series: the full chart, its legend; a trend takes its chart too', () => {
    const m = mount(QdCardView, { props: { type: 'metric', data: { value: 14, series: io }, options: {}, envelope: { title: 'T', size: 'm' } }, global: { plugins: [router] }, attachTo: document.body })
    expect(m.find('[data-block="viz"]').classes()).not.toContain('qd-viz--compact')
    expect(m.findAll('.qd-viz-legend li')).toHaveLength(3)
    m.unmount()
    registerChart('mine', defineComponent({ setup: () => () => h('i', { class: 'mine' }) }))
    const tr = card('trend', { series: [{ value: 3 }, { value: 5 }, { value: 4 }] }, { chart: 'area' })
    expect(tr.find('[data-block="viz"]').attributes('data-chart')).toBe('area')
    tr.unmount()
    const own = card('trend', { series: [{ value: 3 }, { value: 5 }] }, { chart: 'mine' })
    expect(own.find('.mine').exists()).toBe(true)
    own.unmount()
  })

  it('series that do not fit are named', () => {
    const p = checkCardInput(getCard('metric'), { value: 1, series: [{ label: 'in' }] })
    expect(p.length).toBeGreaterThan(0)
    expect(p[0].path).toMatch(/^data\.series/)
  })
})

describe("the app's charts (#5441)", () => {
  const Mine = defineComponent({
    props: ['series', 'stacked', 'compact', 'height', 'colors', 'mode', 'unit', 'dot'],
    setup: (p) => () => h('div', { class: 'mine', 'data-n': p.series.length, 'data-stacked': String(p.stacked), 'data-mode': p.mode?.mode ?? 'none', 'data-colors': p.colors.join('|') }),
  })

  it('a name registered draws with its component, given the series read', () => {
    registerChart('mine', Mine)
    expect(getChart('mine')).toBeTruthy()
    const w = mount(QdVizBlock, { props: { block: { kind: 'viz', chart: 'mine', stacked: true, series: io }, size: 's' } })
    const m = w.find('.mine')
    expect(m.exists()).toBe(true)
    expect(m.attributes('data-n')).toBe('3')
    expect(m.attributes('data-stacked')).toBe('true')
    expect(m.attributes('data-mode')).toBe('none')
    expect(m.attributes('data-colors')).toBe('var(--qd-cat-1)|var(--qd-cat-2)|var(--qd-cat-3)')
    expect(w.find('svg').exists()).toBe(false)
  })

  it("qdadm's own names cannot be taken; a name nobody registered draws a line, with a warning", () => {
    expect(() => registerChart('area', Mine)).toThrow(/draws 'area' itself/)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mount(QdVizBlock, { props: { block: { kind: 'viz', chart: 'nope', series: [1, 2, 3] }, size: 's' } })
    expect(w.find('[data-block="viz"]').attributes('data-chart')).toBe('line')
    expect(w.find('path.qd-spark-line').exists()).toBe(true)
    expect(warn.mock.calls.flat().join(' ')).toMatch(/no chart is named 'nope'/)
    expect(toneColor('critical')).toBe('var(--qd-tone-critical)')
  })

  it("in a domain bar: the metric's chart option reaches the app's chart, told the bar's mode", async () => {
    registerChart('mine', Mine)
    await router.push('/board')
    registerDomain('ops', { label: 'Ops', indicators: [{ id: 'io', card: 'metric', title: 'Traffic', data: { value: 8, series: io.slice(0, 2) }, options: { chart: 'mine' } }] }, 'ops')
    const w = mount(QdDomainBar, { props: { domain: domainOfRoute(router.currentRoute.value) }, attachTo: document.body, global: { plugins: [router] } })
    await flushPromises()
    const pill = () => w.find('[data-indicator="io"]')
    expect(pill().find('.mine').attributes('data-mode')).toBe('full')
    // Each series' last value in the pill's tooltip
    expect(pill().attributes('title')).toBe('Traffic: 8 (in 8, out 4)')
    await w.find('[data-domain-toggle]').trigger('click')
    expect(pill().find('.mine').attributes('data-mode')).toBe('compact')
    w.unmount()
  })
})
