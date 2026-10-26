/**
 * LoginPage labels (#4326): every text overridable, static (a string) or
 * dynamic (a function called at render); the open local form's title; short
 * defaults in en and fr.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import LoginPage from '../../src/components/pages/LoginPage.vue'
import { I18N_INJECTION_KEY } from '../../src/i18n/useI18n'
import { I18n } from '../../src/i18n/I18n'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const toast = { success: vi.fn(), error: vi.fn() }

async function mountLogin(props = {}, { locale = null, login } = {}) {
  const provide = {
    authAdapter: { login: login ?? (async () => ({ user: { username: 'bob' } })) },
    qdadmOrchestrator: { toast, signals: { emit: vi.fn() } },
    qdadmApp: { name: 'Hub' },
  }
  if (locale) {
    const i18n = new I18n({ defaultLocale: locale })
    await i18n.bootstrap()
    provide[I18N_INJECTION_KEY] = i18n
  }
  return mount(LoginPage, {
    props,
    global: {
      provide,
      stubs: {
        Card: { template: '<div><slot name="title" /><slot name="content" /></div>' },
        InputText: { props: ['modelValue'], template: '<input />' },
        Password: { props: ['modelValue'], template: '<input type="password" />' },
        QdMessage: { template: '<div class="msg"><slot /></div>' },
        QdButton: { inheritAttrs: false, props: ['label', 'as', 'href'], emits: ['click'], template: '<button v-bind="$attrs" @click="$emit(\'click\')">{{ label }}</button>' },
      },
    },
  })
}

const section = (w) => w.find('.qdadm-login-sso .qdadm-login-divider').text()

let wrapper
afterEach(() => {
  wrapper?.unmount()
  toast.success.mockReset()
})

describe('LoginPage labels (#4326)', () => {
  it('open mode titles the local form: by default, by labels.localSection, or "or" with an empty one', async () => {
    const sso = { start: async () => {} }
    wrapper = await mountLogin({ sso })
    expect(section(wrapper)).toBe('Alternative login')
    wrapper.unmount()
    wrapper = await mountLogin({ sso, labels: { localSection: 'Staff without an Acme account' } })
    expect(section(wrapper)).toBe('Staff without an Acme account')
    wrapper.unmount()
    wrapper = await mountLogin({ sso, labels: { localSection: '' } })
    expect(section(wrapper)).toBe('or')
  })

  it('a dynamic label follows what it reads', async () => {
    const who = ref('Acme')
    wrapper = await mountLogin({ sso: { start: async () => {} }, labels: { sso: () => `Sign in with ${who.value}` } })
    expect(wrapper.find('.qdadm-login-sso-button').text()).toBe('Sign in with Acme')
    who.value = 'Globex'
    await nextTick()
    expect(wrapper.find('.qdadm-login-sso-button').text()).toBe('Sign in with Globex')
  })

  it('labels win over the single props, which win over the catalogue', async () => {
    wrapper = await mountLogin({ usernameLabel: 'Login', passwordLabel: 'Secret', labels: { username: 'Staff number' } })
    expect(wrapper.findAll('label').map((l) => l.text())).toEqual(['Staff number', 'Secret'])
  })

  it('toasts too: a string with {name}, and a function given the params', async () => {
    wrapper = await mountLogin({ labels: { welcome: 'Hello', loggedInAs: ({ params }) => `You are ${params.name}` } })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(toast.success).toHaveBeenCalledWith('Hello', 'You are bob', 'LoginPage')
    wrapper.unmount()
    toast.success.mockReset()
    wrapper = await mountLogin({ labels: { loggedInAs: 'Signed in as {name}' } })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(toast.success.mock.calls[0][1]).toBe('Signed in as bob')
  })

  it('short defaults, in en and fr', async () => {
    const props = { sso: { start: async () => {} }, providerHome: { href: 'https://id.test' } }
    wrapper = await mountLogin(props, { locale: 'en' })
    expect(wrapper.find('.qdadm-login-sso-button').text()).toBe('Sign in')
    expect(wrapper.find('.qdadm-login-provider-home').text()).toBe('My account')
    expect(section(wrapper)).toBe('Alternative login')
    wrapper.unmount()
    wrapper = await mountLogin({ ...props, localFallback: 'collapsed' }, { locale: 'fr' })
    expect(wrapper.find('.qdadm-login-sso-button').text()).toBe('Se connecter')
    expect(wrapper.find('.qdadm-login-provider-home').text()).toBe('Mon compte')
    expect(wrapper.find('.qdadm-login-fallback-toggle').text()).toBe('Login alternatif')
  })
})
