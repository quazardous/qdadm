<script setup>
/**
 * AuthPanel - Auth collector display with activity indicator
 * Each event has its own timer and fades out before destruction
 */
import { onMounted, ref, onUnmounted } from 'vue'
import ObjectTree from '../ObjectTree.vue'

const props = defineProps({
  collector: { type: Object, required: true },
  entries: { type: Array, required: true }
})

// Local events with fade state
const localEvents = ref([])
const timers = new Map()
let unsubscribe = null

// Mark events as seen when panel is viewed
onMounted(() => {
  props.collector.markSeen?.()
  syncEvents()

  // Subscribe to collector changes
  if (props.collector.onNotify) {
    unsubscribe = props.collector.onNotify(syncEvents)
  }
})

onUnmounted(() => {
  // Unsubscribe from collector
  if (unsubscribe) unsubscribe()

  // Clear all timers
  for (const timer of timers.values()) {
    clearTimeout(timer.fade)
    clearTimeout(timer.destroy)
  }
  timers.clear()
})

/**
 * Sync local events with collector and setup timers
 */
function syncEvents() {
  const collectorEvents = props.collector.getRecentEvents?.() || []
  const ttl = props.collector._eventTtl || 60000
  const fadeTime = 3000 // Start fading 3s before destruction
  const now = Date.now()

  // Add new events
  for (const event of collectorEvents) {
    if (!localEvents.value.find(e => e.id === event.id)) {
      const age = now - event.timestamp.getTime()
      const remaining = ttl - age

      if (remaining > 0) {
        const localEvent = { ...event, fading: false }
        localEvents.value.unshift(localEvent)

        // Setup fade timer
        const fadeDelay = Math.max(0, remaining - fadeTime)
        const fadeTimer = setTimeout(() => {
          localEvent.fading = true
        }, fadeDelay)

        // Setup destroy timer
        const destroyTimer = setTimeout(() => {
          removeEvent(event.id)
        }, remaining)

        timers.set(event.id, { fade: fadeTimer, destroy: destroyTimer })
      }
    }
  }

  // Remove events that no longer exist in collector
  const collectorIds = new Set(collectorEvents.map(e => e.id))
  localEvents.value = localEvents.value.filter(e => {
    if (!collectorIds.has(e.id)) {
      clearEventTimers(e.id)
      return false
    }
    return true
  })
}

function removeEvent(id) {
  clearEventTimers(id)
  localEvents.value = localEvents.value.filter(e => e.id !== id)
}

function clearEventTimers(id) {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer.fade)
    clearTimeout(timer.destroy)
    timers.delete(id)
  }
}

function getIcon(type) {
  const icons = {
    user: 'pi-user',
    impersonated: 'pi-user-edit',
    token: 'pi-key',
    'user-permissions': 'pi-shield',
    permissions: 'pi-list',
    hierarchy: 'pi-sitemap',
    'role-permissions': 'pi-lock',
    adapter: 'pi-cog'
  }
  return icons[type] || 'pi-info-circle'
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour12: false })
}

function getEventIcon(type) {
  const icons = {
    login: 'pi-sign-in',
    logout: 'pi-sign-out',
    impersonate: 'pi-user-edit',
    'impersonate-stop': 'pi-user',
    'login-error': 'pi-times-circle'
  }
  return icons[type] || 'pi-info-circle'
}

function getEventLabel(event) {
  if (event.type === 'login' && event.data) {
    const user = event.data.user
    const username = user?.username || user?.name || user?.email
    if (username) {
      return `User ${username} logged in`
    }
  }
  if (event.type === 'impersonate' && event.data) {
    const data = event.data.data || event.data
    const username = data.target?.username
      || data.username
      || (typeof data === 'string' ? data : null)
    if (username) {
      return `Impersonating user ${username}`
    }
  }
  if (event.type === 'impersonate-stop') {
    const data = event.data?.data || event.data
    const username = data?.original?.username
    if (username) {
      return `Back to ${username}`
    }
  }
  if (event.type === 'login-error' && event.data) {
    const username = event.data.username
    const error = event.data.error || 'Invalid credentials'
    if (username) {
      return `Login failed: ${username} - ${error}`
    }
    return `Login failed: ${error}`
  }
  const labels = {
    login: 'User logged in',
    logout: 'User logged out',
    impersonate: 'Impersonating user',
    'impersonate-stop': 'Stopped impersonation',
    'login-error': 'Login failed'
  }
  return labels[event.type] || event.type
}
</script>

<template>
  <div class="auth-panel">
    <!-- Invariant entries (user, token, permissions, adapter) -->
    <div
      v-for="(entry, idx) in entries"
      :key="idx"
      class="auth-item"
      :class="{ 'auth-item--impersonated': entry.type === 'impersonated' }"
    >
      <div class="auth-header" :class="{ 'auth-header--impersonated': entry.type === 'impersonated' }">
        <i :class="['pi', getIcon(entry.type)]" />
        <span class="auth-label">{{ entry.label || entry.type }}</span>
      </div>
      <div v-if="entry.message" class="auth-message">{{ entry.message }}</div>
      <ObjectTree v-else-if="entry.data" :data="entry.data" :maxDepth="4" />
    </div>

    <!-- Recent auth events with individual timers -->
    <TransitionGroup name="event">
      <div
        v-for="event in localEvents"
        :key="event.id"
        class="auth-activity"
        :class="[event.type, { fading: event.fading }]"
      >
        <i :class="['pi', getEventIcon(event.type)]" />
        <span>{{ getEventLabel(event) }}</span>
        <span class="auth-time">{{ formatTime(event.timestamp) }}</span>
      </div>
    </TransitionGroup>
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
  transition: opacity 3s ease-out, transform 0.3s ease-out;
}

.auth-activity.fading {
  opacity: 0;
}

/* TransitionGroup animations */
.event-enter-active {
  transition: all 0.3s ease-out;
}
.event-leave-active {
  transition: all 0.5s ease-in;
}
.event-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}
.event-leave-to {
  opacity: 0;
  transform: translateY(30px);
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
.auth-activity.impersonate {
  background: linear-gradient(90deg, rgba(249, 115, 22, 0.2) 0%, rgba(249, 115, 22, 0.05) 100%);
  border-left: 3px solid #f97316;
  color: #f97316;
}
.auth-activity.impersonate-stop {
  background: linear-gradient(90deg, rgba(161, 161, 170, 0.2) 0%, rgba(161, 161, 170, 0.05) 100%);
  border-left: 3px solid #a1a1aa;
  color: #a1a1aa;
}
.auth-activity.login-error {
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

.auth-item {
  background: #27272a;
  border-radius: 4px;
  padding: 8px;
}
.auth-item--impersonated {
  background: linear-gradient(90deg, rgba(249, 115, 22, 0.15) 0%, rgba(249, 115, 22, 0.05) 100%);
  border-left: 3px solid #f97316;
}
.auth-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  color: #10b981;
}
.auth-header--impersonated {
  color: #f97316;
}
.auth-label {
  font-weight: 600;
}
.auth-message {
  color: #71717a;
  font-size: 12px;
}
</style>
