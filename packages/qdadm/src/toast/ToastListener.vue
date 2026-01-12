<script setup lang="ts">
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
import type { SignalBus } from '../kernel/SignalBus'

interface ToastEventData {
  summary?: string
  detail?: string
  life?: number
}

const toast = useToast()
const signals = inject<SignalBus | null>('qdadmSignals', null)

let unsubscribe: (() => void) | null = null

onMounted(() => {
  if (!signals) {
    console.warn('[ToastListener] No signals bus injected')
    return
  }

  // Listen to all toast signals
  unsubscribe = signals.on('toast:*', (event) => {
    const data = event.data as ToastEventData | undefined
    const severity = event.name.split(':')[1] // toast:success -> success
    toast.add({
      severity,
      summary: data?.summary,
      detail: data?.detail,
      life: data?.life ?? 3000
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
