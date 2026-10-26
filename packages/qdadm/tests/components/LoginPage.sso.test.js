/**
 * LoginPage, identity provider first (#4321): the SSO button leads, the local
 * form is a fallback (open, collapsed, hidden), a link to the provider's
 * portal, a subtitle and a brand logo.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LoginPage from '../../src/components/pages/LoginPage.vue'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const QdButton = {
  inheritAttrs: false,
  props: ['label', 'as', 'href', 'loading'],
  emits: ['click'],
  template: `<a v-if="as === 'a'" :href="href" v-bind="$attrs">{{ label }}</a>
             <button v-else v-bind="$attrs" @click="$emit('click', $event)">{{ label }}</button>`,
}

function mountLogin(props = {}, adapter = {}, slots = {}) {
  return mount(LoginPage, {
    props,
    slots,
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
}

const form = (w) => w.find('form.qdadm-login-form')
const visible = (el) => el.exists() && el.element.style.display !== 'none'

let wrapper
afterEach(() => wrapper?.unmount())

describe('LoginPage with sso (#4321)', () => {
  it('without sso, the page is unchanged: the form is shown, no SSO block', () => {
    wrapper = mountLogin()
    expect(wrapper.find('.qdadm-login-sso').exists()).toBe(false)
    expect(visible(form(wrapper))).toBe(true)
  })

  it('collapsed: the SSO button first, the form hidden until the disclosure opens it', async () => {
    wrapper = mountLogin({ sso: { label: 'Sign in with Acme', start: async () => {} }, localFallback: 'collapsed', localFallbackLabel: 'Local account' })
    const sso = wrapper.find('.qdadm-login-sso-button')
    expect(sso.text()).toBe('Sign in with Acme')
    expect(visible(form(wrapper))).toBe(false)
    const toggle = wrapper.find('.qdadm-login-fallback-toggle')
    expect(toggle.text()).toBe('Local account')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    await flushPromises()
    expect(visible(form(wrapper))).toBe(true)
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(document.activeElement?.id).toBe('qdadm-username')
  })

  it('open: the form below an "or" divider; hidden: no form at all', () => {
    wrapper = mountLogin({ sso: { start: async () => {} } })
    expect(wrapper.find('.qdadm-login-sso .qdadm-login-divider').exists()).toBe(true)
    expect(visible(form(wrapper))).toBe(true)
    wrapper.unmount()
    wrapper = mountLogin({ sso: { start: async () => {} }, localFallback: 'hidden' })
    expect(form(wrapper).exists()).toBe(false)
  })

  it('keeps the footer and alternatives shown when the form is collapsed or hidden', () => {
    const slots = { footer: '<p class="hint">Help</p>', alternatives: '<button class="other">Other</button>' }
    wrapper = mountLogin({ sso: { start: async () => {} }, localFallback: 'hidden' }, {}, slots)
    expect(wrapper.find('.qdadm-login-after .hint').exists()).toBe(true)
    expect(wrapper.find('.qdadm-login-after .other').exists()).toBe(true)
    wrapper.unmount()
    // Without sso they stay inside the form, as before
    wrapper = mountLogin({}, {}, slots)
    expect(wrapper.find('form .hint').exists()).toBe(true)
    expect(wrapper.find('.qdadm-login-after').exists()).toBe(false)
  })

  it('hidden without sso keeps the form, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    wrapper = mountLogin({ localFallback: 'hidden' })
    expect(visible(form(wrapper))).toBe(true)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('needs `sso`'))
    warn.mockRestore()
  })

  it('calls start, and shows its error above the button', async () => {
    const start = vi.fn(async () => {
      throw new Error('The provider is down')
    })
    wrapper = mountLogin({ sso: { label: 'Go', start } })
    await wrapper.find('.qdadm-login-sso-button').trigger('click')
    await flushPromises()
    expect(start).toHaveBeenCalledOnce()
    expect(wrapper.find('.qdadm-login-sso .msg').text()).toBe('The provider is down')
    expect(wrapper.emitted('error')).toHaveLength(1)
  })

  it('without href or start, calls the adapter beginLogin with redirectTo', async () => {
    const beginLogin = vi.fn(async () => {})
    wrapper = mountLogin({ sso: { label: 'Go' }, redirectTo: '/home' }, { beginLogin })
    await wrapper.find('.qdadm-login-sso-button').trigger('click')
    await flushPromises()
    expect(beginLogin).toHaveBeenCalledWith('/home')
  })

  it('href renders a link; providerHome opens in a new tab', () => {
    wrapper = mountLogin({
      sso: { label: 'Go', href: '/auth/oidc/start' },
      providerHome: { label: 'My Acme account', href: 'https://id.acme.test' },
    })
    expect(wrapper.find('a.qdadm-login-sso-button').attributes('href')).toBe('/auth/oidc/start')
    const home = wrapper.find('a.qdadm-login-provider-home')
    expect(home.text()).toContain('My Acme account')
    expect(home.attributes()).toMatchObject({ href: 'https://id.acme.test', target: '_blank', rel: 'noopener noreferrer' })
  })

  it('shows the error prop, the subtitle and the brand logo', () => {
    wrapper = mountLogin({ sso: { label: 'Go' }, error: 'access_denied', subtitle: 'Staff hub', brandLogo: '/brand.svg' })
    expect(wrapper.find('.qdadm-login-sso .msg').text()).toBe('access_denied')
    expect(wrapper.find('.qdadm-login-subtitle').text()).toBe('Staff hub')
    expect(wrapper.find('img.qdadm-login-brand').attributes('src')).toBe('/brand.svg')
  })
})
