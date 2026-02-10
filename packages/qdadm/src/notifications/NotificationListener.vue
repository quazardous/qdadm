<script setup lang="ts">
/**
 * NotificationListener - Captures toast signals to notification store
 *
 * Replaces ToastListener when NotificationModule is active.
 * Intercepts toast:* signals and:
 * - Always captures to NotificationStore
 * - If data.forceToast === true, also shows a classic PrimeVue toast
 */
import { onMounted, onUnmounted, inject } from 'vue'
import { useToast } from 'primevue/usetoast'
import type { SignalBus } from '../kernel/SignalBus'
import { useNotifications } from './NotificationStore'
import type { NotificationSeverity } from './NotificationStore'

interface ToastEventData {
  summary?: string
  detail?: string
  life?: number
  emitter?: string
  forceToast?: boolean
}

const toast = useToast()
const signals = inject<SignalBus | null>('qdadmSignals', null)
const store = useNotifications()

let unsubscribe: (() => void) | null = null

onMounted(() => {
  if (!signals) {
    console.warn('[NotificationListener] No signals bus injected')
    return
  }

  unsubscribe = signals.on('toast:*', (event) => {
    const data = event.data as ToastEventData | undefined
    const severity = event.name.split(':')[1] as NotificationSeverity

    // Always capture to notification store
    store.addNotification({
      severity,
      summary: data?.summary || '',
      detail: data?.detail,
      emitter: data?.emitter,
    })

    // If forceToast is set, also show classic PrimeVue toast
    if (data?.forceToast) {
      toast.add({
        severity,
        summary: data?.summary,
        detail: data?.detail,
        life: data?.life ?? 3000,
      })
    }
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
