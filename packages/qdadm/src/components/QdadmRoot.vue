<script setup lang="ts">
/**
 * QdadmRoot — drop-in helper for hosts that own their own Vue app
 * and want qdadm's DOM extras (Toast, ToastListener, DebugBar)
 * rendered alongside.
 *
 * Equivalent to the wrapper Kernel produces internally when it owns
 * `createApp`. When `Kernel({ existingApp })` is used, the host's
 * App.vue should render `<QdadmRoot />` somewhere visible (typically
 * at the end of the template) so toasts and the debug bar appear.
 *
 * The Toast / DebugBar children are conditional on what the Kernel
 * was configured with (PrimeVue presence, debugBar option) — render
 * is a no-op otherwise, so it's always safe to include.
 */

import { computed, inject, type Component } from 'vue'
import Toast from 'primevue/toast'
import ToastListener from '../toast/ToastListener.vue'
import { getQdadmDebugBarRef } from '../kernel/Kernel.vue'

// Read the singleton-on-window debug bar ref. Using a getter (instead
// of importing the module-level const) makes this resilient to Vite
// HMR's module fragmentation in dev, where a top-level `const ref`
// can be torn into separate instances per importer.
const debugBarRef = getQdadmDebugBarRef()
const debugBar = computed<Component | null>(() => debugBarRef.value)

// `qdadmHasPrimeVue` is provided by the Kernel during _installPlugins.
// True when PrimeVue is wired (so Toast / ToastListener are usable).
const hasToast = inject<boolean>('qdadmHasPrimeVue', false)
</script>

<template>
  <Toast v-if="hasToast" />
  <ToastListener v-if="hasToast" />
  <component v-if="debugBar" :is="debugBar" />
</template>
