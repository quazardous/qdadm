/**
 * OAuthCallbackPage after a successful login (#4329): `auth:login` remounts
 * the app (Kernel._setupAuthInvalidation). Signalled while still on the
 * callback route, the page mounted a second time, called completeLogin again
 * and flashed "no login attempt pending". The error state must never show.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { Kernel } from '../../src/kernel/Kernel'
import OAuthCallbackPage from '../../src/components/pages/OAuthCallbackPage.vue'

function fakeAdapter() {
  let pending = true
  let authenticated = false
  return {
    completeLogin: vi.fn(async (query) => {
      if (query.error) throw new Error(`[OAuthCodeAdapter] provider refused the login: ${query.error}`)
      // The attempt is consumed on read, as in OAuthCodeAdapter
      if (!pending) throw new Error('[OAuthCodeAdapter] no login attempt pending for this callback')
      pending = false
      await new Promise((r) => setTimeout(r, 5))
      authenticated = true
      return { user: { username: 'bob' }, redirectTo: '/home' }
    }),
    isAuthenticated: () => authenticated,
  }
}

async function bootApp(adapter, url) {
  // The real signal bus and auth invalidation; the root keyed like Kernel.vue.ts
  const kernel = new Kernel({ root: {}, moduleDefs: [] })
  kernel._createSignalBus()
  kernel._setupAuthInvalidation()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/auth/callback', component: OAuthCallbackPage },
      { path: '/home', component: { template: '<div class="home">Home</div>' } },
      { path: '/login', component: { template: '<div class="login">Login</div>' } },
    ],
  })
  const errorsSeen = []
  const observer = new MutationObserver(() => {
    const el = document.querySelector('.qdadm-oauth-icon-error')
    if (el) errorsSeen.push(document.querySelector('.qdadm-oauth-message')?.textContent)
  })
  observer.observe(document.body, { childList: true, subtree: true })
  await router.push(url)
  await router.isReady()
  const Root = defineComponent({ setup: () => () => h(RouterView, { key: kernel._appKey.value }) })
  const wrapper = mount(Root, {
    attachTo: document.body,
    global: {
      plugins: [router],
      provide: { authAdapter: adapter, qdadmSignals: kernel.signals },
      stubs: { QdButton: { props: ['label'], template: '<button>{{ label }}</button>' } },
    },
  })
  for (let i = 0; i < 10; i++) {
    await flushPromises()
    await new Promise((r) => setTimeout(r, 5))
  }
  observer.disconnect()
  return { wrapper, router, kernel, errorsSeen }
}

let app
afterEach(() => app?.wrapper.unmount())

describe('OAuthCallbackPage and the auth:login remount (#4329)', () => {
  it('never shows the error state, calls completeLogin once, lands on the target', async () => {
    const adapter = fakeAdapter()
    app = await bootApp(adapter, '/auth/callback?code=abc&state=s1')
    expect(app.errorsSeen).toEqual([])
    expect(adapter.completeLogin).toHaveBeenCalledTimes(1)
    expect(app.router.currentRoute.value.path).toBe('/home')
    expect(app.kernel._appKey.value).toBe(1) // the remount did happen, on /home
  })

  it('back on the callback while signed in (reload, back button): redirects without an error', async () => {
    const adapter = fakeAdapter()
    await adapter.completeLogin({ code: 'used', state: 's0' })
    app = await bootApp(adapter, '/auth/callback?code=used&state=s0')
    expect(app.errorsSeen).toEqual([])
    expect(app.router.currentRoute.value.path).toBe('/')
  })

  it('a real failure still shows the error', async () => {
    app = await bootApp(fakeAdapter(), '/auth/callback?error=access_denied&state=s1')
    expect(app.errorsSeen.at(-1)).toContain('access_denied')
    expect(app.router.currentRoute.value.path).toBe('/auth/callback')
  })

  it('two mounts of the same callback share one completion', async () => {
    const adapter = fakeAdapter()
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/auth/callback', component: OAuthCallbackPage }, { path: '/home', component: { template: '<div />' } }] })
    await router.push('/auth/callback?code=xyz&state=s2')
    const opts = { global: { plugins: [router], provide: { authAdapter: adapter, qdadmSignals: { emit: vi.fn() } }, stubs: { QdButton: true } } }
    const one = mount(OAuthCallbackPage, opts)
    const two = mount(OAuthCallbackPage, opts)
    await new Promise((r) => setTimeout(r, 20))
    await flushPromises()
    expect(adapter.completeLogin).toHaveBeenCalledTimes(1)
    expect(two.find('.qdadm-oauth-icon-error').exists()).toBe(false)
    one.unmount()
    two.unmount()
  })
})
