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

/**
 * How long an entry stays in the list (#2677): `none` is not recorded, `short`
 * is dropped after `shortKeepMs` (read or not), `long` stays until cleared or
 * pushed out by the cap.
 */
export type NotificationKeep = 'none' | 'short' | 'long'

/** Where an entry leads when clicked: a vue-router location. */
export type NotificationTarget = { name: string; params?: Record<string, unknown>; query?: Record<string, unknown> } | string

export interface Notification {
  id: string
  severity: NotificationSeverity
  summary: string
  detail?: string
  emitter?: string
  timestamp: number
  read: boolean
  keep: Exclude<NotificationKeep, 'none'>
  /** When a `short` entry leaves the list; null for `long`. */
  expiresAt: number | null
  to?: NotificationTarget
}

/** What `addNotification` takes: `keep` defaults by severity, see `NotificationStoreConfig.keep`. */
export interface NewNotification {
  severity: NotificationSeverity
  summary: string
  detail?: string
  emitter?: string
  keep?: NotificationKeep
  to?: NotificationTarget
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
  /** Keep level per severity. Default: success and info `short`, warn and error `long`. */
  keep?: Partial<Record<NotificationSeverity, NotificationKeep>>
  /** How long a `short` entry stays, in ms. Default 5 minutes. */
  shortKeepMs?: number
  /** Ongoing activity shorter than this shows nothing on the badge, in ms. Default 400. */
  activityDelayMs?: number
}

const DEFAULT_KEEP: Record<NotificationSeverity, NotificationKeep> = {
  success: 'short',
  info: 'short',
  warn: 'long',
  error: 'long',
}

export interface NotificationStore {
  // Notifications (captured toasts)
  notifications: ComputedRef<Notification[]>
  unreadCount: ComputedRef<number>
  hasAlert: ComputedRef<boolean>
  /** Records an entry and returns its id — `''` when its keep level is `none`. */
  addNotification(n: NewNotification): string
  markRead(id: string): void
  markAllRead(): void
  removeNotification(id: string): void
  clearNotifications(): void

  // Status items (custom module items)
  statusItems: ComputedRef<StatusItem[]>
  registerStatus(item: StatusItem): void
  updateStatus(id: string, updates: Partial<StatusItem>): void
  removeStatus(id: string): void

  // Activity (#2677)
  /** Counts `work` as in progress until it settles, and returns it unchanged. */
  track<T>(work: Promise<T>): Promise<T>
  /** True once tracked work has been in progress for `activityDelayMs`. */
  isBusy: ComputedRef<boolean>

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
  const keepBySeverity = { ...DEFAULT_KEEP, ...(config.keep ?? {}) }
  const shortKeepMs = config.shortKeepMs ?? 5 * 60 * 1000
  const activityDelayMs = config.activityDelayMs ?? 400

  const state = reactive<NotificationState>({
    notifications: [],
    statusItems: [],
  })

  const isOpen = ref(false)

  // ── Notifications ──────────────────────────────────────────────────────

  // A `short` entry leaves when it expires; one timer, set for the soonest.
  let pruneTimer: ReturnType<typeof setTimeout> | null = null

  function schedulePrune(): void {
    if (pruneTimer) clearTimeout(pruneTimer)
    pruneTimer = null
    const soonest = state.notifications.reduce<number | null>(
      (min, n) => (n.expiresAt !== null && (min === null || n.expiresAt < min) ? n.expiresAt : min),
      null
    )
    if (soonest === null) return
    pruneTimer = setTimeout(prune, Math.max(0, soonest - Date.now()))
  }

  function prune(): void {
    const now = Date.now()
    for (let i = state.notifications.length - 1; i >= 0; i--) {
      const expiresAt = state.notifications[i]!.expiresAt
      if (expiresAt !== null && expiresAt <= now) state.notifications.splice(i, 1)
    }
    schedulePrune()
  }

  function addNotification(n: NewNotification): string {
    const keep = n.keep ?? keepBySeverity[n.severity] ?? 'long'
    if (keep === 'none') return ''

    const id = `notif-${++_idCounter}-${Date.now()}`
    const timestamp = Date.now()
    const notification: Notification = {
      severity: n.severity,
      summary: n.summary,
      ...(n.detail !== undefined ? { detail: n.detail } : {}),
      ...(n.emitter !== undefined ? { emitter: n.emitter } : {}),
      ...(n.to !== undefined ? { to: n.to } : {}),
      id,
      timestamp,
      read: false,
      keep,
      expiresAt: keep === 'short' ? timestamp + shortKeepMs : null,
    }

    // Add to front (most recent first)
    state.notifications.unshift(notification)

    // Trim to max
    if (state.notifications.length > maxNotifications) {
      state.notifications.length = maxNotifications
    }

    if (notification.expiresAt !== null) schedulePrune()
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

  // ── Activity ───────────────────────────────────────────────────────────

  const inFlight = ref(0)
  const busy = ref(false)
  let busyTimer: ReturnType<typeof setTimeout> | null = null

  function track<T>(work: Promise<T>): Promise<T> {
    inFlight.value++
    if (inFlight.value === 1) {
      // Only work that lasts shows: a fast reload leaves the badge alone.
      busyTimer = setTimeout(() => {
        busyTimer = null
        if (inFlight.value > 0) busy.value = true
      }, activityDelayMs)
    }
    const settle = (): void => {
      inFlight.value = Math.max(0, inFlight.value - 1)
      if (inFlight.value > 0) return
      if (busyTimer) clearTimeout(busyTimer)
      busyTimer = null
      busy.value = false
    }
    work.then(settle, settle)
    return work
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
    track,
    isBusy: computed(() => busy.value),
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
      track: (work) => work,
      isBusy: computed(() => false),
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
