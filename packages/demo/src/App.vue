<script setup>
/**
 * App Root Component
 *
 * Provides:
 * - Toast notifications (needed for pages outside BaseLayout like LoginPage)
 * - Confirmation dialogs
 * - RouterView
 */
import { RouterView } from 'vue-router'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
</script>

<template>
  <Toast position="top-right" />
  <ConfirmDialog />
  <RouterView />
</template>
