/**
 * An item page's action with `items` is a split button (#5444): its own
 * button, a chevron joined on its right opening a menu of related gestures;
 * menu only without `onClick`; the entries read from the record, hidden ones
 * left out, none left a plain button again.
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
const QdActionButton = (await import('../../src/components/show/QdActionButton.vue')).default

const tooltip = { mounted: () => {}, updated: () => {} }
const manager = {
  name: 'tasks', label: 'Task', labelPlural: 'Tasks', routePrefix: 'task', idField: 'id',
  get: vi.fn(async () => ({ id: '7', following: false })),
  getShowFields: () => [], getFormFields: () => [], getEntityLabel: () => 'Task 7', getFieldConfig: () => null,
  canRead: () => true, canUpdate: () => true, canDelete: () => true,
}
async function page(setup) {
  let show
  mount(defineComponent({ setup() {
    show = useEntityItemShowPage({ entity: 'tasks' })
    setup(show)
    return () => h('div')
  } }), { global: { plugins: [PrimeVue], provide: { qdadmOrchestrator: { get: () => manager, isRegistered: () => true, toast: { success: vi.fn(), error: vi.fn() } }, qdadmEntityFilters: {} } } })
  await flushPromises()
  return (n) => show.actions.value.find((x) => x.name === n)
}
const button = (action) => mount(QdActionButton, { props: { action }, attachTo: document.body, global: { plugins: [PrimeVue], directives: { tooltip } } })

describe("an item page's split actions (#5444)", () => {
  it('items read from the record; hidden ones left out; none left, a plain button; menu only with nothing, gone', async () => {
    const a = await page((show) => {
      show.addAction({ name: 'take', label: 'Take', onClick: () => {}, items: [
        { name: 'follow', label: (t) => (t?.following ? 'Unfollow' : 'Follow'), icon: 'pi pi-eye', onClick: () => {} },
        { name: 'hidden', label: 'Hidden', visible: () => false, onClick: () => {} },
        { name: 'locked', label: 'Locked', disabled: ({ data }) => !data?.following, onClick: () => {} },
      ] })
      show.addAction({ name: 'alone', label: 'Alone', onClick: () => {}, items: [{ name: 'x', label: 'X', visible: () => false, onClick: () => {} }] })
      show.addAction({ name: 'group', label: 'Group', items: [{ name: 'y', label: 'Y', visible: () => false, onClick: () => {} }] })
    })
    expect(a('take').items.map((i) => [i.name, i.label, i.isDisabled])).toEqual([['follow', 'Follow', false], ['locked', 'Locked', true]])
    expect(a('alone').items).toEqual([])
    expect(a('group')).toBeUndefined()
  })

  it('the split button: the action, a chevron that says what it opens, the menu and its entries', async () => {
    const main = vi.fn()
    const json = vi.fn()
    const w = button({ name: 'copy', label: 'Copy', icon: 'pi pi-copy', onClick: main, isLoading: false, isDisabled: false,
      items: [{ name: 'copy-json', label: 'Copy as JSON', onClick: json, isDisabled: false }, { name: 'off', label: 'Off', onClick: vi.fn(), isDisabled: true }] })
    const group = w.find('.qd-split-action')
    expect(group.attributes('role')).toBe('group')
    expect(group.attributes('data-action')).toBe('copy')
    await w.find('[data-action-main]').trigger('click')
    expect(main).toHaveBeenCalledTimes(1)
    const chevron = w.find('[data-action-chevron]')
    expect(chevron.attributes('aria-label')).toBe('More actions: Copy')
    expect(chevron.attributes('aria-haspopup')).toBe('menu')
    expect(chevron.attributes('aria-expanded')).toBe('false')
    await chevron.trigger('click')
    await flushPromises()
    const entry = document.body.querySelector('[data-action-item="copy-json"]')
    expect(entry).toBeTruthy()
    expect(entry.textContent).toContain('Copy as JSON')
    expect(document.body.querySelector('[data-action-item="off"]').closest('[data-p-disabled]').getAttribute('data-p-disabled')).toBe('true')
    entry.click()
    await flushPromises()
    expect(json).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('menu only: one button, its label and a chevron, that opens the menu', async () => {
    const w = button({ name: 'group', label: 'Assign', isLoading: false, isDisabled: false, items: [{ name: 'take', label: 'Take', onClick: vi.fn(), isDisabled: false }] })
    expect(w.find('[data-action-main]').exists()).toBe(false)
    const only = w.find('[data-action-chevron]')
    expect(only.text()).toContain('Assign')
    expect(only.find('.pi-chevron-down').exists()).toBe(true)
    await only.trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[data-action-item="take"]')).toBeTruthy()
    w.unmount()
  })

  it('without items: the plain button, as before', () => {
    const w = button({ name: 'plain', label: 'Plain', onClick: vi.fn(), isLoading: false, isDisabled: false })
    expect(w.find('.qd-split-action').exists()).toBe(false)
    expect(w.find('[data-action="plain"]').exists()).toBe(true)
    w.unmount()
  })
})
