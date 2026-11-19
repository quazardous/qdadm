/**
 * QdDomainBoard (#5352): typed blocks on a grid of 12, each reading its own
 * data and drawing its own states; kpi, breakdown, top, timeline; a type of
 * the app's own.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { QdDomainBoard, registerBoardBlock, BOARD_BLOCKS, listBoardBlocks } from '../../src/board/index'

async function mountBoard(props) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] })
  await router.push('/')
  const wrapper = mount(QdDomainBoard, { props, attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const block = (w, type) => w.find(`[data-board-block="${type}"]`)

describe('QdDomainBoard (#5352)', () => {
  it("registers qdadm's block types", () => {
    expect(listBoardBlocks().map((b) => b.type)).toEqual(expect.arrayContaining([...BOARD_BLOCKS]))
  })

  it('places each block on the grid of 12, by its span or its type default', async () => {
    const w = await mountBoard({
      blocks: [
        { type: 'kpi', data: { label: 'Open', value: 69 } },
        { type: 'top', span: 9, data: { columns: [{ key: 'a', label: 'A' }], rows: [{ values: { a: 'x' } }] } },
        { type: 'kpi', span: 40, data: { label: 'Big', value: 1 } },
      ],
    })
    expect(w.findAll('.qd-board-cell').map((c) => c.attributes('style'))).toEqual(['--qd-board-span: 3;', '--qd-board-span: 9;', '--qd-board-span: 12;'])
  })

  it('a kpi: its value, its note, its status in words, its link', async () => {
    const w = await mountBoard({ blocks: [{ type: 'kpi', data: { label: 'Fatal', value: 1234.5, decimals: 1, note: 'pages broken', status: 'critical', to: '/errors?fatal=1' } }] })
    const kpi = block(w, 'kpi')
    expect(kpi.find('.qd-board-kpi-value').text()).toBe('1,234.5')
    expect(kpi.find('.qd-board-kpi-status').text()).toBe('core.cards.status.critical')
    expect(kpi.find('a').attributes('href')).toBe('/errors?fatal=1')
    expect(kpi.find('.qd-board-kpi').classes()).toContain('qd-board-kpi--critical')
  })

  it('a breakdown: bars scaled within each group, the value always written', async () => {
    const w = await mountBoard({
      blocks: [{ type: 'breakdown', data: { groups: [{ title: 'By kind', rows: [{ label: 'Notice', value: 50, to: '/e?k=notice' }, { label: 'Warning', value: 25 }] }, { title: 'By origin', rows: [{ label: 'crons', value: 4 }] }] } }],
    })
    const bars = w.findAll('.qd-board-breakdown-bar').map((b) => b.attributes('style'))
    expect(bars).toEqual(['width: 100%;', 'width: 50%;', 'width: 100%;'])
    expect(w.findAll('.qd-board-breakdown-value').map((v) => v.text())).toEqual(['50', '25', '4'])
    expect(w.find('.qd-board-breakdown-row').attributes('href')).toBe('/e?k=notice')
  })

  it('a top: declared columns, tags with their status, a spark, the row opening its item, the more link', async () => {
    const w = await mountBoard({
      blocks: [
        {
          type: 'top',
          title: 'Most frequent',
          more: { label: 'All 69', to: '/errors' },
          data: {
            columns: [{ key: 'where', label: 'Where', type: 'mono' }, { key: 'kind', label: 'Kind', type: 'tags' }, { key: 'week', label: '7 d', type: 'spark' }, { key: 'today', label: 'Today', type: 'number' }],
            rows: [{ to: '/errors/1', values: { where: 'product.php:117', kind: [{ label: 'Notice', status: 'watch' }, 'Warning'], week: [1, 3, 2, 8], today: 1670 } }],
          },
        },
      ],
    })
    expect(w.findAll('th').map((t) => t.text())).toEqual(['Where', 'Kind', '7 d', 'Today'])
    expect(w.find('.qd-board-top-link').attributes('href')).toBe('/errors/1')
    expect(w.findAll('.qd-card-tag').map((t) => t.text())).toEqual(['Notice', 'Warning'])
    expect(w.find('.qd-board-spark path').attributes('d')).toMatch(/^M/)
    expect(w.find('td.qd-board-col--number').text()).toBe('1,670')
    expect(w.find('.qd-board-more').attributes('href')).toBe('/errors')
  })

  it('a timeline: one bar per point, the latest marked, the total and its change', async () => {
    const points = [3, 5, 2, 8].map((value, i) => ({ at: `2026-11-1${i + 5}T00:00:00Z`, value }))
    const w = await mountBoard({ blocks: [{ type: 'timeline', data: { points, label: 'loans', previous: 12, higherIs: 'worse' } }] })
    const bars = w.findAll('.qd-board-timeline-bars li')
    expect(bars.length).toBe(4)
    expect(bars[3].classes()).toContain('qd-board-timeline-latest')
    expect(bars[3].attributes('title')).toContain('8 loans')
    expect(w.find('.qd-board-timeline-head .qd-board-kpi-value').text()).toBe('18')
    const change = w.find('.qd-card-delta')
    expect(change.classes()).toContain('qd-tone--critical')
    expect(change.text()).toBe('core.board.change')
  })

  it('a timeline as busy as the period before says so in words', async () => {
    const w = await mountBoard({ blocks: [{ type: 'timeline', data: { points: [{ at: '2026-11-19', value: 5 }], previous: 5 } }] })
    expect(w.find('.qd-card-delta').text()).toBe('core.board.same')
  })

  it('a block reads its own data: waiting alone, unreachable with a retry, then drawn', async () => {
    let fail = true
    let release
    const slow = new Promise((r) => (release = r))
    const w = await mountBoard({
      blocks: [
        { type: 'kpi', data: { label: 'Now', value: 1 } },
        { type: 'kpi', load: () => slow.then(() => ({ label: 'Slow', value: 2 })) },
        { type: 'kpi', load: async () => { if (fail) throw new Error('timeout'); return { label: 'Flaky', value: 3 } } },
      ],
    })
    const states = () => w.findAll('[data-board-block]').map((b) => b.attributes('data-board-state'))
    expect(states()).toEqual(['ready', 'loading', 'unreachable'])
    expect(w.find('[data-board-state="unreachable"]').text()).toContain('timeout')
    fail = false
    await w.find('[data-board-state="unreachable"] button').trigger('click')
    release()
    await flushPromises()
    expect(states()).toEqual(['ready', 'ready', 'ready'])
  })

  it('data that does not fit draws the block as invalid; nothing draws it as empty', async () => {
    const w = await mountBoard({
      blocks: [
        { type: 'kpi', data: { label: 'Bad', value: true } },
        { type: 'top', data: { columns: [{ key: 'a', label: 'A' }], rows: [] }, emptyText: 'No error today' },
        { type: 'nope', data: {} },
      ],
    })
    const all = w.findAll('[data-board-block]')
    expect(all.map((b) => b.attributes('data-board-state'))).toEqual(['invalid', 'empty', 'invalid'])
    expect(all[0].text()).toContain('data.value')
    expect(all[1].text()).toBe('No error today')
    expect(all[2].text()).toContain("no board block of type 'nope'")
  })

  it("a type of the app's own", async () => {
    registerBoardBlock('note', {
      component: defineComponent({ props: ['data'], setup: (p) => () => h('p', { class: 'mine' }, p.data.text) }),
      schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } },
      span: 4,
    })
    const w = await mountBoard({ blocks: [{ type: 'note', data: { text: 'Hello' } }] })
    expect(w.find('.mine').text()).toBe('Hello')
    expect(w.find('.qd-board-cell').attributes('style')).toBe('--qd-board-span: 4;')
  })

  it('the header: the source, how fresh, and a link to it', async () => {
    const w = await mountBoard({ source: { label: 'LegacyLog', freshness: new Date(Date.now() - 120000), to: 'https://logs.example' }, blocks: [] })
    const head = w.find('.qd-board-source')
    expect(head.text()).toContain('LegacyLog')
    expect(head.text()).toContain('2 minutes ago')
    expect(head.find('a').attributes('href')).toBe('https://logs.example')
  })
})
