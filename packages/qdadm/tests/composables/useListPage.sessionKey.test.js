/**
 * A session key per page (#5440): several lists of one entity (one per
 * universe) each keep their own filters, search and sort in the session,
 * while the address keeps the entity's prefix.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useListPage } from '../../src/composables/useListPage'
import { getSessionFilters } from '../../src/composables/useListPage.utils'

const route = reactive({ name: 'task', path: '/tasks', params: {}, query: {}, meta: {} })
const router = { push: vi.fn(), replace: vi.fn((to) => (route.query = to.query)) }
vi.mock('vue-router', () => ({ useRouter: () => router, useRoute: () => route }))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }))

const manager = {
  name: 'tasks', label: 'Task', labelPlural: 'Tasks', routePrefix: 'task', idField: 'id', localFilterThreshold: 100, routeState: null,
  getListFields: () => [{ name: 'title', type: 'text', label: 'Title' }], getFieldConfig: () => null,
  list: vi.fn().mockResolvedValue({ items: [], total: 0 }), query: vi.fn().mockResolvedValue({ items: [], total: 0, fromCache: false }),
  delete: vi.fn(), invalidateCache: vi.fn(), canCreate: () => true, canUpdate: () => true, canDelete: () => true,
}

async function mountList(options = {}) {
  let list
  const w = mount({ template: '<div></div>', setup() {
    list = useListPage({ entity: 'tasks', ...options })
    list.addFilter('state', { options: [{ label: 'Open', value: 'open' }, { label: 'Done', value: 'done' }] })
    return {}
  } }, { global: { provide: { qdadmOrchestrator: { get: () => manager }, qdadmEntityFilters: {} } } })
  await flushPromises()
  return { list, w }
}

describe('a session key per page (#5440)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    route.query = {}
    vi.clearAllMocks()
  })

  it('two lists of one entity keep their own filters and sort; the address keeps the entity prefix', async () => {
    const it = await mountList({ sessionKey: 'tasks:universe:it' })
    it.list.updateFilters({ state: 'open' })
    it.list.onSort({ sortField: 'title', sortOrder: 1 })
    await flushPromises()
    expect(route.query).toMatchObject({ 'tasks.state': 'open' })
    expect(getSessionFilters('tasks:universe:it')).toEqual({ state: 'open' })
    expect(getSessionFilters('tasks')).toBe(null)
    it.w.unmount()

    // Another universe's page, a bare address: nothing of IT
    route.query = {}
    const b2c = await mountList({ sessionKey: 'tasks:universe:b2c' })
    expect(b2c.list.filterValues.value.state).toBe(null)
    expect(b2c.list.sortField.value).not.toBe('title')
    b2c.list.onSort({ sortField: 'state', sortOrder: -1 })
    await flushPromises()
    b2c.w.unmount()

    // The global list (no sessionKey): its own memory, the entity's
    route.query = {}
    const all = await mountList()
    expect(all.list.filterValues.value.state).toBe(null)
    expect(all.list.sortField.value).not.toBe('title')
    expect(all.list.sortField.value).not.toBe('state')
    all.w.unmount()

    // Back to IT: its filter (into the address, #5425) and its sort
    route.query = {}
    const again = await mountList({ sessionKey: 'tasks:universe:it' })
    expect(again.list.filterValues.value.state).toBe('open')
    expect(route.query).toMatchObject({ 'tasks.state': 'open' })
    expect(again.list.sortField.value).toBe('title')
    again.w.unmount()
  })

  it('a link naming a filter drops that page\'s session others, not another page\'s (#5428)', async () => {
    const a = await mountList({ sessionKey: 'k:a' })
    a.list.updateFilters({ state: 'open' })
    a.list.searchQuery.value = 'boom'
    await new Promise((r) => setTimeout(r, 350))
    await flushPromises()
    a.w.unmount()
    route.query = { 'tasks.state': 'done' }
    const b = await mountList({ sessionKey: 'k:a' })
    expect(b.list.filterValues.value.state).toBe('done')
    expect(b.list.searchQuery.value).toBe('')
    b.w.unmount()
  })
})
