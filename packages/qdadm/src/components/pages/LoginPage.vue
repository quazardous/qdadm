<script setup lang="ts">
/**
 * LoginPage - Generic login page component
 *
 * Uses authAdapter from qdadm context for authentication.
 * Customizable via props and slots for app branding.
 *
 * Usage:
 *   <LoginPage />
 *   <LoginPage title="My App" icon="pi pi-lock" />
 *   <LoginPage :logo="LogoComponent" />
 *
 * With slot:
 *   <LoginPage>
 *     <template #footer>
 *       <p>Demo accounts: admin, user</p>
 *     </template>
 *   </LoginPage>
 *
 * Identity provider first (#4321): the SSO button leads, the local form is a
 * fallback (open, collapsed or hidden):
 *   <LoginPage :sso="{ label: 'Sign in with Acme' }" local-fallback="collapsed"
 *              :provider-home="{ label: 'My Acme account', href: 'https://id.acme.test' }" />
 */
import { ref, inject, computed, nextTick, type PropType, type Component } from 'vue'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import QdButton from '../base/QdButton.vue'
import QdMessage from '../base/QdMessage.vue'
import AppBanner from '../layout/AppBanner.vue'
import { useI18n } from '../../i18n/useI18n'
import type { TranslateParams } from '../../i18n'
import type { OrchestratorLike } from '../../entity/EntityManager.interface'

/**
 * Auth adapter interface
 */
interface AuthAdapter {
  login: (credentials: { username: string; password: string }) => Promise<LoginResult>
  /** Redirect-based adapters (OAuthCodeAdapter): starts the provider's flow. */
  beginLogin?: (redirectTo?: string) => Promise<void>
}

/**
 * The identity provider's button (#4321). `href` navigates (a server redirect),
 * `start` runs the app's own flow; with neither, the auth adapter's
 * `beginLogin()` is called.
 */
export interface LoginSso {
  label?: string
  icon?: string
  href?: string
  start?: () => Promise<void>
}

/** A link to the provider's own portal (password, two-factor), in a new tab. */
export interface LoginProviderHome {
  /** Default: core.login.providerHome ("My account") */
  label?: string
  href: string
}

/** Where the local form stands next to the SSO button. */
export type LoginLocalFallback = 'open' | 'collapsed' | 'hidden'

/**
 * A text of the page (#4326): a string (static, `{name}` placeholders work) or
 * a function called at render (dynamic: it follows the locale, a ref, the route).
 */
export type LoginLabel =
  | string
  | ((ctx: { t: (key: string, fallback: string, params?: TranslateParams) => string; params: TranslateParams }) => string)

/** Every text of LoginPage, each one overridable. */
export type LoginLabelKey =
  | 'username' | 'password' | 'submit' | 'or' | 'sso' | 'providerHome'
  | 'localSection' | 'localFallback' | 'welcome' | 'loggedInAs' | 'failed'
  | 'invalidCredentials' | 'noSso' | 'configError' | 'noAuthAdapter'

/**
 * Login result from auth adapter
 */
