/**
 * LoginPage strings go through the catalogue (#4168): labels, button, divider
 * and toasts follow the locale; explicit props still win; welcomeToast: false
 * drops the success toast.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LoginPage from '../../src/components/pages/LoginPage.vue'
import { I18N_INJECTION_KEY } from '../../src/i18n/useI18n'
import { I18n } from '../../src/i18n/I18n'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const toast = { success: vi.fn(), error: vi.fn() }
const signals = { emit: vi.fn() }

async function mountLogin({ props = {}, locale = null, login } = {}) {
  const provide = {
    authAdapter: { login: login ?? (async () => ({ user: { username: 'e2e' } })) },
    qdadmOrchestrator: { toast, signals },
    qdadmApp: { name: 'Test' },
  }
  if (locale) {
    const i18n = new I18n({ defaultLocale: locale })
    await i18n.bootstrap()
    provide[I18N_INJECTION_KEY] = i18n
  }
  return mount(LoginPage, {
    props,
    slots: { alternatives: '<button class="sso">SSO</button>' },
    global: {
      provide,
      stubs: {
        Card: { template: '<div><slot name="title" /><slot name="content" /></div>' },
        InputText: { props: ['modelValue'], template: '<input />' },
        Password: { props: ['modelValue'], template: '<input type="password" />' },
        QdButton: { props: ['label'], template: '<button type="submit">{{ label }}</button>' },
      },
    },
  })
}

const texts = (w) => ({
  labels: w.findAll('label').map((l) => l.text()),
  submit: w.find('button[type=submit]').text(),
  or: w.find('.qdadm-login-divider').text(),
})

beforeEach(() => {
  toast.success.mockReset()
  toast.error.mockReset()
  push.mockReset()
})

describe('LoginPage i18n (#4168)', () => {
  it('reads labels, button and divider from the catalogue', async () => {
    expect(texts(await mountLogin({ locale: 'fr' }))).toEqual({ labels: ['Identifiant', 'Mot de passe'], submit: 'Se connecter', or: 'ou' })
    expect(texts(await mountLogin())).toEqual({ labels: ['Username', 'Password'], submit: 'Sign In', or: 'or' })
  })

  it('explicit props still win', async () => {
    const w = await mountLogin({ locale: 'fr', props: { usernameLabel: 'E-mail', passwordLabel: 'Code', submitLabel: 'Entrer' } })
    expect(texts(w)).toMatchObject({ labels: ['E-mail', 'Code'], submit: 'Entrer' })
  })

  it('translates the welcome toast', async () => {
    const w = await mountLogin({ locale: 'fr' })
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(toast.success).toHaveBeenCalledWith('Bienvenue', 'Connecté en tant que e2e', 'LoginPage')
    expect(push).toHaveBeenCalledWith('/')
  })

  it('translates the failure toast and its fallback message', async () => {
    const w = await mountLogin({ locale: 'fr', login: async () => { throw {} } })
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(toast.error).toHaveBeenCalledWith('Échec de la connexion', 'Identifiants invalides', 'LoginPage')
  })

  it('welcomeToast: false drops the success toast, the login still goes through', async () => {
    const w = await mountLogin({ props: { welcomeToast: false } })
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(toast.success).not.toHaveBeenCalled()
    expect(signals.emit).toHaveBeenCalledWith('auth:login', { user: { username: 'e2e' } })
    expect(w.emitted('login')).toHaveLength(1)
  })
})
