<script setup>
/**
 * App Root Component
 *
 * Provides:
 * - Confirmation dialogs
 * - RouterView
 *
 * Note: Toast is now provided by Kernel at root level
 */
import { RouterView } from 'vue-router'
import ConfirmDialog from 'primevue/confirmdialog'
</script>

<template>
  <ConfirmDialog />
  <RouterView />
</template>
