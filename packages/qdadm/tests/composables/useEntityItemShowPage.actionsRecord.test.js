/**
 * A show page's actions see the record (#5430): `visible` and `disabled`
 * receive `{ data, canEdit, canDelete, loading }` (data null while loading);
 * `label`, `icon` and `severity` may be functions of the record, read again
 * when it changes. The old signatures keep working.
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

function makeManager(record) {
  let resolveGet
  const manager = {
    name: 'tasks',
    label: 'Task',
    labelPlural: 'Tasks',
    routePrefix: 'task',
    idField: 'id',
    get: vi.fn(() => new Promise((r) => (resolveGet = r))),
    getShowFields: () => [],
    getFormFields: () => [],
    getEntityLabel: () => 'Task 7',
    getFieldConfig: () => null,
    canRead: () => true,
    canUpdate: () => true,
    canDelete: () => false,
  }
  return { manager, answer: () => resolveGet({ ...record }) }
}

function mountShow(manager, setup) {
  let show
  mount(
    defineComponent({
      setup() {
        show = useEntityItemShowPage({ entity: 'tasks' })
        setup(show)
        return () => h('div')
      },
    }),
    { global: { plugins: [PrimeVue], provide: { qdadmOrchestrator: { get: () => manager, isRegistered: () => true, toast: { success: vi.fn(), error: vi.fn() } }, qdadmEntityFilters: {} } } }
  )
  return show
}

describe("a show page's actions see the record (#5430)", () => {
  it('visible and disabled get { data, canEdit, canDelete, loading }; data is null while loading', async () => {
    const { manager, answer } = makeManager({ id: '7', state: 'open', following: false })
    const seen = []
    const show = mountShow(manager, (s) => {
      s.addAction({
        name: 'take',
        label: 'Take',
        onClick: () => {},
        visible: (ctx) => {
          seen.push({ ...ctx, data: ctx.data && { ...ctx.data } })
          return ctx.data?.state === 'open'
        },
        disabled: ({ data, canDelete }) => !data || canDelete,
      })
    })
    await flushPromises()
    expect(show.actions.value.find((a) => a.name === 'take')).toBeUndefined()
    expect(seen.at(-1)).toMatchObject({ data: null, loading: true, canEdit: true })
    answer()
    await flushPromises()
    const take = show.actions.value.find((a) => a.name === 'take')
    expect(take).toBeDefined()
    expect(take.isDisabled).toBe(false)
    expect(seen.at(-1)).toMatchObject({ data: { state: 'open' }, loading: false, canEdit: true, canDelete: false })
    // The record changes: the action follows
    show.data.value = { ...show.data.value, state: 'handled' }
    await flushPromises()
    expect(show.actions.value.find((a) => a.name === 'take')).toBeUndefined()
  })

  it('label, icon and severity as functions of the record, read again when it changes', async () => {
    const { manager, answer } = makeManager({ id: '7', following: false })
    const show = mountShow(manager, (s) => {
      s.addAction({
        name: 'follow',
        label: (data) => (data?.following ? 'Unfollow' : 'Follow'),
        icon: (data) => (data?.following ? 'pi pi-eye-slash' : 'pi pi-eye'),
        severity: (data) => (data?.following ? 'secondary' : 'info'),
        onClick: () => {},
        visible: ({ data }) => !!data,
      })
    })
    answer()
    await flushPromises()
    const follow = () => show.actions.value.find((a) => a.name === 'follow')
    expect(follow()).toMatchObject({ label: 'Follow', icon: 'pi pi-eye', severity: 'info' })
    show.data.value = { ...show.data.value, following: true }
    await flushPromises()
    expect(follow()).toMatchObject({ label: 'Unfollow', icon: 'pi pi-eye-slash', severity: 'secondary' })
  })

  it('the old signatures keep working', async () => {
    const { manager, answer } = makeManager({ id: '7' })
    const show = mountShow(manager, (s) => {
      s.addAction({ name: 'old', label: () => 'Old', icon: 'pi pi-star', severity: 'warn', onClick: () => {}, visible: ({ canEdit }) => canEdit, disabled: ({ loading }) => loading })
    })
    answer()
    await flushPromises()
    expect(show.actions.value.find((a) => a.name === 'old')).toMatchObject({ label: 'Old', icon: 'pi pi-star', severity: 'warn', isDisabled: false })
  })
})
