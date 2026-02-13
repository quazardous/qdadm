<script setup lang="ts">
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
import Zone from '../Zone.vue'
import qdadmLogo from '../../../assets/logo.svg'
import { version as qdadmVersion } from '../../../../package.json'

interface Features {
  poweredBy?: boolean
  [key: string]: boolean | undefined
}

const features = inject<Features>('qdadmFeatures', { poweredBy: true })
</script>

<template>
  <div class="default-footer-wrapper">
    <a
      v-if="features.poweredBy"
      href="https://github.com/quazardous/qdadm"
      target="_blank"
      rel="noopener noreferrer"
      class="default-footer"
    >
      <div class="footer-logo-wrapper">
        <img :src="qdadmLogo" alt="qdadm" class="footer-logo" />
        <!-- Notification badge overlay on logo -->
        <Zone name="_app:notification-badge" />
      </div>
      <span class="footer-text">
        powered by <strong>qdadm</strong> v{{ qdadmVersion }}
      </span>
    </a>
  </div>
</template>

<style scoped>
/*
 * Only keep styles here that REQUIRE scoping (:deep, dynamic binding, component-specific overrides).
 * Generic/reusable styles belong in src/styles/ partials (see _forms.scss, _cards.scss, etc.).
 */
.default-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--p-surface-700, #334155);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  opacity: 0.6;
  transition: opacity 0.15s;
  text-decoration: none;
  cursor: pointer;
}

.default-footer:hover {
  opacity: 1;
}

.default-footer-wrapper {
  position: relative;
}

.footer-logo-wrapper {
  position: relative;
  flex-shrink: 0;
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
