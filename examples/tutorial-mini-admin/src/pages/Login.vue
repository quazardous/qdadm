<script setup lang="ts">
import { LoginPage } from '@quazardous/qdadm/components'
</script>

<template>
  <LoginPage>
    <template #footer>
      <p class="login-hint">Demo accounts: <code>admin / admin</code> (full access) · <code>bob / bob</code> (read-only)</p>
    </template>
  </LoginPage>
</template>

<style scoped>
.login-hint {
  margin-top: 1rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--p-surface-500, #64748b);
}
</style>
