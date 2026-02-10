/**
 * NotificationStore - Reactive store for notification panel
 *
 * Manages captured toast notifications and custom status items.
 * Uses Vue provide/inject pattern (same as useInfoBanner).
 *
 * @example
 * // In app root (Kernel handles this automatically)
 * const store = provideNotificationStore()
 *
 * // In any component
 * const { notifications, unreadCount, addNotification } = useNotifications()
 *
 * // Register a custom status item from a module
 * const { registerStatus } = useNotifications()
 * registerStatus({ id: 'overdue', label: '3 books overdue', severity: 'warn', count: 3 })
 */
import {
  inject,
  provide,
  reactive,
  computed,
  ref,
  type ComputedRef,
  type Ref,
  type InjectionKey,
} from 'vue'

const NOTIFICATION_KEY: InjectionKey<NotificationStore> = Symbol('qdadm-notifications')

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationSeverity = 'success' | 'info' | 'warn' | 'error'

export interface Notification {
  id: string
  severity: NotificationSeverity
  summary: string
  detail?: string
  emitter?: string
  timestamp: number
  read: boolean
}

export interface StatusItem {
  id: string
  label: string
  severity: 'nominal' | 'warn' | 'error'
  count?: number
  icon?: string
  /** Route location for navigation (vue-router LocationAsRelativeRaw) */
  to?: { name: string; params?: Record<string, unknown>; query?: Record<string, unknown> }
}

export interface NotificationStoreConfig {
  maxNotifications?: number
}

export interface NotificationStore {
  // Notifications (captured toasts)
  notifications: ComputedRef<Notification[]>
  unreadCount: ComputedRef<number>
  hasAlert: ComputedRef<boolean>
  addNotification(n: Omit<Notification, 'id' | 'timestamp' | 'read'>): string
  markRead(id: string): void
  markAllRead(): void
  removeNotification(id: string): void
  clearNotifications(): void

  // Status items (custom module items)
  statusItems: ComputedRef<StatusItem[]>
  registerStatus(item: StatusItem): void
  updateStatus(id: string, updates: Partial<StatusItem>): void
  removeStatus(id: string): void

  // Panel state
  isOpen: Ref<boolean>
  open(): void
  close(): void
  toggle(): void
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal state
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationState {
  notifications: Notification[]
  statusItems: StatusItem[]
}

let _idCounter = 0

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a notification store instance
 */
export function createNotificationStore(config: NotificationStoreConfig = {}): NotificationStore {
  const maxNotifications = config.maxNotifications ?? 50

  const state = reactive<NotificationState>({
    notifications: [],
    statusItems: [],
  })

  const isOpen = ref(false)

  // ── Notifications ──────────────────────────────────────────────────────

  function addNotification(n: Omit<Notification, 'id' | 'timestamp' | 'read'>): string {
    const id = `notif-${++_idCounter}-${Date.now()}`
    const notification: Notification = {
      ...n,
      id,
      timestamp: Date.now(),
      read: false,
    }

    // Add to front (most recent first)
    state.notifications.unshift(notification)

    // Trim to max
    if (state.notifications.length > maxNotifications) {
      state.notifications.length = maxNotifications
    }

    return id
  }

  function markRead(id: string): void {
    const notif = state.notifications.find((n) => n.id === id)
    if (notif) {
      notif.read = true
    }
  }

  function markAllRead(): void {
    for (const notif of state.notifications) {
      notif.read = true
    }
  }

  function removeNotification(id: string): void {
    const index = state.notifications.findIndex((n) => n.id === id)
    if (index !== -1) {
      state.notifications.splice(index, 1)
    }
  }

  function clearNotifications(): void {
    state.notifications.length = 0
  }

  // ── Status items ───────────────────────────────────────────────────────

  function registerStatus(item: StatusItem): void {
    const existing = state.statusItems.findIndex((s) => s.id === item.id)
    if (existing !== -1) {
      state.statusItems.splice(existing, 1, item)
    } else {
      state.statusItems.push(item)
    }
  }

  function updateStatus(id: string, updates: Partial<StatusItem>): void {
    const item = state.statusItems.find((s) => s.id === id)
    if (item) {
      Object.assign(item, updates)
    }
  }

  function removeStatus(id: string): void {
    const index = state.statusItems.findIndex((s) => s.id === id)
    if (index !== -1) {
      state.statusItems.splice(index, 1)
    }
  }

  // ── Panel state ────────────────────────────────────────────────────────

  function open(): void {
    isOpen.value = true
  }

  function close(): void {
    isOpen.value = false
  }

  function toggle(): void {
    isOpen.value = !isOpen.value
  }

  // ── Computed ───────────────────────────────────────────────────────────

  const notifications = computed(() => state.notifications)
  const statusItems = computed(() => state.statusItems)

  const unreadCount = computed(() =>
    state.notifications.filter((n) => !n.read).length
  )

  const hasAlert = computed(() => {
    // Unread error/warn notifications
    const hasUnreadAlert = state.notifications.some(
      (n) => !n.read && (n.severity === 'error' || n.severity === 'warn')
    )
    // Status items with alert severity
    const hasStatusAlert = state.statusItems.some(
      (s) => s.severity === 'error' || s.severity === 'warn'
    )
    return hasUnreadAlert || hasStatusAlert
  })

  return {
    notifications,
    unreadCount,
    hasAlert,
    addNotification,
    markRead,
    markAllRead,
    removeNotification,
    clearNotifications,
    statusItems,
    registerStatus,
    updateStatus,
    removeStatus,
    isOpen,
    open,
    close,
    toggle,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provide / Inject
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Provide the notification store to descendant components.
 * Call this in your app root or layout component.
 */
export function provideNotificationStore(config: NotificationStoreConfig = {}): NotificationStore {
  const store = createNotificationStore(config)
  provide(NOTIFICATION_KEY, store)
  return store
}

/**
 * Use the notification store in a component.
 * Returns a no-op store if not provided (graceful fallback).
 */
export function useNotifications(): NotificationStore {
  const store = inject(NOTIFICATION_KEY)

  if (!store) {
    // Return a no-op store to prevent crashes
    return {
      notifications: computed(() => []),
      unreadCount: computed(() => 0),
      hasAlert: computed(() => false),
      addNotification: () => '',
      markRead: () => {},
      markAllRead: () => {},
      removeNotification: () => {},
      clearNotifications: () => {},
      statusItems: computed(() => []),
      registerStatus: () => {},
      updateStatus: () => {},
      removeStatus: () => {},
      isOpen: ref(false),
      open: () => {},
      close: () => {},
      toggle: () => {},
    }
  }

  return store
}

/**
 * Injection key for direct use with provide/inject
 */
export { NOTIFICATION_KEY }
