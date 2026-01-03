<script setup>
/**
 * AuthPanel - Auth collector display with activity indicator
 */
import { onMounted, computed } from 'vue'
import ObjectTree from '../ObjectTree.vue'

const props = defineProps({
  collector: { type: Object, required: true },
  entries: { type: Array, required: true }
})

// Mark events as seen when panel is viewed (badge resets but events stay visible)
onMounted(() => {
  props.collector.markSeen?.()
})

// Get all recent events (stacked display)
const recentEvents = computed(() => props.collector.getRecentEvents?.() || [])

function getIcon(type) {
  const icons = {
    user: 'pi-user',
    token: 'pi-key',
    permissions: 'pi-shield',
    adapter: 'pi-cog'
  }
  return icons[type] || 'pi-info-circle'
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour12: false })
}
</script>

<template>
  <div class="auth-panel">
    <!-- Invariant entries (user, token, permissions, adapter) -->
    <div v-for="(entry, idx) in entries" :key="idx" class="auth-item">
      <div class="auth-header">
        <i :class="['pi', getIcon(entry.type)]" />
        <span class="auth-label">{{ entry.label || entry.type }}</span>
      </div>
      <div v-if="entry.message" class="auth-message">{{ entry.message }}</div>
      <ObjectTree v-else-if="entry.data" :data="entry.data" :maxDepth="4" />
    </div>

    <!-- Recent auth events (stacked below, newest first) -->
    <div
      v-for="event in recentEvents"
      :key="event.id"
      class="auth-activity"
      :class="event.type"
    >
      <i :class="['pi', event.type === 'login' ? 'pi-sign-in' : 'pi-sign-out']" />
      <span>{{ event.type === 'login' ? 'User logged in' : 'User logged out' }}</span>
      <span class="auth-time">{{ formatTime(event.timestamp) }}</span>
    </div>
  </div>
</template>

<style scoped>
.auth-panel {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* Activity indicator */
.auth-activity {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  animation: pulse 2s ease-in-out infinite;
}
.auth-activity.login {
  background: linear-gradient(90deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.05) 100%);
  border-left: 3px solid #22c55e;
  color: #22c55e;
}
.auth-activity.logout {
  background: linear-gradient(90deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.05) 100%);
  border-left: 3px solid #ef4444;
  color: #ef4444;
}
.auth-time {
  margin-left: auto;
  font-size: 10px;
  opacity: 0.6;
  font-weight: 400;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
.auth-item {
  background: #27272a;
  border-radius: 4px;
  padding: 8px;
}
.auth-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  color: #10b981;
}
.auth-label {
  font-weight: 600;
}
.auth-message {
  color: #71717a;
  font-size: 12px;
}
</style>