interface LoginResult {
  user?: {
    username?: string
    email?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * Orchestrator interface
 */
// #1191 — shared structural view (was: local redeclaration)
type Orchestrator = OrchestratorLike

/**
 * App config interface
 */
interface AppConfig {
  name?: string
  [key: string]: unknown
}

/**
 * Axios-like error interface
 */
interface AxiosError {
  response?: {
    data?: {
      error?: {
        message?: string
      }
      message?: string
    }
    status?: number
  }
  message?: string
}

const props = defineProps({
  /**
   * Override app title (defaults to qdadm app.name config)
   */
  title: {
    type: String as PropType<string | null>,
    default: null
  },
  /**
   * PrimeIcons icon class (e.g., 'pi pi-lock')
   */
  icon: {
    type: String,
    default: 'pi pi-shield'
  },
  /**
   * Custom logo component (replaces icon)
   */
  logo: {
    type: Object as PropType<Component | null>,
    default: null
  },
  /**
   * Username field label (default: core.login.username)
   */
  usernameLabel: {
    type: String as PropType<string | null>,
    default: null
  },
  /**
   * Password field label (default: core.login.password)
   */
  passwordLabel: {
    type: String as PropType<string | null>,
    default: null
  },
  /**
   * Submit button label (default: core.login.submit)
   */
  submitLabel: {
    type: String as PropType<string | null>,
    default: null
  },
  /**
   * Route to redirect after successful login
   */
  redirectTo: {
    type: String,
    default: '/'
  },
  /**
   * Default username value
   */
  defaultUsername: {
    type: String,
    default: ''
  },
  /**
   * Default password value
   */
  defaultPassword: {
    type: String,
    default: ''
  },
  /**
   * Emit auth:login signal on successful login
   * Required for debug bar auth tracking and other signal listeners
   */
  emitSignal: {
    type: Boolean,
    default: true
  },
  /**
   * Success toast ("Welcome / Logged in as …") after login
   */
  welcomeToast: {
    type: Boolean,
    default: true
  },
  /** The identity provider's button, first on the page (#4321). */
  sso: {
    type: Object as PropType<LoginSso | null>,
    default: null
  },
  /** A link to the provider's portal, beside the SSO button. */
  providerHome: {
    type: Object as PropType<LoginProviderHome | null>,
    default: null
  },
  /** With `sso`: the local form shown, behind a disclosure, or not at all. */
  localFallback: {
    type: String as PropType<LoginLocalFallback>,
    default: 'open'
  },
  /** The disclosure's label (default: core.login.localFallback) */
  localFallbackLabel: {
    type: String as PropType<string | null>,
    default: null
  },
  /** A line under the title */
  subtitle: {
    type: String as PropType<string | null>,
    default: null
  },
  /** The organisation's logo (image URL), small, beside the app's icon */
  brandLogo: {
    type: String as PropType<string | null>,
    default: null
  },
  /** An error to show above the SSO button, e.g. the provider's `?error=` on return */
  error: {
    type: String as PropType<string | null>,
    default: null
  },
  /**
   * Any text of the page (#4326), static or dynamic. Wins over the single
   * label props, which win over the i18n catalogue (core.login.*).
   * `localSection: ''` drops the open local form's title for the bare "or".
   */
  labels: {
    type: Object as PropType<Partial<Record<LoginLabelKey, LoginLabel>> | null>,
    default: null
  }
})

const emit = defineEmits<{
  (e: 'login', result: LoginResult): void
  (e: 'error', error: unknown): void
}>()

const router = useRouter()
const authAdapter = inject<AuthAdapter | null>('authAdapter', null)
const orchestrator = inject<Orchestrator | null>('qdadmOrchestrator', null)
const appConfig = inject<AppConfig>('qdadmApp', {})
const { tOr } = useI18n()

const username = ref<string>(props.defaultUsername)
const password = ref<string>(props.defaultPassword)
const loading = ref<boolean>(false)

/**
 * A text of the page: `labels[key]`, else the single prop given, else the
 * catalogue (core.login.<key>), else the built-in default.
 */
function label(key: LoginLabelKey, fallback: string, single?: string | null, params: TranslateParams = {}): string {
  const custom = props.labels?.[key]
  if (typeof custom === 'function') return custom({ t: tOr, params })
  if (typeof custom === 'string') return custom.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m))
  if (single != null) return single
  return tOr(`core.login.${key}`, fallback, params)
}

const texts = computed(() => ({
  username: label('username', 'Username', props.usernameLabel),
  password: label('password', 'Password', props.passwordLabel),
  submit: label('submit', 'Sign In', props.submitLabel),
}))

const displayTitle = computed<string>(() => props.title || appConfig.name || 'Admin')

// Identity provider first (#4321). 'hidden' needs an SSO button, or there is no way in.
if (props.localFallback === 'hidden' && !props.sso) {
  console.warn('[qdadm] LoginPage: localFallback "hidden" needs `sso`; the local form stays shown')
}
const localMode = computed<LoginLocalFallback>(() => (props.sso ? props.localFallback : 'open'))
const localOpen = ref<boolean>(localMode.value !== 'collapsed')
const ssoLoading = ref<boolean>(false)
const ssoError = ref<string | null>(null)
const shownError = computed<string | null>(() => ssoError.value ?? props.error)
const ssoLabel = computed<string>(() => label('sso', 'Sign in', props.sso?.label))
// The open local form's title, in place of the bare "or"; '' keeps the "or"
const localSection = computed<string>(() => label('localSection', 'Alternative login'))

