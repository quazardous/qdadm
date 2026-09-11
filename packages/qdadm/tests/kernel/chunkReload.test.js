/**
 * A lazy page whose chunk is gone after a deploy (#2295): reload once at the page the user wanted, then report.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { installChunkReload, isChunkLoadError, CHUNK_RELOAD_KEY } from '../../src/kernel/chunkReload'

const Page = { render: () => null }
const gone = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: https://admin.example/assets/RunList-DaGSh1IZ.js'))
const broken = () => Promise.reject(new Error('RunList.vue: setup crashed'))

function memoryStorage() {
  const data = new Map()
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  }
}

async function setup({ storage = memoryStorage(), target = new EventTarget(), start = '/' } = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Page },
      { path: '/books', component: Page },
      { path: '/runs', component: gone },
      { path: '/crash', component: broken },
    ],
  })
  const reload = vi.fn()
  const notify = vi.fn()
  installChunkReload(router, { storage, reload, notify, target })
  if (start) await router.push(start)
  return { router, reload, notify, storage, target }
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('a lazy page chunk that fails to load (#2295)', () => {
  it('recognises chunk load failures from each browser, and nothing else', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/a.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://x/a.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/RunList-DaGSh1IZ.css'))).toBe(true)
    expect(isChunkLoadError(Object.assign(new Error('Loading chunk 42 failed.'), { name: 'ChunkLoadError' }))).toBe(true)
    expect(isChunkLoadError(new Error('RunList.vue: setup crashed'))).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
  })

  it('reloads once, at the page the user was going to', async () => {
    const { router, reload, notify, storage } = await setup()

    await expect(router.push('/runs')).rejects.toThrow(/dynamically imported module/)

    expect(reload).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledWith('/runs')
    expect(storage.data.has(CHUNK_RELOAD_KEY)).toBe(true)
    expect(notify).not.toHaveBeenCalled()
  })

  it('after a reload that did not help, reports instead of reloading again', async () => {
    const storage = memoryStorage()
    storage.setItem(CHUNK_RELOAD_KEY, '1789000000000')
    // The reload landed on the page that fails: it is the first navigation.
    const { router, reload, notify } = await setup({ storage, start: null })

    await expect(router.push('/runs')).rejects.toThrow()

    expect(reload).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('a navigation that succeeds clears the flag, so the next deploy reloads again', async () => {
    const storage = memoryStorage()
    storage.setItem(CHUNK_RELOAD_KEY, '1789000000000')
    const { router, reload } = await setup({ storage })

    await router.push('/books')
    expect(storage.data.has(CHUNK_RELOAD_KEY)).toBe(false)

    await expect(router.push('/runs')).rejects.toThrow()
    expect(reload).toHaveBeenCalledWith('/runs')
  })

  it('a failure Vite and the router both report is reported once', async () => {
    const storage = memoryStorage()
    storage.setItem(CHUNK_RELOAD_KEY, '1789000000000')
    const { router, reload, notify, target } = await setup({ storage, start: null })

    target.dispatchEvent(new Event('vite:preloadError'))
    await expect(router.push('/runs')).rejects.toThrow()
    await new Promise((r) => setTimeout(r, 0))

    expect(reload).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('leaves other errors alone', async () => {
    const { router, reload, notify, storage } = await setup()

    await expect(router.push('/crash')).rejects.toThrow('setup crashed')

    expect(reload).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
    expect(storage.data.size).toBe(0)
  })

  it('without storage to guard a reload, reports and never reloads', async () => {
    const { router, reload, notify } = await setup({ storage: null })

    await expect(router.push('/runs')).rejects.toThrow()

    expect(reload).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('vite:preloadError outside a navigation reloads the current page; within one, the router goes first', async () => {
    const { router, reload, target } = await setup()

    target.dispatchEvent(Object.assign(new Event('vite:preloadError'), { payload: new Error('Unable to preload CSS for /assets/a.css') }))
    await expect(router.push('/runs')).rejects.toThrow()
    await new Promise((r) => setTimeout(r, 0))

    expect(reload).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledWith('/runs')

    const alone = await setup()
    alone.target.dispatchEvent(new Event('vite:preloadError'))
    await new Promise((r) => setTimeout(r, 0))
    expect(alone.reload).toHaveBeenCalledTimes(1)
  })
})
