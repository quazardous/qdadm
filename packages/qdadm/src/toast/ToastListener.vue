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
import { explainMissingToast } from '../kernel/vitePluginCheck'
import {
  NOTIFICATION_KEY,
  type NotificationKeep,
  type NotificationSeverity,
  type NotificationTarget,
} from '../notifications/NotificationStore'

interface ToastEventData {
  summary?: string
  detail?: string
  life?: number
  emitter?: string
  keep?: NotificationKeep
  to?: NotificationTarget
}

const toast = explainMissingToast(useToast)
const signals = inject<SignalBus | null>('qdadmSignals', null)
// Provided when `notifications.enabled`: every toast also leaves a trace (#2677).
const notifications = inject(NOTIFICATION_KEY, null)

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
    // The pop-up is unchanged; the history keeps it, for as long as its keep level says.
    notifications?.addNotification({
      severity: severity as NotificationSeverity,
      summary: data?.summary ?? '',
      ...(data?.detail !== undefined ? { detail: data.detail } : {}),
      ...(data?.emitter !== undefined ? { emitter: data.emitter } : {}),
      ...(data?.keep !== undefined ? { keep: data.keep } : {}),
      ...(data?.to !== undefined ? { to: data.to } : {}),
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
