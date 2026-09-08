/**
 * A navigation to a route nobody registered must say so (#1923 lot 2).
 *
 * This is the failure the divergent singularizers produced: the route prefix
 * is derived from the entity name, so when the side that NAMES routes and the
 * side that LOOKS THEM UP disagreed, every helper pushed a name that did not
 * exist. Nothing happened, and nothing said why — invisible until someone
 * clicked, and then merely puzzling.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { useListPage } from '../../src/composables/useListPage'

const knownRoutes = new Set()
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  hasRoute: (name) => knownRoutes.has(name),
}
vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => ({ name: 'person', params: {}, query: {}, meta: {} }),
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
        list = useListPage({ entity: 'people', loadOnMount: false })
        return {}
      },
    },
    {
      global: {
        provide: {
          qdadmOrchestrator: { get: () => manager },
          qdadmSignals: null,
          qdadmEntityFilters: {},
        },
      },
    }
  )
  return list
}

beforeEach(() => {
  knownRoutes.clear()
  mockRouter.push.mockClear()
})
afterEach(() => vi.restoreAllMocks())

describe('navigating to a route that does not exist', () => {
  it('warns instead of failing mutely, and names the prefix it used', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const list = mountList()

    list.goToShow({ id: 7 })

    const message = spy.mock.calls.map((c) => String(c[0])).join('\n')
    expect(message).toContain('person-show')
    expect(message).toContain('does nothing')
    // Naming the prefix is the point: it is what the reader compares against
    // the names their routes were actually registered under.
    expect(message).toContain('"person"')
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('warns once per route name, not on every click', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const list = mountList()

    list.goToShow({ id: 1 })
    list.goToShow({ id: 2 })
    list.goToShow({ id: 3 })

    const ours = spy.mock.calls.filter((c) => String(c[0]).includes('person-show'))
    expect(ours).toHaveLength(1)
  })

  it('says nothing, and navigates, when the route is there', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    knownRoutes.add('person-show')
    const list = mountList()

    list.goToShow({ id: 42 })

    // Filter to our own message: Vue emits its own warnings about the
    // injections this bare mount does not provide.
    const ours = spy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('[qdadm] No route'))
    expect(ours).toHaveLength(0)
    expect(mockRouter.push).toHaveBeenCalledWith({ name: 'person-show', params: { id: 42 } })
  })

  it('distinguishes edit from show rather than lumping them', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    knownRoutes.add('person-show')
    const list = mountList()

    list.goToShow({ id: 1 })   // exists — silent
    list.goToEdit({ id: 1 })   // missing — warns

    const ours = spy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('[qdadm] No route'))
    expect(ours).toHaveLength(1)
    expect(ours[0]).toContain('person-edit')
  })

  it('covers the create path too', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const list = mountList()

    list.goToCreate()

    const message = spy.mock.calls.map((c) => String(c[0])).join('\n')
    expect(message).toContain('person-create')
    expect(mockRouter.push).not.toHaveBeenCalled()
  })
})
