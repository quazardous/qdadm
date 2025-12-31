<script setup>
/**
 * LoginPage - Demo login using qdadm LoginPage component
 *
 * Available accounts (password = username):
 *   - admin (role: admin) - Full access to all features
 *   - bob, june (role: user) - Limited access, own loans only
 */

import { LoginPage } from 'qdadm'
</script>

<template>
  <LoginPage
    title="Book Manager"
    icon="pi pi-book"
    defaultUsername="admin"
    defaultPassword="admin"
    :emitSignal="true"
  >
    <template #footer>
      <div class="demo-hint">
        <p><strong>Demo accounts</strong> (password = username):</p>
        <p><code>admin</code> - Full access (Users, delete Books)</p>
        <p><code>bob</code> / <code>june</code> - Users see only their own Loans</p>
      </div>
    </template>
  </LoginPage>
</template>

<style scoped>
.demo-hint {
  text-align: center;
  color: var(--p-surface-500);
  font-size: 0.875rem;
  margin: 0.5rem 0 0;
}

.demo-hint p {
  margin: 0.25rem 0;
}

.demo-hint code {
  background: var(--p-surface-200);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}
</style>
