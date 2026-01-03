<script setup>
/**
 * ToastListener - Bridges signal bus to PrimeVue Toast
 *
 * Invisible component that listens to toast:* signals and displays
 * them using PrimeVue's Toast component.
 *
 * This component should be registered in a zone via ToastBridgeModule.
 */
import { onMounted, onUnmounted, inject } from 'vue'
import { useToast } from 'primevue/usetoast'

const toast = useToast()
const signals = inject('qdadmSignals')

let unsubscribe = null

onMounted(() => {
  if (!signals) {
    console.warn('[ToastListener] No signals bus injected')
    return
  }

  // Listen to all toast signals
  unsubscribe = signals.on('toast:*', (event) => {
    const severity = event.name.split(':')[1] // toast:success -> success
    toast.add({
      severity,
      summary: event.data?.summary,
      detail: event.data?.detail,
      life: event.data?.life ?? 3000
    })
  })
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
})
</script>

<template>
  <!-- Invisible listener component -->
  <span style="display: none" />
</template>
