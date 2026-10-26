/**
 * The sessions module (#4336): the REST adapter's calls, the heartbeat
 * (visible tab, logout), the "Also signed in" banner, the Sessions page
 * (mine marked, Close with a reason, the history notice).
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { restSessionsAdapter } from '../../src/sessions/sessionsAdapter'
import { createPresence } from '../../src/sessions/presence'
import { SessionsModule, SESSIONS_BANNER_ID, sinceText } from '../../src/sessions/SessionsModule'
import { getAppBannerStore } from '../../src/composables/useAppBanner'
import SessionsPage from '../../src/sessions/SessionsPage.vue'

/** A fake server: sessions keyed by id, each with a login and its tabs */
function fakeServer() {
  const sessions = new Map()
  const history = []
  return {
    sessions,
    history,
    open(id, login) {
      sessions.set(id, { id, login, via: 'local', since: new Date(Date.now() - 10 * 60000).toISOString(), seen: new Date().toISOString(), tabs: new Set() })
      history.unshift({ at: new Date().toISOString(), event: 'login', login, via: 'local' })
    },
    leave(id) {
      sessions.delete(id)
    },
    adapterFor(sessionId, extra = {}) {
      return {
        heartbeat: vi.fn(async (tab) => {
          sessions.get(sessionId)?.tabs.add(tab)
          // My own session (all my tabs) is not "others"
          const others = [...sessions.values()].filter((s) => s.id !== sessionId).map(({ tabs, ...s }) => ({ ...s, tabs: tabs.size }))
          return { others }
        }),
        list: vi.fn(async () => ({ sessions: [...sessions.values()].map(({ tabs, ...s }) => ({ ...s, tabs: tabs.size, ip: '10.0.0.1' })), mine: sessionId })),
        history: vi.fn(async ({ limit, offset }) => ({ history: history.slice(offset, offset + limit), notice: extra.notice ?? null })),
        close: vi.fn(async (id, reason) => {
          const s = sessions.get(id)
          sessions.delete(id)
          history.unshift({ at: new Date().toISOString(), event: 'closed', login: s?.login, by: 'admin', reason })
        }),
      }
    },
  }
}

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})
afterEach(() => {
  vi.useRealTimers()
  getAppBannerStore().hide(SESSIONS_BANNER_ID)
})

describe('restSessionsAdapter (#4336)', () => {
  it('speaks the contract, and maps a server-specific history notice', async () => {
    const calls = []
    const fetch = vi.fn(async (url, init = {}) => {
      calls.push(`${init.method ?? 'GET'} ${url} ${init.body ?? ''}`.trim())
      const body = url.includes('history') ? { history: [], admi_id: 'injoignable' } : url.includes('heartbeat') ? { others: [{ id: 2, login: 'june' }] } : {}
      return new Response(JSON.stringify(body), { status: 200 })
    })
    const a = restSessionsAdapter('/api/sessions/', { fetch, historyNotice: (b) => (b.admi_id === 'injoignable' ? 'Provider history unavailable' : null) })
    expect((await a.heartbeat('t1')).others[0].login).toBe('june')
    await a.list()
    expect((await a.history({ limit: 26, offset: 25 })).notice).toBe('Provider history unavailable')
    await a.close(7, 'left the company')
    expect(calls).toEqual([
      'POST /api/sessions/heartbeat {"tab":"t1"}',
      'GET /api/sessions',
      'GET /api/sessions/history?limit=26&offset=25',
      'DELETE /api/sessions/7?reason=left%20the%20company',
    ])
  })

  it('canClose: false gives no close()', () => {
    expect(restSessionsAdapter('/s', { canClose: false, fetch: vi.fn() }).close).toBeUndefined()
  })
})

