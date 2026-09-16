/**
 * Only the latest load writes (#2666).
 *
 * Live reloads and id changes can put two loads in flight. Whichever answer
 * lands last used to win — an older one put a past state back on screen, and
 * the first to finish cleared `loading` while the other was still pending.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { useEntityItemPage } from '../../src/composables/useEntityItemPage'

vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'offer-show', params: { id: '7' }, query: {} }),
  useRouter: () => ({ push: vi.fn(), resolve: vi.fn(() => ({ href: '' })) }),
}))

function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function mountPage(get) {
  const manager = { name: 'offers', label: 'Offer', idField: 'id', get, getEntityLabel: () => 'offer' }
  let page
  mount({ template: '<div />', setup() { page = useEntityItemPage({ entity: 'offers', loadOnMount: false }); return {} } }, {
    global: { provide: { qdadmOrchestrator: { get: () => manager, isRegistered: () => true } } },
  })
  return page
}

describe('useEntityItemPage.load() keeps the latest answer (#2666)', () => {
  it('an older answer landing last does not overwrite the newer one', async () => {
    const first = deferred()
    const second = deferred()
    const page = mountPage(vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise))

    const older = page.load('7')
    const newer = page.load('7')

    second.resolve({ id: 7, state: 'judged' })
    await flushPromises()
    first.resolve({ id: 7, state: 'judging' })
    await flushPromises()

    expect(page.data.value.state).toBe('judged')
    expect(await older).toBeNull()
    expect(await newer).toEqual({ id: 7, state: 'judged' })
  })

  it('keeps loading until the latest call settles', async () => {
    const first = deferred()
    const second = deferred()
    const page = mountPage(vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise))

    page.load('7')
    page.load('7')
    first.resolve({ id: 7 })
    await flushPromises()
    expect(page.loading.value).toBe(true)

    second.resolve({ id: 7 })
    await flushPromises()
    expect(page.loading.value).toBe(false)
  })

  it('a superseded call that fails leaves no error behind', async () => {
    const first = deferred()
    const second = deferred()
    const page = mountPage(vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    page.load('7')
    page.load('7')
    second.resolve({ id: 7, state: 'judged' })
    await flushPromises()
    first.reject(new Error('timeout'))
    await flushPromises()

    expect(page.error.value).toBeNull()
    expect(page.data.value.state).toBe('judged')
  })
})
