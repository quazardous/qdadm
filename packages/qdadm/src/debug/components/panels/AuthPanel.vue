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

// Mark activity as seen when panel is viewed
onMounted(() => {
  props.collector.markSeen?.()
})

// Check for activity
const hasActivity = computed(() => props.collector.hasActivity?.() || false)
const lastEvent = computed(() => props.collector.getLastEvent?.())

function getIcon(type) {
  const icons = {
    user: 'pi-user',
    token: 'pi-key',
    permissions: 'pi-shield',
    adapter: 'pi-cog'
  }
  return icons[type] || 'pi-info-circle'
}
</script>

<template>
  <div class="auth-panel">
    <!-- Activity indicator -->
    <div v-if="hasActivity" class="auth-activity" :class="lastEvent">
      <i :class="['pi', lastEvent === 'login' ? 'pi-sign-in' : 'pi-sign-out']" />
      <span>{{ lastEvent === 'login' ? 'User logged in' : 'User logged out' }}</span>
    </div>

    <div v-for="(entry, idx) in entries" :key="idx" class="auth-item">
      <div class="auth-header">
        <i :class="['pi', getIcon(entry.type)]" />
        <span class="auth-label">{{ entry.label || entry.type }}</span>
      </div>
      <div v-if="entry.message" class="auth-message">{{ entry.message }}</div>
      <ObjectTree v-else-if="entry.data" :data="entry.data" :maxDepth="4" />
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
