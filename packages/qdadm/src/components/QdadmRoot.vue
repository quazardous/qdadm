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
import { qdadmDebugBarRef } from '../kernel/Kernel.vue'

// `qdadmDebugBarRef` is set by the Kernel constructor when a
// debugBar.component is provided. Read it reactively so the
// component picks it up regardless of mount order.
const debugBar = computed<Component | null>(() => qdadmDebugBarRef.value)

// `qdadmHasPrimeVue` is provided by the Kernel during _installPlugins.
// True when PrimeVue is wired (so Toast / ToastListener are usable).
const hasToast = inject<boolean>('qdadmHasPrimeVue', false)
</script>

<template>
  <Toast v-if="hasToast" />
  <ToastListener v-if="hasToast" />
  <component v-if="debugBar" :is="debugBar" />
</template>
