/**
 * QdRuleParam: a text's suggestions as a datalist, the typing free (#5585).
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QdRuleParam from '../../src/components/editors/yaml/rules/QdRuleParam.vue'

describe('QdRuleParam text suggestions (#5585)', () => {
  it('a datalist tied to the input; a free value still written', async () => {
    const w = mount(QdRuleParam, {
      props: { param: { type: 'text', suggestions: ['it', { value: 'finance.payments', label: 'Finance' }] }, value: 'it', path: [0, 'then', 'route'] },
      attachTo: document.body,
    })
    const input = w.find('input')
    const list = w.find('datalist[data-suggestions]')
    expect(input.attributes('list')).toBe(list.attributes('id'))
    expect(list.findAll('option').map((o) => [o.attributes('value'), o.attributes('label') ?? ''])).toEqual([['it', ''], ['finance.payments', 'Finance']])
    input.element.value = 'ops.night'
    await input.trigger('change')
    const [change] = w.emitted('apply')[0]
    expect(change('- then:\n    route: it # who\n')).toBe('- then:\n    route: ops.night # who\n')
    w.unmount()
  })

  it('no suggestions: no datalist, no list attribute', () => {
    const w = mount(QdRuleParam, { props: { param: { type: 'text' }, value: '', path: ['a'] } })
    expect(w.find('datalist').exists()).toBe(false)
    expect(w.find('input').attributes('list')).toBeUndefined()
  })
})
