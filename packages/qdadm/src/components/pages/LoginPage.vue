<script setup>
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
 */
import { ref, inject, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'

const props = defineProps({
  /**
   * Override app title (defaults to qdadm app.name config)
   */
  title: {
    type: String,
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
    type: Object,
    default: null
  },
  /**
   * Username field label
   */
  usernameLabel: {
    type: String,
    default: 'Username'
  },
  /**
   * Password field label
   */
  passwordLabel: {
    type: String,
    default: 'Password'
  },
  /**
   * Submit button label
   */
  submitLabel: {
    type: String,
    default: 'Sign In'
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
  }
})

const emit = defineEmits(['login', 'error'])

const router = useRouter()
const toast = useToast()
const authAdapter = inject('authAdapter', null)
const orchestrator = inject('qdadmOrchestrator', null)
const appConfig = inject('qdadmApp', {})

const username = ref(props.defaultUsername)
const password = ref(props.defaultPassword)
const loading = ref(false)

const displayTitle = computed(() => props.title || appConfig.name || 'Admin')

async function handleLogin() {
  if (!authAdapter?.login) {
    toast.add({
      severity: 'error',
      summary: 'Configuration Error',
      detail: 'No auth adapter configured',
      life: 5000
    })
    return
  }

  loading.value = true
  try {
    const result = await authAdapter.login({
      username: username.value,
      password: password.value
    })

    toast.add({
      severity: 'success',
      summary: 'Welcome',
      detail: `Logged in as ${result.user?.username || result.user?.email || username.value}`,
      life: 3000
    })

    // Emit business signal if enabled
    if (props.emitSignal && orchestrator?.signals) {
      orchestrator.signals.emit('auth:login', { user: result.user })
    }

    emit('login', result)
    router.push(props.redirectTo)
  } catch (error) {
    password.value = ''

    const message = error.response?.data?.error?.message
      || error.response?.data?.message
      || error.message
      || 'Invalid credentials'

    toast.add({
      severity: 'error',
      summary: 'Login Failed',
      detail: message,
      life: 5000
    })

    if (orchestrator?.signals) {
      orchestrator.signals.emit('auth:login:error', {
        username: username.value,
        error: message,
        status: error.response?.status
      })
    }

    emit('error', error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="qdadm-login-page">
    <Card class="qdadm-login-card">
      <template #title>
        <div class="qdadm-login-header">
          <slot name="logo">
            <component v-if="logo" :is="logo" class="qdadm-login-logo" />
            <i v-else :class="icon" class="qdadm-login-icon"></i>
          </slot>
          <h1>{{ displayTitle }}</h1>
        </div>
      </template>
      <template #content>
        <form @submit.prevent="handleLogin" class="qdadm-login-form" autocomplete="off">
          <div class="qdadm-login-field">
            <label for="qdadm-username">{{ usernameLabel }}</label>
            <InputText
              v-model="username"
              id="qdadm-username"
              class="w-full"
              autocomplete="username"
              :disabled="loading"
            />
          </div>
          <div class="qdadm-login-field">
            <label for="qdadm-password">{{ passwordLabel }}</label>
            <Password
              v-model="password"
              id="qdadm-password"
              class="w-full"
              :feedback="false"
              toggleMask
              :disabled="loading"
            />
          </div>
          <Button
            type="submit"
            :label="submitLabel"
            icon="pi pi-sign-in"
            class="w-full"
            :loading="loading"
          />
          <slot name="footer"></slot>
        </form>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.qdadm-login-page {
  min-height: 100vh;
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