async function openLocal(): Promise<void> {
  localOpen.value = true
  await nextTick()
  document.getElementById('qdadm-username')?.focus()
}

async function handleSso(): Promise<void> {
  const sso = props.sso
  if (!sso || sso.href) return // an href is a plain link
  ssoError.value = null
  ssoLoading.value = true
  try {
    if (sso.start) await sso.start()
    else if (authAdapter?.beginLogin) await authAdapter.beginLogin(props.redirectTo)
    else throw new Error(label('noSso', 'No sign-in flow configured for this button'))
  } catch (err) {
    ssoError.value = err instanceof Error ? err.message : String(err)
    emit('error', err)
  } finally {
    // A redirect leaves the page; anything else hands the button back
    ssoLoading.value = false
  }
}

async function handleLogin(): Promise<void> {
  if (!authAdapter?.login) {
    orchestrator?.toast.error(label('configError', 'Configuration Error'), label('noAuthAdapter', 'No auth adapter configured'), 'LoginPage')
    return
  }

  loading.value = true
  try {
    const result = await authAdapter.login({
      username: username.value,
      password: password.value
    })

    // Emit auth:login signal for debug bar and other listeners
    orchestrator?.signals?.emit('auth:login', { user: result.user })
    if (props.welcomeToast) {
      orchestrator?.toast.success(
        label('welcome', 'Welcome'),
        label('loggedInAs', 'Logged in as {name}', null, { name: result.user?.username || result.user?.email || username.value }),
        'LoginPage'
      )
    }

    emit('login', result)
    router.push(props.redirectTo)
  } catch (error) {
    password.value = ''

    const axiosError = error as AxiosError
    const message = axiosError.response?.data?.error?.message
      || axiosError.response?.data?.message
      || axiosError.message
      || label('invalidCredentials', 'Invalid credentials')

    orchestrator?.signals?.emit('auth:login:error', {
      username: username.value,
      error: message,
      status: axiosError.response?.status
    })
    orchestrator?.toast.error(label('failed', 'Login Failed'), message, 'LoginPage')

    emit('error', error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="qdadm-login-page">
    <!-- Which environment this is, before login too (#4200) -->
    <AppBanner />
    <Card class="qdadm-login-card">
      <template #title>
        <div class="qdadm-login-header">
          <slot name="logo">
            <component v-if="logo" :is="logo" class="qdadm-login-logo" />
            <i v-else :class="icon" class="qdadm-login-icon"></i>
          </slot>
          <div class="qdadm-login-titles">
            <h1>{{ displayTitle }}</h1>
            <p v-if="subtitle" class="qdadm-login-subtitle">{{ subtitle }}</p>
          </div>
          <slot name="brand">
            <img v-if="brandLogo" :src="brandLogo" alt="" class="qdadm-login-brand" />
          </slot>
        </div>
      </template>
      <template #content>
        <!-- Identity provider first (#4321): its button leads, the local form is the fallback -->
        <div v-if="sso" class="qdadm-login-sso">
          <QdMessage v-if="shownError" severity="error" :closable="false" class="qdadm-login-error">{{ shownError }}</QdMessage>
          <QdButton
            v-if="sso.href"
            as="a"
            :href="sso.href"
            :label="ssoLabel"
            :icon="sso.icon ?? 'pi pi-sign-in'"
            class="w-full qdadm-login-sso-button"
          />
          <QdButton
            v-else
            type="button"
            :label="ssoLabel"
            :icon="sso.icon ?? 'pi pi-sign-in'"
            class="w-full qdadm-login-sso-button"
            :loading="ssoLoading"
            @click="handleSso"
          />
          <a
            v-if="providerHome"
            :href="providerHome.href"
            target="_blank"
            rel="noopener noreferrer"
            class="qdadm-login-provider-home"
          >{{ label('providerHome', 'My account', providerHome.label || null) }} <i class="pi pi-external-link" aria-hidden="true"></i></a>
          <div v-if="localMode === 'open'" class="qdadm-login-divider" :class="{ 'qdadm-login-section': localSection }">
            <span>{{ localSection || label('or', 'or') }}</span>
          </div>
          <QdButton
            v-else-if="localMode === 'collapsed'"
            type="button"
            text
            size="small"
            class="qdadm-login-fallback-toggle"
            :icon="localOpen ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
            :label="label('localFallback', 'Alternative login', localFallbackLabel)"
            :aria-expanded="String(localOpen)"
            aria-controls="qdadm-login-local"
            @click="localOpen ? (localOpen = false) : openLocal()"
          />
        </div>
        <form
          v-if="localMode !== 'hidden'"
          v-show="localOpen"
          id="qdadm-login-local"
          @submit.prevent="handleLogin"
          class="qdadm-login-form"
          autocomplete="off"
        >
          <div class="qdadm-login-field">
            <label for="qdadm-username">{{ texts.username }}</label>
            <InputText
              v-model="username"
              id="qdadm-username"
              class="w-full"
              autocomplete="username"
              :disabled="loading"
            />
          </div>
          <div class="qdadm-login-field">
            <label for="qdadm-password">{{ texts.password }}</label>
            <Password
              v-model="password"
              inputId="qdadm-password"
              class="w-full"
              :feedback="false"
              toggleMask
              :disabled="loading"
            />
          </div>
          <QdButton
            type="submit"
            :label="texts.submit"
            icon="pi pi-sign-in"
            class="w-full"
            :loading="loading"
          />
          <!-- Alternative sign-ins (#1775): SSO buttons go between the form
               and the footer, which is where users look for them. Rendered
               only when filled, so the divider never shows on its own. -->
          <template v-if="!sso">
            <div v-if="$slots.alternatives" class="qdadm-login-alternatives">
              <div class="qdadm-login-divider"><span>{{ label('or', 'or') }}</span></div>
              <slot name="alternatives"></slot>
            </div>

            <slot name="footer"></slot>
          </template>
        </form>
        <!-- With sso the form may be collapsed or absent: what follows it stays shown -->
        <div v-if="sso && ($slots.alternatives || $slots.footer)" class="qdadm-login-after">
          <div v-if="$slots.alternatives" class="qdadm-login-alternatives">
            <slot name="alternatives"></slot>
          </div>
          <slot name="footer"></slot>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.qdadm-login-sso {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.qdadm-login-error {
  margin: 0;
}

.qdadm-login-provider-home {
  align-self: center;
  font-size: 0.875rem;
  color: var(--p-primary-color);
  text-decoration: none;
}

.qdadm-login-provider-home:hover {
  text-decoration: underline;
}

.qdadm-login-provider-home .pi {
  font-size: 0.75rem;
}

.qdadm-login-fallback-toggle {
  align-self: center;
}

.qdadm-login-titles {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.qdadm-login-subtitle {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--p-text-muted-color, #6b7280);
}

.qdadm-login-brand {
  height: 1.5rem;
  width: auto;
  margin-left: auto;
  opacity: 0.9;
}

.qdadm-login-after {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.qdadm-login-alternatives {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.qdadm-login-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--p-text-muted-color, #6b7280);
  font-size: 0.875rem;
}

.qdadm-login-section {
  font-weight: 500;
  color: var(--p-text-color);
}

.qdadm-login-divider::before,
.qdadm-login-divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--p-content-border-color, #e5e7eb);
}

/*
 * Only keep styles here that REQUIRE scoping (:deep, dynamic binding, component-specific overrides).
 * Generic/reusable styles belong in src/styles/ partials (see _forms.scss, _cards.scss, etc.).
 */
.qdadm-login-page {
  min-height: 100vh;
  padding-top: var(--qd-banner-height, 0px);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--p-surface-100);
}

.qdadm-login-card {
  width: 100%;
  max-width: 400px;
  margin: 1rem;
}

.qdadm-login-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: center;
}

.qdadm-login-header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--p-text-color);
}

.qdadm-login-icon {
  font-size: 2rem;
  color: var(--p-primary-500);
}

.qdadm-login-logo {
  height: 2rem;
  width: auto;
}

.qdadm-login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.qdadm-login-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.qdadm-login-field label {
  font-weight: 500;
  color: var(--p-text-color);
}

/* Responsive */
@media (max-width: 480px) {
  .qdadm-login-card {
    max-width: 100%;
    margin: 0.5rem;
  }
}
</style>
