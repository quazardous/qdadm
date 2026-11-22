/**
 * Row bands (#5437): a row's cells on top, a full-width band under, for the
 * rows the app picks; the pair reads as one object, the band describes its
 * row, a click in it is a click on the row.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import ListPage from '../../src/components/lists/ListPage.vue'

window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ name: 'task', params: {}, query: {}, meta: {}, path: '/tasks' }),
  RouterLink: { name: 'RouterLink', props: ['to'], template: '<a><slot /></a>' },
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }))

const ITEMS = [
  { id: 1, title: 'PHP error', type: 'php' },
  { id: 2, title: 'Late order', type: 'order' },
  { id: 3, title: 'Plain one', type: 'plain' },
]
const columns = [{ name: 'title', label: 'Title' }, { name: 'type', label: 'Type' }]

function mountList(props = {}, withSlot = true) {
  return mount(ListPage, {
    props: { items: ITEMS, columns, dataKey: 'id', selectable: true, ...props },
    slots: withSlot ? { 'row-band': `<template #row-band="{ data }"><span class="band-text">{{ data.type }} details <button class="inner">Open file</button></span></template>` } : {},
    global: { plugins: [PrimeVue], directives: { tooltip: {} } },
    attachTo: document.body,
  })
}

describe('row bands (#5437)', () => {
  it('a band under the rows rowBand picks, across every column, with no expander', async () => {
    const w = mountList({ rowBand: (r) => r.type !== 'plain' })
    await flushPromises()
    const bands = w.findAll('tr.p-datatable-row-expansion')
    expect(bands.length).toBe(2)
    expect(bands.map((b) => b.find('.band-text').text())).toEqual(['php details Open file', 'order details Open file'])
    // title, type and the selection column
    expect(bands[0].find('td').attributes('colspan')).toBe('3')
    expect(w.find('.p-datatable-row-toggle-button, [data-pc-section="rowtogglebutton"]').exists()).toBe(false)
    const rows = w.findAll('tbody > tr:not(.p-datatable-row-expansion)')
    expect(rows.map((r) => r.classes().includes('qd-row-banded'))).toEqual([true, true, false])
    w.unmount()
  })

  it('the band describes its row; a click in it is a click on the row, not on its own controls', async () => {
    const w = mountList({ rowBand: (r) => r.type === 'php' })
    await flushPromises()
    await flushPromises()
    const row = w.find('tr.qd-row-banded')
    const band = w.find('[data-row-band]')
    expect(row.attributes('aria-describedby')).toBe(band.attributes('id'))
    await band.trigger('click')
    expect(w.emitted('row-click')[0][0]).toEqual(ITEMS[0])
    await band.find('button.inner').trigger('click')
    expect(w.emitted('row-click').length).toBe(1)
    w.unmount()
  })

  it('above (#5451): the band before its row, across every column; rows without one keep no line of their own', async () => {
    const w = mountList({ rowBand: (r) => r.type !== 'plain', rowBandPosition: 'above' })
    await flushPromises()
    await flushPromises()
    expect(w.find('.qd-table-banded-above').exists()).toBe(true)
    expect(w.findAll('tr.p-datatable-row-expansion').length).toBe(0)
    const trs = w.findAll('tbody > tr')
    // band, row, band, row, (the plain row's empty header, hidden by the stylesheet,) row
    const shape = trs.map((tr) => (tr.classes().includes('p-datatable-row-group-header') ? (tr.find('[data-row-band]').exists() ? 'band' : 'empty') : tr.classes().includes('qd-row-banded') ? 'banded' : 'row'))
    expect(shape.filter((s) => s !== 'empty')).toEqual(['band', 'banded', 'band', 'banded', 'row'])
    const bands = w.findAll('[data-row-band]')
    expect(bands.map((b) => b.find('.band-text').text())).toEqual(['php details Open file', 'order details Open file'])
    // title, type and the selection column
    expect(bands[0].element.closest('td').getAttribute('colspan')).toBe('3')
    // The band describes the row after it; a click in it is a click on that row
    const row = w.find('tr.qd-row-banded')
    expect(row.attributes('aria-describedby')).toBe(bands[0].attributes('id'))
    expect(row.element.previousElementSibling.contains(bands[0].element)).toBe(true)
    await bands[1].trigger('click')
    expect(w.emitted('row-click')[0][0]).toEqual(ITEMS[1])
    await bands[1].find('button.inner').trigger('click')
    expect(w.emitted('row-click').length).toBe(1)
    w.unmount()
  })

  it("above, on a list that groups its own rows: the band stays below, with a warning", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = import.meta.env.DEV
    import.meta.env.DEV = true
    const w = mountList({ rowBandPosition: 'above', tableProps: { rowGroupMode: 'rowspan', groupRowsBy: 'type' } })
    await flushPromises()
    expect(w.find('.qd-table-banded-above').exists()).toBe(false)
    expect(w.findAll('tr.p-datatable-row-expansion').length).toBe(3)
    expect(warn.mock.calls.flat().join(' ')).toMatch(/groups its own rows/)
    import.meta.env.DEV = env
    warn.mockRestore()
    w.unmount()
  })

  it('the slot alone: a band for every row; no slot: the classic table', async () => {
    const all = mountList()
    await flushPromises()
    expect(all.findAll('tr.p-datatable-row-expansion').length).toBe(3)
    all.unmount()
    const none = mountList({ rowBand: () => true }, false)
    await flushPromises()
    expect(none.findAll('tr.p-datatable-row-expansion').length).toBe(0)
    expect(none.find('.qd-table-banded').exists()).toBe(false)
    none.unmount()
  })
})
