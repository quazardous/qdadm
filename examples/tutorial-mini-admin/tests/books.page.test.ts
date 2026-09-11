/**
 * Testing a page (docs/testing.md): the app's own Kernel, modules and pages, mounted in jsdom.
 *
 * The session is set in localStorage the way the auth adapter stores it, before the app is imported: the adapter
 * reads it when its module loads. Nothing is typed into a login form.
 *
 * Run: npm test -w examples/tutorial-mini-admin
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

beforeAll(() => {
  localStorage.clear()
  localStorage.setItem('my_admin_auth', JSON.stringify({ token: 'test-token', user: { id: '1', username: 'admin', role: 'ROLE_ADMIN' } }))
  // jsdom lays nothing out: PrimeVue asks these for its responsive parts.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterAll(() => {
  document.body.innerHTML = ''
  localStorage.clear()
})

async function bootApp() {
  // Imported after the session is in place — the same wiring as src/main.ts, without the agent connector and styles.
  const { Kernel } = await import('@quazardous/qdadm')
  const { AppLayout } = await import('@quazardous/qdadm/components')
  const { createLocalStorageRolesProvider } = await import('@quazardous/qdadm/security')
  const { default: PrimeVue } = await import('primevue/config')
  const { default: Aura } = await import('@primeuix/themes/aura')
  const { authAdapter } = await import('../src/auth/authAdapter')
  const { moduleDefs } = await import('../src/config/modules')
  const { default: App } = await import('../src/App.vue')

  const kernel = new Kernel({
    root: App,
    hashMode: true,
    moduleDefs,
    pages: { layout: AppLayout, login: () => import('../src/pages/Login.vue') },
    authAdapter,
    entityAuthAdapter: () => authAdapter.getUser(),
    security: {
      rolesProvider: createLocalStorageRolesProvider({
        key: 'my_admin_roles',
        defaults: {
          role_hierarchy: { ROLE_ADMIN: ['ROLE_USER'] },
          role_permissions: {
            ROLE_USER: ['entity:*:read', 'entity:*:list'],
            ROLE_ADMIN: ['entity:*:create', 'entity:*:update', 'entity:*:delete'],
          },
        },
      }),
    },
    homeRoute: { name: 'home', component: () => import('../src/pages/HomePage.vue') },
    primevue: { plugin: PrimeVue, theme: Aura },
    app: { name: 'My Admin' },
  })

  const host = document.createElement('div')
  document.body.appendChild(host)
  kernel.createApp().mount(host)
  return kernel
}

describe('the books list page', () => {
  it('shows the books from the storage, with the actions an admin may take', { timeout: 20000 }, async () => {
    const kernel = await bootApp()
    await kernel.router!.push('/books')

    try {
      await vi.waitFor(
        () => {
          expect(document.body.textContent).toContain('Dune')
          expect(document.body.textContent).toContain('Neuromancer')
        },
        { timeout: 15000, interval: 100 }
      )
    } catch (e) {
      // Say where the app is and what it shows, rather than only that the books never came.
      const route = kernel.router!.currentRoute.value.fullPath
      const text = (document.body.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 400)
      throw new Error(`No books on screen. Route: ${route}. Page text: "${text}"`, { cause: e })
    }
    const buttons = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim())
    expect(buttons).toContain('Add Book')
  })
})
