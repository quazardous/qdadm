<script setup>
/**
 * The sign-in button lives in the `#alternatives` slot (#1775) — between the
 * form and the footer, where users look for it.
 *
 * `beginLogin()` takes where the user was heading, so the trip through Google
 * comes back to the page they asked for rather than dumping them on the home
 * screen. That detail is the difference between a demo and something usable.
 */
import { inject } from 'vue'
import { useRoute } from 'vue-router'
import { LoginPage } from '@quazardous/qdadm/components'
import QdButton from 'primevue/button'

const authAdapter = inject('authAdapter')
const route = useRoute()

function signInWithGoogle() {
  authAdapter.beginLogin(route.query.redirect || '/')
}
</script>

<template>
  <LoginPage title="Google sign-in">
    <template #alternatives>
      <QdButton
        label="Sign in with Google"
        icon="pi pi-google"
        severity="secondary"
        outlined
        class="w-full"
        @click="signInWithGoogle"
      />
    </template>
    <template #footer>
      <p class="hint">
        The password form above is unused here — this demo has no password
        backend. Use the Google button.
      </p>
    </template>
  </LoginPage>
</template>

<style scoped>
.hint {
  margin: 1rem 0 0;
  font-size: 0.8125rem;
  color: var(--p-text-muted-color, #6b7280);
  text-align: center;
}
</style>
