/**
 * Back to the page asked for after a login (#5524): the guard and the expiry
 * pass `?redirect=`, the login page and the OAuth callback honour it, and only
 * a local path is ever followed.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Kernel } from '../../src/kernel/Kernel'
import { safeRedirect } from '../../src/auth/safeRedirect'

const push = vi.fn()
const currentRoute = { value: { query: {} } }
vi.mock('vue-router', () => ({ useRouter: () => ({ push, currentRoute }) }))
const LoginPage = (await import('../../src/components/pages/LoginPage.vue')).default

afterEach(() => {
  vi.restoreAllMocks()
  push.mockClear()
  currentRoute.value = { query: {} }
})

describe('safeRedirect (#5524)', () => {
  it('keeps a local path, with its query and hash', () => {
    expect(safeRedirect('/books/12/edit?tab=loans#notes')).toBe('/books/12/edit?tab=loans#notes')
    expect(safeRedirect(['/tasks/3'])).toBe('/tasks/3')
  })
  it('refuses anything that could leave the app', () => {
    for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', '\\\\evil.com', 'javascript:alert(1)', 'evil.com', '/a\nb', '', null, undefined, 42]) {
      expect(safeRedirect(bad, '/home')).toBe('/home')
    }
  })
})

describe('the guard passes the page asked for (#5524)', () => {
  const guardWith = () => {
    let guard = null
    const kernel = {
      options: { authAdapter: { isAuthenticated: () => false }, debug: false },
      signals: { on: vi.fn(), emit: vi.fn() },
      orchestrator: { isRegistered: vi.fn(), get: vi.fn(), toast: { error: vi.fn(), warn: vi.fn() } },
      router: { beforeEach: vi.fn((fn) => { guard = fn }), hasRoute: (name) => name === 'login' },
    }
    Kernel.prototype._setupAuthGuard.call(kernel)
    return guard
  }
  const privateRoute = (fullPath, name = 'book-edit') => ({ name, path: fullPath.split('?')[0], fullPath, matched: [{ meta: { requiresAuth: true } }], meta: {} })

  it('a protected deep link: to login with redirect', () => {
    expect(guardWith()(privateRoute('/books/12/edit?tab=loans'), {})).toEqual({ name: 'login', query: { redirect: '/books/12/edit?tab=loans' } })
  })
  it('the home page: no redirect', () => {
    expect(guardWith()(privateRoute('/', 'home'), {})).toEqual({ name: 'login' })
  })
})

describe('the expiry passes the page that was open (#5524)', () => {
  it('to login with expired and redirect', async () => {
    const kernel = new Kernel({ root: {}, moduleDefs: [], authAdapter: { isAuthenticated: () => true, getToken: () => 't', logout: vi.fn() } })
    kernel._createOrchestrator()
    kernel.router = { currentRoute: { value: { name: 'task', fullPath: '/tasks/7?universe=client' } }, push: vi.fn() }
    kernel._setupAuthExpiredHandler()
    await kernel.signals.emit('auth:expired', { status: 401 })
    expect(kernel.router.push).toHaveBeenCalledWith({ name: 'login', query: { expired: '1', redirect: '/tasks/7?universe=client' } })
  })
})

describe('the login page honours ?redirect= (#5524)', () => {
  const QdButton = {
    inheritAttrs: false,
    props: ['label', 'as', 'href', 'loading'],
    emits: ['click'],
    template: `<button v-bind="$attrs" @click="$emit('click', $event)">{{ label }}</button>`,
  }
  const mountLogin = (props = {}, adapter = {}) =>
    mount(LoginPage, {
      props,
      attachTo: document.body,
      global: {
        provide: {
          authAdapter: { login: async () => ({ user: {} }), ...adapter },
          qdadmOrchestrator: { toast: { success: vi.fn(), error: vi.fn() }, signals: { emit: vi.fn() } },
          qdadmApp: { name: 'Hub' },
        },
        stubs: {
          Card: { template: '<div><slot name="title" /><slot name="content" /></div>' },
          InputText: { props: ['modelValue', 'id'], template: '<input :id="id" />' },
          Password: { props: ['modelValue', 'inputId'], template: '<input type="password" :id="inputId" />' },
          QdMessage: { template: '<div class="msg"><slot /></div>' },
          QdButton,
        },
      },
    })

  it('OAuth: beginLogin gets the page asked for', async () => {
    currentRoute.value = { query: { redirect: '/tasks/7' } }
    const beginLogin = vi.fn(async () => {})
    const w = mountLogin({ sso: { label: 'Go' }, redirectTo: '/home' }, { beginLogin })
    await w.find('.qdadm-login-sso-button').trigger('click')
    await flushPromises()
    expect(beginLogin).toHaveBeenCalledWith('/tasks/7')
    w.unmount()
  })

  it('an unsafe redirect falls back to the redirectTo prop', async () => {
    currentRoute.value = { query: { redirect: 'https://evil.com' } }
    const beginLogin = vi.fn(async () => {})
    const w = mountLogin({ sso: { label: 'Go' }, redirectTo: '/home' }, { beginLogin })
    await w.find('.qdadm-login-sso-button').trigger('click')
    await flushPromises()
    expect(beginLogin).toHaveBeenCalledWith('/home')
    w.unmount()
  })
})
