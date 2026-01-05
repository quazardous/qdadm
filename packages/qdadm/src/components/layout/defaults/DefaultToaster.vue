<script setup>
/**
 * DefaultToaster - Default toaster component for BaseLayout
 *
 * Renders the Toast component for notifications.
 * Uses PrimeVue Toast with default positioning.
 *
 * NOTE: For pages outside BaseLayout (like LoginPage),
 * apps must include Toast in their App.vue root component.
 */
import Toast from 'primevue/toast'
</script>

<template>
  <Toast position="top-right" />
</template>
