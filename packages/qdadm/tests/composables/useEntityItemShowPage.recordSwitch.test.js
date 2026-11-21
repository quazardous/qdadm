/**
 * Another record on the same route (#5431): `/books/A` to `/books/B` keeps
 * the page, and it used to keep A on screen. The page empties and reads B;
 * a late answer for A is dropped.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { reactive, defineComponent, h, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import PrimeVue from 'primevue/config'

const route = reactive({ name: 'book-show', path: '/books/A', params: { id: 'A' }, query: {}, meta: {} })
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), resolve: vi.fn(() => ({ href: '' })) }),
  useRoute: () => route,
  RouterLink: { name: 'RouterLink', props: ['to'], template: '<a><slot /></a>' },
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }))

const { useEntityItemShowPage } = await import('../../src/composables/useEntityItemShowPage')

describe('another record on the same route (#5431)', () => {
  it('empties, reads the new record, and drops a late answer for the old one', async () => {
    const answers = {}
    const manager = {
      name: 'books',
      label: 'Book',
      labelPlural: 'Books',
      routePrefix: 'book',
      idField: 'id',
      get: vi.fn((id) => new Promise((resolve) => (answers[id] = resolve))),
      getShowFields: () => [],
      getFormFields: () => [],
      getEntityLabel: (r) => r?.title,
      getFieldConfig: () => null,
      canRead: () => true,
      canUpdate: () => true,
      canDelete: () => true,
    }
    let show
    mount(
      defineComponent({
        setup() {
          show = useEntityItemShowPage({ entity: 'books' })
          return () => h('div')
        },
      }),
      { global: { plugins: [PrimeVue], provide: { qdadmOrchestrator: { get: () => manager, isRegistered: () => true, toast: { success: vi.fn(), error: vi.fn() } }, qdadmEntityFilters: {} } } }
    )
    await flushPromises()
    answers.A({ id: 'A', title: 'Dune' })
    await flushPromises()
    expect(show.data.value.title).toBe('Dune')

    // A to B, then B to C before B answers
    route.params = { id: 'B' }
    route.path = '/books/B'
    await nextTick()
    await flushPromises()
    expect(show.data.value).toBe(null)
    expect(manager.get).toHaveBeenLastCalledWith('B')
    route.params = { id: 'C' }
    await nextTick()
    await flushPromises()
    answers.C({ id: 'C', title: 'Neuromancer' })
    await flushPromises()
    answers.B({ id: 'B', title: 'The Lord of the Rings' })
    await flushPromises()
    expect(show.data.value.title).toBe('Neuromancer')
    expect(show.entityLabel.value).toBe('Neuromancer')
  })
})
