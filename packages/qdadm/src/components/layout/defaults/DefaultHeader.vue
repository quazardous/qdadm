<script setup>
/**
 * DefaultHeader - Default header component for BaseLayout
 *
 * Displays app branding (logo or name) and version badge.
 * Extracted from AppLayout for zone-based architecture.
 *
 * This is the default component rendered in the "header" zone
 * when no blocks are registered.
 */
import { inject, computed } from 'vue'

const features = inject('qdadmFeatures', { poweredBy: true })

// App config from useApp (injected by createQdadm plugin)
const app = inject('qdadmApp', {
  name: 'Admin',
  shortName: 'adm',
  version: null,
  logo: null
})
</script>

<template>
  <div class="default-header">
    <div class="header-branding">
      <img v-if="app.logo" :src="app.logo" :alt="app.name" class="header-logo" />
      <h1 v-else class="header-title">{{ app.name }}</h1>
    </div>
    <span v-if="app.version" class="header-version">v{{ app.version }}</span>
  </div>
</template>

<style scoped>
.default-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 1.5rem;
  border-bottom: 1px solid var(--p-surface-700, #334155);
}

.header-branding {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--p-surface-0, white);
}

.header-logo {
  max-height: 32px;
  max-width: 160px;
}

.header-version {
  font-size: 0.625rem;
  color: var(--p-surface-400, #94a3b8);
  background: var(--p-surface-700, #334155);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}
</style>
