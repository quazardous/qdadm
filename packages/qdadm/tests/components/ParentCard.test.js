/**
 * Unit tests for ParentCard — the B2 hybrid parent cartouche (#1038).
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ParentCard from '../../src/components/show/ParentCard.vue'

// Stub ShowField so we assert what ParentCard derives/passes, not ShowDisplay internals.
vi.mock('../../src/components/show/ShowField.vue', () => ({
  default: {
    name: 'ShowField',
    props: ['field', 'value', 'horizontal'],
    template:
      '<div class="show-field" :data-field="field?.name" :data-type="field?.type" :data-horizontal="String(horizontal)">{{ value }}</div>',
  },
}))

function makeManager() {
  return {
    idField: 'id',
    routePrefix: 'books',
    hasSeverityMap: () => false,
    getFormFields: () => [
      { name: 'title', type: 'text', label: 'Title' },
      { name: 'author', type: 'text', label: 'Author' },
      { name: 'year', type: 'number' },
    ],
    getFieldConfig: (name) =>
      ({
        title: { type: 'text', label: 'Title' },
        author: { type: 'text', label: 'Author' },
        year: { type: 'number' },
      })[name] || null,
  }
}

function mountCard(props, manager = makeManager()) {
  const orchestrator = { get: () => manager }
  return mount(ParentCard, {
    props,
    global: {
      provide: { qdadmOrchestrator: orchestrator },
    },
  })
}

describe('ParentCard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('auto-derives all manager fields and maps values from data', () => {
    const wrapper = mountCard({
      entity: 'books',
      data: { title: 'Dune', author: 'Herbert', year: 1965 },
    })
    const fields = wrapper.findAll('.show-field')
    expect(fields).toHaveLength(3)
    expect(fields.map((f) => f.attributes('data-field'))).toEqual(['title', 'author', 'year'])
    expect(fields[0].text()).toBe('Dune')
    expect(fields[2].text()).toBe('1965')
    // number type resolves through the show type mapping
    expect(fields[2].attributes('data-type')).toBe('number')
  })

  it('restricts and orders fields via the `fields` prop', () => {
    const wrapper = mountCard({
      entity: 'books',
      data: { title: 'Dune', author: 'Herbert', year: 1965 },
      fields: ['author', 'title'],
    })
    const fields = wrapper.findAll('.show-field')
    expect(fields.map((f) => f.attributes('data-field'))).toEqual(['author', 'title'])
  })

  it('shows a spinner and no fields while loading', () => {
    const wrapper = mountCard({ entity: 'books', data: null, loading: true })
    expect(wrapper.find('.parent-card__loading').exists()).toBe(true)
    expect(wrapper.findAll('.show-field')).toHaveLength(0)
  })

  it('renders nothing when there is no data and not loading', () => {
    const wrapper = mountCard({ entity: 'books', data: null })
    expect(wrapper.find('.parent-card__loading').exists()).toBe(false)
    expect(wrapper.findAll('.show-field')).toHaveLength(0)
  })

  it('passes horizontal through and renders an optional title', () => {
    const wrapper = mountCard({
      entity: 'books',
      data: { title: 'Dune' },
      fields: ['title'],
      horizontal: false,
      title: 'Book',
    })
    expect(wrapper.find('.parent-card__title').text()).toBe('Book')
    expect(wrapper.find('.show-field').attributes('data-horizontal')).toBe('false')
  })
})
