/**
 * A show page's actions have a tooltip (#5436), like the row actions: a
 * string or a function of the record, in the header and the footer; a
 * disabled action keeps it on a focusable wrapper.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import PrimeVue from 'primevue/config'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), resolve: vi.fn(() => ({ href: '' })) }),
  useRoute: () => ({ name: 'task-show', params: { id: '7' }, query: {}, meta: {} }),
  RouterLink: { name: 'RouterLink', props: ['to'], template: '<a><slot /></a>' },
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }))

const { useEntityItemShowPage } = await import('../../src/composables/useEntityItemShowPage')
const ShowPage = (await import('../../src/components/show/ShowPage.vue')).default

const tips = []
const tooltip = {
  mounted: (el, b) => b.value && tips.push([el.getAttribute('data-action') ?? (el.hasAttribute('data-action-tip') ? 'wrapper' : el.tagName), b.value]),
  updated: () => {},
}

describe("a show page's action tooltips (#5436)", () => {
  it('a string or a function of the record, resolved at each render', async () => {
    const manager = {
      name: 'tasks', label: 'Task', labelPlural: 'Tasks', routePrefix: 'task', idField: 'id',
      get: vi.fn(async () => ({ id: '7', state: 'open' })),
      getShowFields: () => [], getFormFields: () => [], getEntityLabel: () => 'Task 7', getFieldConfig: () => null,
      canRead: () => true, canUpdate: () => true, canDelete: () => true,
    }
    let show
    mount(defineComponent({ setup() {
      show = useEntityItemShowPage({ entity: 'tasks' })
      show.addAction({ name: 'handled', label: 'Handled', tooltip: 'Closes the task until it recurs', onClick: () => {} })
      show.addAction({ name: 'take', label: 'Take', tooltip: (t) => (t?.state === 'open' ? 'Assign it to you' : undefined), onClick: () => {} })
      show.addAction({ name: 'plain', label: 'Plain', onClick: () => {} })
      return () => h('div')
    } }), { global: { plugins: [PrimeVue], provide: { qdadmOrchestrator: { get: () => manager, isRegistered: () => true, toast: { success: vi.fn(), error: vi.fn() } }, qdadmEntityFilters: {} } } })
    await flushPromises()
    const a = (n) => show.actions.value.find((x) => x.name === n)
    expect(a('handled').tooltip).toBe('Closes the task until it recurs')
    expect(a('take').tooltip).toBe('Assign it to you')
    expect(a('plain').tooltip).toBeUndefined()
    show.data.value = { ...show.data.value, state: 'taken' }
    await flushPromises()
    expect(a('take').tooltip).toBeUndefined()
  })

  it('rendered on the buttons, header and footer; a disabled one on a focusable wrapper', () => {
    tips.length = 0
    const action = (name, extra = {}) => ({ name, label: name, onClick: () => {}, isLoading: false, isDisabled: false, ...extra })
    const wrapper = mount(ShowPage, {
      props: {
        actions: [
          action('edit', { placement: 'header', tooltip: 'Edit it' }),
          action('handled', { tooltip: 'Closes the task' }),
          action('ignore', { tooltip: 'Hidden while the source publishes it', isDisabled: true }),
          action('plain'),
        ],
      },
      slots: { fields: '<div />' },
      global: { plugins: [PrimeVue], directives: { tooltip }, stubs: { PageHeader: { template: '<div><slot name="actions" /></div>' } } },
    })
    expect(tips).toEqual(expect.arrayContaining([['edit', 'Edit it'], ['handled', 'Closes the task'], ['wrapper', 'Hidden while the source publishes it']]))
    expect(tips.some(([n]) => n === 'plain')).toBe(false)
    const tip = wrapper.find('[data-action-tip]')
    expect(tip.attributes('tabindex')).toBe('0')
    expect(tip.attributes('aria-label')).toBe('Hidden while the source publishes it')
    expect(tip.find('button').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
