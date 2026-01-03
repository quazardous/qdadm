<script setup>
/**
 * ToastsPanel - Toasts collector display (vertical mode)
 */
defineProps({
  entries: { type: Array, required: true }
})

function formatTime(ts) {
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

<style scoped>
.toasts-panel {
  display: flex;
  flex-direction: column;
}
.toast-entry {
  padding: 8px 12px;
  border-bottom: 1px solid #27272a;
  border-left: 3px solid;
}
.toast-entry:hover {
  background: #1f1f23;
}
.toast-success { border-left-color: #22c55e; }
.toast-info { border-left-color: #3b82f6; }
.toast-warn { border-left-color: #f59e0b; }
.toast-error { border-left-color: #ef4444; }

.toast-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.toast-time {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #71717a;
  background: #27272a;
  padding: 1px 4px;
  border-radius: 2px;
}
.toast-severity {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}
.toast-severity-success { background: #22c55e; color: white; }
.toast-severity-info { background: #3b82f6; color: white; }
.toast-severity-warn { background: #f59e0b; color: white; }
.toast-severity-error { background: #ef4444; color: white; }

.toast-summary {
  font-weight: 500;
  color: #f4f4f5;
}
.toast-detail {
  color: #a1a1aa;
  font-size: 11px;
  margin-top: 4px;
}
.toast-emitter {
  margin-left: auto;
  padding: 1px 6px;
  background: #3f3f46;
  border-radius: 3px;
  font-size: 10px;
  color: #a1a1aa;
  font-family: 'JetBrains Mono', monospace;
}

/* New entry indicator */
.entry-new {
  position: relative;
  background: rgba(139, 92, 246, 0.08);
}
.entry-new::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #8b5cf6;
}
</style>
