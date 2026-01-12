<script setup lang="ts">
/**
 * AuthPanel - Auth collector display with activity indicator
 * Each event has its own timer and fades out before destruction
 */
import { onMounted, ref, onUnmounted, inject } from 'vue'
import ObjectTree from '../ObjectTree.vue'

interface AuthEntry {
  type: string
  label?: string
  message?: string
  data?: Record<string, unknown>
}

interface AuthEvent {
  id: string | number
  type: string
  timestamp: Date
  data?: Record<string, unknown>
}

interface LocalEvent extends AuthEvent {
  fading: boolean
}

interface AuthCollector {
  markSeen?: () => void
  onNotify?: (callback: () => void) => () => void
  getRecentEvents?: () => AuthEvent[]
  _eventTtl?: number
  [key: string]: unknown
}

interface AuthAdapter {
  destroySession?: () => void
  [key: string]: unknown
}

interface EventTimers {
  fade: ReturnType<typeof setTimeout>
  destroy: ReturnType<typeof setTimeout>
}

const props = defineProps<{
  collector: AuthCollector
  entries: AuthEntry[]
}>()

// Inject auth adapter for token loss simulation
const authAdapter = inject<AuthAdapter | null>('authAdapter', null)

/**
 * Destroy session without normal logout flow
 * Simulates catastrophic token loss (server revocation, storage corruption)
 */
function destroySession(): void {
  if (authAdapter?.destroySession) {
    authAdapter.destroySession()
  }
}

// Local events with fade state
const localEvents = ref<LocalEvent[]>([])
const timers = new Map<string | number, EventTimers>()
let unsubscribe: (() => void) | null = null

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
function syncEvents(): void {
  const collectorEvents = props.collector.getRecentEvents?.() || []
  const ttl = props.collector._eventTtl || 60000
  const fadeTime = 3000 // Start fading 3s before destruction
  const now = Date.now()

  // Add new events
  for (const event of collectorEvents) {
    if (!localEvents.value.find((e: LocalEvent) => e.id === event.id)) {
      const age = now - event.timestamp.getTime()
      const remaining = ttl - age

      if (remaining > 0) {
        const localEvent: LocalEvent = { ...event, fading: false }
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
  const collectorIds = new Set(collectorEvents.map((e: AuthEvent) => e.id))
  localEvents.value = localEvents.value.filter((e: LocalEvent) => {
    if (!collectorIds.has(e.id)) {
      clearEventTimers(e.id)
      return false
    }
    return true
  })
}

function removeEvent(id: string | number): void {
  clearEventTimers(id)
  localEvents.value = localEvents.value.filter((e: LocalEvent) => e.id !== id)
}

function clearEventTimers(id: string | number): void {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer.fade)
    clearTimeout(timer.destroy)
    timers.delete(id)
  }
}

function getIcon(type: string): string {
  const icons: Record<string, string> = {
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour12: false })
}

function getEventIcon(type: string): string {
  const icons: Record<string, string> = {
    login: 'pi-sign-in',
    logout: 'pi-sign-out',
    impersonate: 'pi-user-edit',
    'impersonate-stop': 'pi-user',
    'login-error': 'pi-times-circle'
  }
  return icons[type] || 'pi-info-circle'
}

function getEventLabel(event: LocalEvent): string {
  if (event.type === 'login' && event.data) {
    const user = event.data.user as Record<string, unknown> | undefined
    const username = user?.username || user?.name || user?.email
    if (username) {
      return `User ${username} logged in`
    }
  }
  if (event.type === 'impersonate' && event.data) {
    const data = (event.data.data || event.data) as Record<string, unknown>
    const target = data.target as Record<string, unknown> | undefined
    const username = target?.username
      || data.username
      || (typeof data === 'string' ? data : null)
    if (username) {
      return `Impersonating user ${username}`
    }
  }
  if (event.type === 'impersonate-stop') {
    const data = (event.data?.data || event.data) as Record<string, unknown> | undefined
    const original = data?.original as Record<string, unknown> | undefined
    const username = original?.username
    if (username) {
      return `Back to ${username}`
    }
  }
  if (event.type === 'login-error' && event.data) {
    const username = event.data.username as string | undefined
    const error = (event.data.error as string) || 'Invalid credentials'
    if (username) {
      return `Login failed: ${username} - ${error}`
    }
    return `Login failed: ${error}`
  }
  const labels: Record<string, string> = {
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
    <!-- Debug actions -->
    <div class="debug-panel-toolbar">
      <button class="debug-toolbar-btn debug-toolbar-btn--danger" @click="destroySession" title="Clear token without logout (simulate session loss)">
        <i class="pi pi-power-off" />
        Destroy Session
      </button>
    </div>

    <div class="auth-panel-content">
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
  </div>
</template>

