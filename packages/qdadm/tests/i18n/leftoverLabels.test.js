/**
 * i18n left over after the first audit (#4692): a filter's automatic
 * placeholder and "All …", a custom action label given as a function, and a
 * run label given as a function all follow a locale change.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import PrimeVue from 'primevue/config'
import { I18n } from '../../src/i18n/I18n'
import { I18N_INJECTION_KEY } from '../../src/i18n/useI18n'
import { getTaskStore } from '../../src/tasks/taskStore'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), resolve: vi.fn(() => ({ href: '' })) }),
  useRoute: () => ({ name: 'loan-show', params: { id: '7' }, query: {}, meta: {} }),
  RouterLink: { name: 'RouterLink', props: ['to'], template: '<a><slot /></a>' },
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }))

const { useListPage } = await import('../../src/composables/useListPage')
const { useEntityItemShowPage } = await import('../../src/composables/useEntityItemShowPage')

let i18n
beforeAll(async () => {
  i18n = new I18n({
    defaultLocale: 'en',
    messages: {
      en: { entities: { loans: { fields: { status: { _label: 'Status', options: { active: 'Active' } } } } }, act: { remind: 'Remind' } },
      fr: { entities: { loans: { fields: { status: { _label: 'Statut', options: { active: 'En cours' } } } } }, act: { remind: 'Relancer' } },
    },
  })
  await i18n.bootstrap()
})

const manager = {
  name: 'loans',
  label: 'Loan',
  labelPlural: 'Loans',
  routePrefix: 'loan',
  idField: 'id',
  localFilterThreshold: 100,
  get: vi.fn(async () => ({ id: '7' })),
  getListFields: () => [],
  getShowFields: () => [],
  getFormFields: () => [],
  getEntityLabel: () => 'Loan 7',
  getFieldConfig: () => null,
  list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  query: vi.fn().mockResolvedValue({ items: [], total: 0, fromCache: false }),
  canRead: () => true,
  canCreate: () => true,
  canUpdate: () => true,
  canDelete: () => true,
}
const global = () => ({
  plugins: [PrimeVue],
  provide: {
    qdadmOrchestrator: { get: () => manager, isRegistered: () => true, toast: { success: vi.fn(), error: vi.fn() } },
    qdadmEntityFilters: {},
    [I18N_INJECTION_KEY]: i18n,
  },
})

describe('i18n left over (#4692)', () => {
  it("a filter without a placeholder shows its field's label, and \"All …\", in the current language", async () => {
    await i18n.changeLocale('en')
    let list
    mount(defineComponent({ setup() { list = useListPage({ entity: 'loans' }); list.addFilter('status', { options: [{ label: 'Active', value: 'active' }] }); return () => h('div') } }), { global: global() })
    await flushPromises()
    const status = () => list.props.value.filters.find((f) => f.name === 'status')
    expect(status().placeholder).toBe('Status')
    expect(status().options[0].label).toBe('All Status')
    await i18n.changeLocale('fr')
    expect(status().placeholder).toBe('Statut')
    expect(status().options.map((o) => o.label)).toEqual(['Tous : Statut', 'En cours'])
  })

  it('a placeholder given by the page is kept', async () => {
    let list
    mount(defineComponent({ setup() { list = useListPage({ entity: 'loans' }); list.addFilter('status', { placeholder: 'Pick one', options: [] }); return () => h('div') } }), { global: global() })
    await flushPromises()
    expect(list.props.value.filters[0].placeholder).toBe('Pick one')
  })

  it('a custom show action takes a label function, read at each render', async () => {
    await i18n.changeLocale('en')
    let show
    mount(defineComponent({ setup() { show = useEntityItemShowPage({ entity: 'loans' }); show.addAction({ name: 'remind', label: () => i18n.t('act.remind'), onClick: () => {} }); return () => h('div') } }), { global: global() })
    await flushPromises()
    const label = () => show.actions.value.find((a) => a.name === 'remind').label
    expect(label()).toBe('Remind')
    await i18n.changeLocale('fr')
    await nextTick()
    expect(label()).toBe('Relancer')
  })

  it('a run label given as a function follows the locale', async () => {
    const store = getTaskStore()
    store.reset()
    await i18n.changeLocale('en')
    const run = await store.run({ label: () => i18n.t('act.remind'), start: async () => ({ task_id: 1 }), task: { get: async () => ({ status: 'running' }), intervalMs: 60_000 }, open: false })
    expect(run.label).toBe('Remind')
    await i18n.changeLocale('fr')
    expect(store.state.runs[0].label).toBe('Relancer')
    store.reset()
  })
})