describe('presence and the banner (#4336)', () => {
  it('two tabs of one person do not see each other; another person brings the banner, which leaves with them', async () => {
    const server = fakeServer()
    server.open('s-bob', 'bob')
    const signals = {}
    const ctx = {
      i18n: null,
      auth: { isAuthenticated: () => true },
      on: (name, fn) => (signals[name] = fn),
      routes: vi.fn(),
      navItem: vi.fn(),
    }
    const adapter = server.adapterFor('s-bob')
    const module = new SessionsModule({ adapter, interval: 30, bannerSeverity: 'warn' })
    await module.connect(ctx)
    // A second tab of bob, same session
    const tab2 = createPresence({ adapter: server.adapterFor('s-bob'), interval: 30, onOthers: () => {} })
    tab2.start()
    await flushPromises()
    const banner = () => getAppBannerStore().runtime.value.find((e) => e.message.id === SESSIONS_BANNER_ID)?.message
    expect(banner()).toBeUndefined()

    server.open('s-june', 'june')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(banner()).toMatchObject({ text: 'Also signed in: june (since 10 min)', severity: 'warn' })

    server.leave('s-june')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(banner()).toBeUndefined()

    // Logout stops the beats
    signals['auth:logout']()
    const beats = adapter.heartbeat.mock.calls.length
    await vi.advanceTimersByTimeAsync(120_000)
    expect(adapter.heartbeat.mock.calls.length).toBe(beats)
    // ...and login starts them again
    signals['auth:login']()
    await flushPromises()
    expect(adapter.heartbeat.mock.calls.length).toBe(beats + 1)
    tab2.stop()
    await module.disconnect()
  })

  it('no beats while the tab is hidden; one at once when it comes back', async () => {
    const server = fakeServer()
    server.open('s-bob', 'bob')
    const adapter = server.adapterFor('s-bob')
    const p = createPresence({ adapter, interval: 30, onOthers: () => {} })
    p.start()
    await flushPromises()
    expect(adapter.heartbeat).toHaveBeenCalledTimes(1)
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(120_000)
    expect(adapter.heartbeat).toHaveBeenCalledTimes(1)
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(adapter.heartbeat).toHaveBeenCalledTimes(2)
    p.stop()
  })

  it('sinceText', () => {
    const now = Date.parse('2026-10-26T10:00:00Z')
    expect(sinceText('2026-10-26T09:50:00Z', now)).toBe('10 min')
    expect(sinceText('2026-10-26T07:00:00Z', now)).toBe('3 h')
    expect(sinceText(undefined, now)).toBe('')
  })
})

describe('SessionsPage (#4336)', () => {
  async function mountPage(server, options = {}) {
    const module = new SessionsModule({ adapter: server.adapterFor('s-admin', options), permission: 'admin:sessions' })
    await module.connect({ i18n: null, auth: { isAuthenticated: () => false }, on: () => {}, routes: vi.fn(), navItem: vi.fn() })
    const wrapper = mount(SessionsPage, {
      attachTo: document.body,
      global: { plugins: [PrimeVue], directives: { tooltip: {} }, stubs: { teleport: true }, provide: { qdadmSecurityChecker: { isGranted: () => true } } },
    })
    await flushPromises()
    return { wrapper, module }
  }

  it('marks my session, closes another with a required reason, and shows it in the history', async () => {
    const server = fakeServer()
    server.open('s-admin', 'admin')
    server.open('s-june', 'june')
    const { wrapper, module } = await mountPage(server)
    expect(wrapper.find('[data-session-id="s-admin"] .qd-sessions-badge').exists()).toBe(true)
    expect(wrapper.find('[data-session-id="s-admin"] .qd-sessions-actions button').exists()).toBe(false)
    expect(wrapper.text()).toContain('10.0.0.1')

    await wrapper.find('[data-session-id="s-june"] .qd-sessions-actions button').trigger('click')
    await flushPromises()
    const confirm = () => [...document.querySelectorAll('.p-dialog-footer button')].find((b) => b.textContent.includes('Close'))
    expect(confirm().disabled).toBe(true)
    const textarea = document.querySelector('#qd-sessions-reason')
    textarea.value = 'shared account'
    textarea.dispatchEvent(new Event('input'))
    await flushPromises()
    confirm().click()
    await flushPromises()
    expect(server.sessions.has('s-june')).toBe(false)
    expect(wrapper.find('[data-session-id="s-june"]').exists()).toBe(false)
    expect(wrapper.find('.qd-sessions-event--closed').text()).toContain('shared account')
    wrapper.unmount()
    await module.disconnect()
  })

  it('shows the history notice', async () => {
    const server = fakeServer()
    server.open('s-admin', 'admin')
    const { wrapper, module } = await mountPage(server, { notice: 'The provider history is unavailable' })
    expect(wrapper.find('.qd-sessions-notice').text()).toContain('The provider history is unavailable')
    wrapper.unmount()
    await module.disconnect()
  })
})
