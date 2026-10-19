/**
 * PayloadViewer and PayloadDiff (#4112).
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import PayloadViewer from '../../src/components/display/PayloadViewer.vue'
import PayloadDiff from '../../src/components/display/PayloadDiff.vue'
import { maskKeys } from '../../src/utils/payload'

const global = { plugins: [PrimeVue], directives: { tooltip: {} } }
const view = (props) => mount(PayloadViewer, { props, global })
const diff = (props) => mount(PayloadDiff, { props, global })

describe('PayloadViewer (#4112)', () => {
  it('renders each format its own way', () => {
    expect(view({ body: { a: 1 } }).find('.json-viewer').exists()).toBe(true)

    const xml = view({ body: '<order id="1"><qty>2</qty></order>' })
    expect(xml.find('.pl-tag').text()).toBe('order')
    expect(xml.text()).toContain('<qty>2</qty>')

    const csv = view({ body: 'sku;qty\nA1;2\nB2;1' })
    expect(csv.findAll('thead th').map((h) => h.text())).toEqual(['', 'sku', 'qty'])
    expect(csv.findAll('tbody tr')).toHaveLength(2)

    const form = view({ body: 'a=1&b=two', contentType: 'application/x-www-form-urlencoded' })
    expect(form.findAll('.qd-payload-kv th').map((h) => h.text())).toEqual(['a', 'b'])

    const text = view({ body: 'line one\nline two' })
    expect(text.findAll('.pl-n').map((n) => n.text())).toEqual(['1', '2'])

    const bin = view({ body: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00]) })
    expect(bin.attributes('data-format')).toBe('binary')
    expect(bin.find('.qd-payload-binary pre').text()).toContain('25 50 44 46 00')
  })

  it('never renders a captured payload as HTML', () => {
    const wrapper = view({ body: '<img src=x onerror="alert(1)"/>', format: 'xml' })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('onerror')
    const text = view({ body: '<script>alert(1)</script> not xml <', format: 'text' })
    expect(text.find('script').exists()).toBe(false)
  })

  it('says when the content is not the format it claims', () => {
    const wrapper = view({ body: '{"a": 1,', contentType: 'application/json' })
    expect(wrapper.find('.qd-payload-warning').text()).toContain('core.payload.malformed')
    expect(wrapper.text()).toContain('{"a": 1,')
  })

  it('shows the request, masks headers and body, and copies the masked text', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const wrapper = view({
      body: { user: 'bob', password: 'hunter2' },
      request: { method: 'post', url: 'https://psp.test/pay', status: 502, headers: { Authorization: 'Bearer abc', 'Content-Type': 'application/json' } },
      mask: maskKeys(),
    })
    expect(wrapper.find('.pl-method').text()).toBe('POST')
    expect(wrapper.find('.pl-status').classes()).toContain('pl-status--error')
    expect(wrapper.find('.qd-payload-headers').text()).toContain('••••••')
    expect(wrapper.text()).not.toContain('hunter2')
    expect(wrapper.text()).not.toContain('Bearer abc')

    await wrapper.find('[aria-label="core.payload.copy"]').trigger('click')
    expect(writeText.mock.calls[0][0]).toContain('"password": "••••••"')
  })

  it('caps a long CSV and shows the rest on demand', async () => {
    const body = ['n', ...Array.from({ length: 450 }, (_, i) => String(i))].join('\n')
    const wrapper = view({ body, format: 'csv' })
    expect(wrapper.findAll('tbody tr')).toHaveLength(200)
    await wrapper.find('.qd-payload-more').trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(450)
  })
})

describe('PayloadDiff (#4112)', () => {
  it('puts deletions in front of insertions, side by side', () => {
    const wrapper = diff({ left: '{"qty": 2, "sku": "A1"}', right: '{"sku": "A1", "qty": 3}' })
    expect(wrapper.find('.pl-count--add').text()).toBe('+1')
    expect(wrapper.find('.pl-count--del').text()).toBe('−1')
    const changed = wrapper.findAll('tbody tr').find((r) => r.find('.pl-del').exists())
    expect(changed.find('.pl-del').text()).toBe('"qty": 2,')
    expect(changed.find('.pl-ins').text()).toBe('"qty": 3,')
  })

  it('says identical when only the formatting differs', () => {
    const wrapper = diff({ left: '<o><a>1</a></o>', right: '<o>\n  <a>1</a>\n</o>' })
    expect(wrapper.find('.qd-payload-identical').exists()).toBe(true)
  })

  it('folds long unchanged runs, and unfolds them', async () => {
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i}`)
    const changed = [...lines]
    changed[20] = 'line twenty'
    const wrapper = diff({ left: lines.join('\n'), right: changed.join('\n'), format: 'text', mode: 'inline' })
    const folds = wrapper.findAll('.pl-fold button')
    expect(folds.map((f) => f.text())).toEqual(['core.payload.unchanged', 'core.payload.unchanged'])
    expect(wrapper.findAll('tbody tr:not(.pl-fold)')).toHaveLength(3 + 2 + 3)
    await folds[0].trigger('click')
    expect(wrapper.findAll('tbody tr:not(.pl-fold)')).toHaveLength(17 + 3 + 2 + 3)
  })

  it('compares CSV rows on a key column', () => {
    const wrapper = diff({ left: 'sku,qty\nA1,2\nB2,1', right: 'sku,qty\nA1,3\nC3,1', format: 'csv', csvKey: 'sku' })
    expect(wrapper.findAll('tbody tr').map((r) => r.classes()[0])).toEqual(['pl-row--changed', 'pl-row--removed', 'pl-row--added'])
    expect(wrapper.find('.pl-cell--changed').text()).toBe('2 3')
  })
})
