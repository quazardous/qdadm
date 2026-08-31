<script setup lang="ts">
/**
 * OAuth callback landing page (#1775).
 *
 * Register this on a **public** route. `Kernel.routing.ts:192` sends anyone
 * unauthenticated back to the login page, and at this exact moment the user is
 * *not yet* authenticated — a guarded callback route bounces the provider's
 * redirect straight back to login, which is the classic way this flow fails
 * and gives no clue why:
 *
 * ```js
 * ctx.routes('/auth/google', [{
 *   path: 'callback',
 *   name: 'google-callback',
 *   component: () => import('@quazardous/qdadm/components/OAuthCallbackPage.vue'),
 *   meta: { public: true },   // ← without this, nothing works
 * }])
 * ```
 *
 * The page itself does almost nothing: it hands the query string to the
 * adapter, which validates `state`, has your backend redeem the code, and
 * stores the session your backend issued. Then it goes where the user was
 * headed before login sent them away.
 *
 * @experimental Shape may change in a minor release — see docs/API_STABILITY.md.
 */
import { ref, inject, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QdButton from '../base/QdButton.vue'

interface OAuthCapableAdapter {
  completeLogin: (
    query: Record<string, string | undefined>
  ) => Promise<{ user?: unknown; redirectTo: string }>
}

interface SignalsLike {
  emit?: (signal: string, payload?: unknown) => unknown
}

const props = defineProps({
  /** Where to send the user when the callback carries no destination. */
  fallbackRedirect: { type: String, default: '/' },
  /** Route to offer on failure. */
  loginRoute: { type: String, default: '/login' },
  /** Shown while the exchange is in flight. */
  pendingLabel: { type: String, default: 'Signing you in…' },
})

const emit = defineEmits<{
  (e: 'success', payload: unknown): void
  (e: 'error', error: unknown): void
}>()

const route = useRoute()
const router = useRouter()
const authAdapter = inject<OAuthCapableAdapter | null>('authAdapter', null)
const signals = inject<SignalsLike | null>('qdadmSignals', null)

const error = ref<string | null>(null)

onMounted(async () => {
  if (typeof authAdapter?.completeLogin !== 'function') {
    error.value =
      'No OAuth-capable auth adapter is configured. The kernel needs an adapter exposing completeLogin().'
    emit('error', new Error(error.value))
    return
  }

  try {
    const query = Object.fromEntries(
      Object.entries(route.query).map(([key, value]) => [
        key,
        Array.isArray(value) ? value[0] : value,
      ])
    ) as Record<string, string | undefined>

    const result = await authAdapter.completeLogin(query)

    // Same signal the password form emits, so debug bar, SSE bridge and any
    // listener see one authentication event whichever door was used.
    signals?.emit?.('auth:login', { user: result.user })
    emit('success', result)

    await router.replace(result.redirectTo || props.fallbackRedirect)
  } catch (err) {
    error.value = (err as Error)?.message ?? 'Sign-in failed'
    signals?.emit?.('auth:login:error', { error: error.value })
    emit('error', err)
  }
})
</script>

<template>
  <div class="qdadm-oauth-callback">
    <template v-if="error">
      <i class="pi pi-times-circle qdadm-oauth-icon qdadm-oauth-icon-error" />
      <p class="qdadm-oauth-message">{{ error }}</p>
      <QdButton label="Back to sign in" icon="pi pi-arrow-left" @click="router.replace(loginRoute)" />
    </template>
    <template v-else>
      <i class="pi pi-spin pi-spinner qdadm-oauth-icon" />
      <p class="qdadm-oauth-message">{{ pendingLabel }}</p>
    </template>
  </div>
</template>

<style scoped>
.qdadm-oauth-callback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 60vh;
  padding: 2rem;
  text-align: center;
}

.qdadm-oauth-icon {
  font-size: 2rem;
  color: var(--p-primary-color, #10b981);
}

.qdadm-oauth-icon-error {
  color: var(--p-red-500, #ef4444);
}

.qdadm-oauth-message {
  margin: 0;
  color: var(--p-text-muted-color, #6b7280);
  max-width: 34rem;
}
</style>
