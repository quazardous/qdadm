/**
 * A filtered list starts a run on its own (#5343, option A): opening a row
 * walks the list's rows, in their order, with the filter and the order in
 * words. An unfiltered list opens the row as before.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { useListPage } from '../../src/composables/useListPage'
import { loadRun } from '../../src/run/run'

const knownRoutes = new Set(['person-show', 'person-edit'])
const mockRouter = { push: vi.fn(), replace: vi.fn(), hasRoute: (name) => knownRoutes.has(name) }
vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => ({ name: 'person', path: '/people', params: {}, query: {}, meta: {} }),
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }))

const manager = {
  name: 'people',
  label: 'Person',
  labelPlural: 'People',
  routePrefix: 'person',
  idField: 'id',
  localFilterThreshold: 100,
  getListFields: () => [],
  getFieldConfig: () => null,
  list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  query: vi.fn().mockResolvedValue({ items: [], total: 0, fromCache: false }),
  canCreate: () => true,
  canUpdate: () => true,
  canDelete: () => true,
}

function mountList() {
  let list
  mount(
    {
      template: '<div></div>',
      setup() {
        list = useListPage({ entity: 'people', loadOnMount: false, syncUrlParams: false, persistFilters: false })
        return {}
      },
    },
    { global: { provide: { qdadmOrchestrator: { get: () => manager }, qdadmSignals: null, qdadmEntityFilters: {} } } }
  )
  return list
}

beforeEach(() => {
  mockRouter.push.mockClear()
  sessionStorage.clear()
})

describe('a filtered list starts a run (#5343)', () => {
  it('opening a row of a filtered list walks its rows, from that row', () => {
    const list = mountList()
    list.addFilter('status', { options: [{ label: 'To process', value: 'todo' }] })
    list.filterValues.value = { status: 'todo' }
    list.items.value = [{ id: 1 }, { id: 2 }, { id: 3 }]

    list.goToEdit({ id: 2 })

    const to = mockRouter.push.mock.calls[0][0]
    expect(to).toMatchObject({ name: 'person-edit', params: { id: '2' } })
    const run = loadRun(to.query.run)
    expect(run.items.map((i) => i.id)).toEqual(['1', '2', '3'])
    expect(run.filter).toBe('To process')
    expect(run.route).toMatchObject({ name: 'person-edit', param: 'id' })
    expect(run.returnTo).toEqual({ path: '/people', query: {} })
  })

  it('an unfiltered list opens the row as before', () => {
    const list = mountList()
    list.items.value = [{ id: 1 }, { id: 2 }]
    list.goToShow({ id: 2 })
    expect(mockRouter.push).toHaveBeenCalledWith({ name: 'person-show', params: { id: 2 } })
  })

  it('list.startRun() walks the rows from the first, on the edit page', async () => {
    const list = mountList()
    list.items.value = [{ id: 7 }, { id: 8 }]
    await list.startRun({ label: 'to check' })
    const to = mockRouter.push.mock.calls[0][0]
    expect(to).toMatchObject({ name: 'person-edit', params: { id: '7' } })
    expect(loadRun(to.query.run).label).toBe('to check')
  })
})
