/**
 * A show-page action goes where it says (#4693): `placement: 'header'` puts a
 * custom action at the top; by default only `edit` goes there.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ShowPage from '../../src/components/show/ShowPage.vue'

vi.mock('../../src/components/layout/PageHeader.vue', () => ({
  default: { name: 'PageHeader', template: '<header class="head"><slot name="actions" /></header>' },
}))
vi.mock('../../src/components/layout/CardShell.vue', () => ({
  default: { name: 'CardShell', template: '<div class="card-shell"><slot /><slot name="footer" /></div>' },
}))
vi.mock('../../src/components/base/QdButton.vue', () => ({
  default: { name: 'QdButton', props: ['label'], template: '<button>{{ label }}</button>' },
}))
vi.mock('../../src/components/base/QdMessage.vue', () => ({ default: { name: 'QdMessage', template: '<div><slot /></div>' } }))

const action = (name, extra = {}) => ({ name, label: name, onClick: () => {}, isLoading: false, isDisabled: false, ...extra })

describe('show-page action placement (#4693)', () => {
  it('edit and placement: header go to the header, the rest to the footer', () => {
    const page = mount(ShowPage, {
      props: { data: { id: 1 }, actions: [action('edit'), action('check', { placement: 'header' }), action('back'), action('delete')] },
    })
    const head = page.find('header.head').findAll('button').map((b) => b.text())
    expect(head).toEqual(['edit', 'check'])
    const all = page.findAll('button').map((b) => b.text())
    expect(all.filter((t) => !head.includes(t))).toEqual(['back', 'delete'])
  })

  it("placement: 'footer' takes edit out of the header", () => {
    const page = mount(ShowPage, { props: { data: { id: 1 }, actions: [action('edit', { placement: 'footer' })] } })
    expect(page.find('header.head').findAll('button')).toHaveLength(0)
  })
})
