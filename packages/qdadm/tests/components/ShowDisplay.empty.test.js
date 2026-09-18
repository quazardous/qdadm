/**
 * What an empty value shows (#2772): one app-wide placeholder, overridable per field.
 *
 * Run: npm test
 */
import { describe, it, expect, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import ShowDisplay from '../../src/components/show/ShowDisplay.vue'
import { Kernel } from '../../src/kernel/Kernel'
import {
  setEmptyPlaceholder,
  getEmptyPlaceholder,
  formatDate,
  formatDateOnly,
  formatDuration,
  formatNumber,
  formatCurrency,
  formatBytes,
  formatPercent,
} from '../../src/utils'

const Stub = defineComponent({ setup: () => () => h('div') })

function display(field, value = null) {
  return mount(ShowDisplay, { props: { field, value }, global: { stubs: { RouterLink: true, Tag: true, Image: true } } }).text()
}

const types = ['text', 'number', 'currency', 'boolean', 'date', 'datetime', 'select', 'reference', 'json']

describe('the empty placeholder (#2772)', () => {
  afterEach(() => setEmptyPlaceholder('-'))

  it("stays '-' when nothing is configured", () => {
    expect(getEmptyPlaceholder()).toBe('-')
    for (const type of types) expect(display({ name: 'x', type }), type).toBe('-')
    expect(formatDate(null)).toBe('-')
  })

  it('follows the kernel option in every display type and every formatter', () => {
    new Kernel({ root: Stub, pages: { login: Stub, layout: Stub }, homeRoute: { name: 'home', component: Stub }, display: { emptyPlaceholder: '—' } })
    expect(getEmptyPlaceholder()).toBe('—')
    for (const type of types) expect(display({ name: 'x', type }), type).toBe('—')
    expect([
      formatDate(null), formatDateOnly(undefined), formatDate('not a date'), formatDuration(null),
      formatNumber(null), formatCurrency(undefined), formatBytes(null), formatPercent(null),
    ]).toEqual(Array(8).fill('—'))
  })

  it('lets a field override it', () => {
    setEmptyPlaceholder('—')
    expect(display({ name: 'x', type: 'text', emptyText: 'not judged yet' })).toBe('not judged yet')
    expect(display({ name: 'x', type: 'number', emptyText: '' })).toBe('')
  })

  it('shows the placeholder for an empty number, not 0', () => {
    setEmptyPlaceholder('—')
    expect(display({ name: 'x', type: 'number' }, null)).toBe('—')
    expect(display({ name: 'x', type: 'number' }, 0)).toBe('0')
  })
})
