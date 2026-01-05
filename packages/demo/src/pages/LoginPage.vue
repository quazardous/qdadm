<script setup>
/**
 * LoginPage - Demo login using qdadm LoginPage component
 *
 * Available accounts (password = username):
 *   - admin (role: admin) - Full access to all features
 *   - bob, june (role: user) - Limited access, own loans only
 */

import { LoginPage, qdadmLogo } from 'qdadm'
</script>

<template>
  <div class="login-wrapper">
    <LoginPage
      title="Book Manager"
      icon="pi pi-book"
      defaultUsername="admin"
      defaultPassword="admin"
    >
      <template #footer>
        <div class="demo-hint">
          <p><strong>Demo accounts</strong> (password = username):</p>
          <p><code>admin</code> - Full access (Users, delete Books)</p>
          <p><code>bob</code> / <code>june</code> - Users see only their own Loans</p>
        </div>
      </template>
    </LoginPage>

    <div class="powered-by">
      <span>powered by</span>
      <img :src="qdadmLogo" alt="qdadm" class="qdadm-logo" />
      <a href="https://github.com/quazardous/qdadm" target="_blank" rel="noopener" class="github-link">
        <i class="pi pi-github"></i>
      </a>
    </div>
  </div>
</template>

<style scoped>
.login-wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.login-wrapper :deep(.qdadm-login-page) {
  flex: 1;
  min-height: auto;
}

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

.powered-by {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  color: var(--p-surface-500);
  font-size: 0.875rem;
  background: var(--p-surface-100);
}

.qdadm-logo {
  height: 24px;
  width: auto;
}

.github-link {
  color: var(--p-surface-600);
  font-size: 1.25rem;
  transition: color 0.2s;
}

.github-link:hover {
  color: var(--p-primary-500);
}
</style>
