<script setup>
/**
 * LoginPage - Demo login form
 *
 * Available accounts (password = username):
 *   - admin (role: admin) - Full access to all features
 *   - bob, june (role: user) - Limited access, own loans only
 */

import { ref, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { authAdapter } from '../adapters/authAdapter'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'

const orchestrator = inject('qdadmOrchestrator')

const router = useRouter()
const toast = useToast()

const username = ref('admin')
const password = ref('admin')
const loading = ref(false)

async function handleLogin() {
  loading.value = true
  try {
    const { user } = await authAdapter.login({
      username: username.value,
      password: password.value
    })
    // Business signal: auth:login
    orchestrator?.signals?.emit('auth:login', { user })
    router.push('/')
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Login Failed',
      detail: error.message || 'Invalid credentials',
      life: 3000
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <Card class="login-card">
      <template #title>
        <div class="login-header">
          <i class="pi pi-book" style="font-size: 2rem; color: var(--p-primary-500)"></i>
          <h1>Book Manager</h1>
        </div>
      </template>
      <template #content>
        <form @submit.prevent="handleLogin" class="login-form">
          <div class="field">
            <label for="username">Username</label>
            <InputText
              v-model="username"
              id="username"
              class="w-full"
              autocomplete="username"
            />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <Password
              v-model="password"
              id="password"
              class="w-full"
              :feedback="false"
              toggleMask
            />
          </div>
          <Button
            type="submit"
            label="Sign In"
            icon="pi pi-sign-in"
            class="w-full"
            :loading="loading"
          />
          <div class="hint">
            <p><strong>Demo accounts</strong> (password = username):</p>
            <p><code>admin</code> - Full access (Users, delete Books)</p>
            <p><code>bob</code> / <code>june</code> - Users see only their own Loans</p>
          </div>
        </form>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--p-surface-100);
}

.login-card {
  width: 100%;
  max-width: 400px;
}

.login-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: center;
}

.login-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hint {
  text-align: center;
  color: var(--p-surface-500);
  font-size: 0.875rem;
  margin: 0.5rem 0 0;
}

.hint p {
  margin: 0.25rem 0;
}

.hint code {
  background: var(--p-surface-200);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}
</style>
