<script setup>
/**
 * DefaultFooter - Default footer component for BaseLayout
 *
 * Displays "powered by qdadm" branding with version.
 * Extracted from AppLayout for zone-based architecture.
 *
 * This is the default component rendered in the "footer" zone
 * when no blocks are registered.
 */
import { inject } from 'vue'
import qdadmLogo from '../../../assets/logo.svg'
import { version as qdadmVersion } from '../../../../package.json'

const features = inject('qdadmFeatures', { poweredBy: true })
</script>

<template>
  <div v-if="features.poweredBy" class="default-footer">
    <img :src="qdadmLogo" alt="qdadm" class="footer-logo" />
    <span class="footer-text">
      powered by <strong>qdadm</strong> v{{ qdadmVersion }}
    </span>
  </div>
</template>

<style scoped>
.default-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--p-surface-700, #334155);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.default-footer:hover {
  opacity: 1;
}

.footer-logo {
  width: 1.25rem;
  height: 1.25rem;
}

.footer-text {
  font-size: 0.625rem;
  color: var(--p-surface-400, #94a3b8);
  letter-spacing: 0.02em;
}

.footer-text strong {
  color: var(--p-surface-300, #cbd5e1);
}
</style>
