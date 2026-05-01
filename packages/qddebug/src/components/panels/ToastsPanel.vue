<script setup lang="ts">
/**
 * ToastsPanel - Toasts collector display (vertical mode)
 */
interface ToastEntry {
  timestamp: number
  severity: string
  summary?: string
  detail?: string
  emitter?: string
  _isNew?: boolean
}

interface Props {
  entries: ToastEntry[]
}

defineProps<Props>()

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}
</script>

<template>
  <div class="toasts-panel">
    <div
      v-for="(entry, idx) in entries.slice().reverse()"
      :key="idx"
      class="toast-entry"
      :class="[`toast-${entry.severity}`, { 'entry-new': entry._isNew }]"
    >
      <div class="toast-header">
        <span class="toast-time">{{ formatTime(entry.timestamp) }}</span>
        <span class="toast-severity" :class="`toast-severity-${entry.severity}`">{{ entry.severity }}</span>
        <span v-if="entry.summary" class="toast-summary">{{ entry.summary }}</span>
        <span v-if="entry.emitter" class="toast-emitter">{{ entry.emitter }}</span>
      </div>
      <div v-if="entry.detail" class="toast-detail">{{ entry.detail }}</div>
    </div>
  </div>
</template>

