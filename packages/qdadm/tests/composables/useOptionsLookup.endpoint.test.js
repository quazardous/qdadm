/**
 * Unit tests for useOptionsLookup endpoint routing (qdadm #1198).
 *
 * Precedence: via:'entityName' storage > relative endpoint → kernel
 * apiClient (base URL + auth) > raw fetch (absolute URL escape hatch, or
 * legacy relative call with a warning).
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { useOptionsLookup } from '../../src/composables/useOptionsLookup'

const ITEMS = [
  { id: 't1', name: 'Type One' },
  { id: 't2', name: 'Type Two' },
]

function mountLookup(config, provide = {}) {
  let lookup
  const Comp = defineComponent({
    setup() {
      lookup = useOptionsLookup(config)
      return () => null
    },
  })
  const wrapper = mount(Comp, { global: { provide } })
  return { get lookup() { return lookup }, wrapper }
}

function fetchResponse(body, { status = 200, contentType = 'application/json' } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => (k.toLowerCase() === 'content-type' ? contentType : null) },
    json: async () => {
      if (typeof body === 'string') throw new Error('Unexpected token <')
      return body
    },
  }
}

let warnSpy
let fetchMock

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  fetchMock = vi.fn(async () => fetchResponse({ data: ITEMS }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useOptionsLookup — endpoint routing (#1198)', () => {
  it('routes a RELATIVE endpoint through the kernel apiClient (no raw fetch, no warn)', async () => {
    const client = { get: vi.fn(async () => ({ data: { data: ITEMS } })) }
    const ctx = mountLookup(
      { endpoint: '/api/admin/task-types', label: 'name', value: 'id' },
      { qdadmApiClient: client },
    )
    await flushPromises()

    expect(client.get).toHaveBeenCalledWith('/api/admin/task-types')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(ctx.lookup.options.value).toEqual([
      { label: 'Type One', value: 't1' },
      { label: 'Type Two', value: 't2' },
    ])
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('accepts a factory as apiClient source', async () => {
    const client = { get: vi.fn(async () => ({ data: ITEMS })) }
    const ctx = mountLookup(
      { endpoint: '/api/tags' },
      { qdadmApiClient: () => client },
    )
    await flushPromises()

    expect(client.get).toHaveBeenCalledWith('/api/tags')
    expect(ctx.lookup.error.value).toBeNull()
  })

  it('fetches an ABSOLUTE URL raw even when a kernel client is registered (escape hatch)', async () => {
    const client = { get: vi.fn() }
    mountLookup(
      { endpoint: 'https://api.example.com/things', headers: { Authorization: 'Bearer x' } },
      { qdadmApiClient: client },
    )
    await flushPromises()

    expect(client.get).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.com/things')
    expect(init.headers.Authorization).toBe('Bearer x')
  })

  it("routes through via:'entityName' storage.request in priority over the kernel client", async () => {
    const request = vi.fn(async () => ({ data: ITEMS }))
    // useOrchestrator wraps the injected orchestrator: getManager → orchestrator.get(name)
    const orchestrator = { get: () => ({ storage: { request } }), has: () => true }
    const client = { get: vi.fn() }
    const ctx = mountLookup(
      { endpoint: '/api/admin/task-types', via: 'catalog', label: 'name', value: 'id' },
      { qdadmOrchestrator: orchestrator, qdadmApiClient: client },
    )
    await flushPromises()

    expect(request).toHaveBeenCalledWith('GET', '/api/admin/task-types')
    expect(client.get).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(ctx.lookup.options.value).toHaveLength(2)
  })

  it('falls back to a bare fetch for a relative endpoint with NO kernel client — and warns', async () => {
    const ctx = mountLookup({ endpoint: '/api/legacy' })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(ctx.lookup.options.value).toHaveLength(2)
    const warned = warnSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(warned).toContain('fetched bare')
    expect(warned).toContain('Kernel({ apiClient })')
  })

  it('warns with an auth hint on 401 (raw path) and sets the error ref', async () => {
    fetchMock.mockResolvedValueOnce(fetchResponse({}, { status: 401 }))
    const ctx = mountLookup({ endpoint: 'https://api.example.com/secure' })
    await flushPromises()

    expect(ctx.lookup.error.value).toBe('HTTP 401')
    const warned = warnSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(warned).toContain('HTTP 401')
    expect(warned).toContain('missing auth')
  })

  it('warns when the response is not JSON (HTML page case)', async () => {
    fetchMock.mockResolvedValueOnce(
      fetchResponse('<!doctype html>', { contentType: 'text/html' }),
    )
    const ctx = mountLookup({ endpoint: 'https://app.example.com/api/oops' })
    await flushPromises()

    const warned = warnSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(warned).toContain('not JSON')
    expect(ctx.lookup.error.value).not.toBeNull()
  })
})
