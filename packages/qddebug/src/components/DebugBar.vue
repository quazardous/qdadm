<script setup lang="ts">
/**
 * DebugBar - Panel-pluggable floating debug toolbar.
 *
 * Display modes:
 * - bottom: wide horizontal layout (entries side by side)
 * - right: vertical sidebar (entries stacked)
 * - window: floating draggable/resizable window
 * - fullscreen: covers entire viewport
 * - minimized: small corner button
 *
 * Panels are pluggable: pass `panels` mapping collector names to Vue
 * components, and `collectorMeta` to override default labels/icons/colors.
 * Generic panels (`signals`, `toasts`, plus a default entries fallback) are
 * built in; qdadm/qdcms layer their own (auth, entities, router, zones, …).
 */
import { ref, computed, watch, onMounted, onUnmounted, type Ref, type Component } from 'vue'
import Badge from 'primevue/badge'
import Button from 'primevue/button'

import EntriesPanel from './panels/EntriesPanel.vue'
import SignalsPanel from './panels/SignalsPanel.vue'
import ToastsPanel from './panels/ToastsPanel.vue'

type DisplayMode = 'bottom' | 'right' | 'window'

interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

interface PanelSizes {
  bottomHeight: number
  rightWidth: number
}

interface SavedState {
  minimized: boolean
  expanded: boolean
  mode: DisplayMode
  fullscreen: boolean
  windowBounds: WindowBounds
  panelSizes: PanelSizes
  countAllBadges?: boolean
}

interface Collector {
  getBadge: (countAll?: boolean) => number
  getEntries: () => unknown[]
  records?: boolean
  enabled?: boolean
  clear: () => void
  toggle: () => void
  markAsSeen?: () => void
  [key: string]: unknown
}

interface CollectorEntry {
  name: string
  collector: Collector
  badge: number
  entries: unknown[]
  records?: boolean
  enabled?: boolean
}

interface DebugBridge {
  enabled?: Ref<boolean>
  tick?: Ref<number>
  collectors?: Map<string, Collector>
  toggle: () => void
  clearAll: () => void
  notify: () => void
  [key: string]: unknown
}

export interface CollectorMeta {
  icon?: string
  label?: string
  color?: string
}

const props = withDefaults(defineProps<{
  bridge: DebugBridge
  zIndex?: number
  /** localStorage key for persisting bar state. */
  storageKey?: string
  /**
   * Map of collector name → Vue component to render that collector's content.
   * Overrides built-in defaults. Built-ins: signals, toasts. All other
   * collectors fall back to a generic entries list.
   */
  panels?: Record<string, Component>
  /**
   * Per-collector display metadata (label/icon/color). Merged on top of
   * built-in metadata for `errors`, `signals`, `toasts`.
   */
  collectorMeta?: Record<string, CollectorMeta>
}>(), {
  zIndex: 9999,
  storageKey: 'qddebug',
  panels: () => ({}),
  collectorMeta: () => ({}),
})

const STORAGE_KEY = computed(() => props.storageKey)

const defaultWindowBounds: WindowBounds = { x: 100, y: 100, width: 500, height: 400 }
const defaultPanelSizes: PanelSizes = { bottomHeight: 180, rightWidth: 420 }

function loadState(): SavedState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY.value)
    if (saved) {
      const state = JSON.parse(saved) as SavedState
      if (state.windowBounds) {
        const b = state.windowBounds
        if (typeof b.x !== 'number' || typeof b.y !== 'number' ||
            typeof b.width !== 'number' || typeof b.height !== 'number' ||
            b.width < 280 || b.height < 200) {
          state.windowBounds = { ...defaultWindowBounds }
        }
      }
      if (state.panelSizes) {
        const p = state.panelSizes
        if (typeof p.bottomHeight !== 'number' || p.bottomHeight < 100) {
          p.bottomHeight = defaultPanelSizes.bottomHeight
        }
        if (typeof p.rightWidth !== 'number' || p.rightWidth < 200) {
          p.rightWidth = defaultPanelSizes.rightWidth
        }
      } else {
        state.panelSizes = { ...defaultPanelSizes }
      }
      return state
    }
  } catch { /* ignore */ }
  return { minimized: true, expanded: false, mode: 'bottom', fullscreen: false, windowBounds: { ...defaultWindowBounds }, panelSizes: { ...defaultPanelSizes } }
}

function saveState(): void {
  try {
    localStorage.setItem(STORAGE_KEY.value, JSON.stringify({
      minimized: minimized.value,
      expanded: expanded.value,
      mode: displayMode.value,
      fullscreen: fullscreen.value,
      windowBounds: windowBounds.value,
      panelSizes: panelSizes.value,
      countAllBadges: countAllBadges.value
    }))
  } catch { /* ignore */ }
}

const savedState = loadState()

const minimized = ref<boolean>(savedState.minimized)
const expanded = ref<boolean>(savedState.expanded)
const displayMode = ref<DisplayMode>(savedState.mode)
const fullscreen = ref<boolean>(savedState.fullscreen || false)
const activeCollector = ref<number>(0)
const countAllBadges = ref<boolean>(savedState.countAllBadges ?? false)

const bridgeTick = computed<number>(() => props.bridge?.tick?.value ?? 0)

const windowBounds = ref<WindowBounds>(savedState.windowBounds || defaultWindowBounds)
const isDragging = ref<boolean>(false)
const isResizing = ref<boolean>(false)
const dragOffset = ref<{ x: number; y: number }>({ x: 0, y: 0 })
const resizeStart = ref<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 })

const panelSizes = ref<PanelSizes>(savedState.panelSizes || defaultPanelSizes)
const isPanelResizing = ref<boolean>(false)
const panelResizeStart = ref<{ y: number; x: number; height: number; width: number }>({ y: 0, x: 0, height: 0, width: 0 })

const MOBILE_BREAKPOINT = 768
const isMobile = ref<boolean>(window.innerWidth < MOBILE_BREAKPOINT)

function updateMobileState(): void {
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT
}

const headerRef = ref<HTMLElement | null>(null)
const headerWidth = ref<number>(1000)
const isHorizontalHeader = computed<boolean>(() => !isMobile.value && (displayMode.value === 'bottom' || displayMode.value === 'window' || fullscreen.value) && displayMode.value !== 'right')
const tabsCompact = computed<boolean>(() => isHorizontalHeader.value && headerWidth.value < 600)
const tabsDropdown = computed<boolean>(() => isHorizontalHeader.value && headerWidth.value < 400)
const showTabsDropdown = ref<boolean>(false)

watch(tabsDropdown, (isDropdown: boolean) => {
  if (!isDropdown) showTabsDropdown.value = false
})

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
    for (const entry of entries) {
      headerWidth.value = entry.contentRect.width
    }
  })
  document.addEventListener('click', onDocumentClick)
  window.addEventListener('resize', updateMobileState)
})
onUnmounted(() => {
  resizeObserver?.disconnect()
  document.removeEventListener('click', onDocumentClick)
  window.removeEventListener('resize', updateMobileState)
})
watch(headerRef, (el: HTMLElement | null) => {
  resizeObserver?.disconnect()
  if (el) resizeObserver?.observe(el)
}, { immediate: true })

function onDocumentClick(e: MouseEvent): void {
  if (showTabsDropdown.value && !(e.target as Element).closest('.debug-tabs-dropdown')) {
    showTabsDropdown.value = false
  }
}

const isEnabled = computed<boolean>(() => props.bridge?.enabled?.value ?? false)

const collectors = computed<CollectorEntry[]>(() => {
  void bridgeTick.value
  const result: CollectorEntry[] = []
  if (props.bridge?.collectors) {
    for (const [name, collector] of props.bridge.collectors) {
      result.push({
        name,
        collector,
        badge: collector.getBadge(countAllBadges.value),
        entries: collector.getEntries(),
        records: collector.records,
        enabled: collector.enabled
      })
    }
  }
  return result
})

const currentCollector = computed<CollectorEntry | undefined>(() => collectors.value[activeCollector.value])

const errorBadge = computed<number>(() => {
  void bridgeTick.value
  const c = collectors.value.find((c: CollectorEntry) => c.name === 'ErrorCollector' || c.name === 'errors')
  return c?.badge || 0
})
const signalBadge = computed<number>(() => {
  void bridgeTick.value
  const c = collectors.value.find((c: CollectorEntry) => c.name === 'SignalCollector' || c.name === 'signals')
  return c?.badge || 0
})

watch(activeCollector, (newIdx: number, oldIdx: number | undefined) => {
  if (oldIdx !== undefined && collectors.value[oldIdx]?.collector?.markAsSeen) {
    collectors.value[oldIdx].collector.markAsSeen!()
    props.bridge?.notify()
  }
})

watch(expanded, (isExpanded: boolean, wasExpanded: boolean) => {
  if (wasExpanded && !isExpanded) {
    const idx = activeCollector.value
    if (collectors.value[idx]?.collector?.markAsSeen) {
      collectors.value[idx].collector.markAsSeen!()
      props.bridge?.notify()
    }
  }
})

function toggleCountMode(): void {
  countAllBadges.value = !countAllBadges.value
  saveState()
  props.bridge?.notify()
}

function toggle(): void {
  expanded.value = !expanded.value
  saveState()
}

function expand(): void {
  minimized.value = false
  if (isMobile.value) {
    fullscreen.value = true
  } else {
    displayMode.value = 'right'
  }
  expanded.value = true
  saveState()
}

function minimize(): void {
  minimized.value = true
  fullscreen.value = false
  saveState()
}

function toggleMode(): void {
  if (displayMode.value === 'window') {
    displayMode.value = 'bottom'
  } else {
    displayMode.value = displayMode.value === 'bottom' ? 'right' : 'bottom'
  }
  saveState()
}

function enterWindowMode(): void {
  displayMode.value = 'window'
  expanded.value = true
  const vw = window.innerWidth
  const vh = window.innerHeight
  const bounds = windowBounds.value
  const width = Math.max(280, Math.min(bounds.width, vw - 40))
  const height = Math.max(200, Math.min(bounds.height, vh - 40))
  windowBounds.value = {
    x: Math.max(20, Math.min(vw - width - 20, bounds.x)),
    y: Math.max(20, Math.min(vh - height - 20, bounds.y)),
    width,
    height
  }
  saveState()
}

function exitWindowMode(): void {
  displayMode.value = 'bottom'
  saveState()
}

function getModeTitle(): string {
  if (displayMode.value === 'window') return 'Docked mode'
  return displayMode.value === 'bottom' ? 'Dock to right side' : 'Dock to bottom'
}

function startDrag(e: MouseEvent): void {
  if (displayMode.value !== 'window') return
  isDragging.value = true
  dragOffset.value = { x: e.clientX - windowBounds.value.x, y: e.clientY - windowBounds.value.y }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

function onDrag(e: MouseEvent): void {
  if (!isDragging.value) return
  windowBounds.value = {
    ...windowBounds.value,
    x: Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffset.value.x)),
    y: Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragOffset.value.y))
  }
}

function stopDrag(): void {
  if (isDragging.value) {
    isDragging.value = false
    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup', stopDrag)
    saveState()
  }
}

function startResize(e: MouseEvent): void {
  if (displayMode.value !== 'window') return
  isResizing.value = true
  resizeStart.value = { x: e.clientX, y: e.clientY, width: windowBounds.value.width, height: windowBounds.value.height }
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
  e.stopPropagation()
}

const MIN_WINDOW_WIDTH = 280
const MIN_WINDOW_HEIGHT = 200

function onResize(e: MouseEvent): void {
  if (!isResizing.value) return
  const deltaX = e.clientX - resizeStart.value.x
  const deltaY = e.clientY - resizeStart.value.y
  windowBounds.value = {
    ...windowBounds.value,
    width: Math.max(MIN_WINDOW_WIDTH, resizeStart.value.width + deltaX),
    height: Math.max(MIN_WINDOW_HEIGHT, resizeStart.value.height + deltaY)
  }
}

function stopResize(): void {
  if (isResizing.value) {
    isResizing.value = false
    document.removeEventListener('mousemove', onResize)
    document.removeEventListener('mouseup', stopResize)
    saveState()
  }
}

const MIN_PANEL_HEIGHT = 100
const MAX_PANEL_HEIGHT = 600
const MIN_PANEL_WIDTH = 200
const MAX_PANEL_WIDTH = 800

function startPanelResize(e: MouseEvent, direction: 'vertical' | 'horizontal'): void {
  if (displayMode.value === 'window' || fullscreen.value) return
  isPanelResizing.value = true
  panelResizeStart.value = { y: e.clientY, x: e.clientX, height: panelSizes.value.bottomHeight, width: panelSizes.value.rightWidth }
  const handler = direction === 'vertical' ? onPanelResizeVertical : onPanelResizeHorizontal
  const stop = () => stopPanelResize(handler, stop)
  document.addEventListener('mousemove', handler)
  document.addEventListener('mouseup', stop)
  e.preventDefault()
}

function onPanelResizeVertical(e: MouseEvent): void {
  if (!isPanelResizing.value) return
  const deltaY = panelResizeStart.value.y - e.clientY
  panelSizes.value = {
    ...panelSizes.value,
    bottomHeight: Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, panelResizeStart.value.height + deltaY))
  }
}

function onPanelResizeHorizontal(e: MouseEvent): void {
  if (!isPanelResizing.value) return
  const deltaX = panelResizeStart.value.x - e.clientX
  panelSizes.value = {
    ...panelSizes.value,
    rightWidth: Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, panelResizeStart.value.width + deltaX))
  }
}

function stopPanelResize(moveHandler: (e: MouseEvent) => void, upHandler: () => void): void {
  if (isPanelResizing.value) {
    isPanelResizing.value = false
    document.removeEventListener('mousemove', moveHandler)
    document.removeEventListener('mouseup', upHandler)
    saveState()
  }
}

let preFullscreenExpanded = false

function toggleFullscreen(): void {
  if (!fullscreen.value) {
    preFullscreenExpanded = expanded.value
    fullscreen.value = true
    expanded.value = true
  } else {
    fullscreen.value = false
    expanded.value = preFullscreenExpanded
  }
  saveState()
}

function toggleEnabled(): void {
  props.bridge?.toggle()
}

function clearAll(): void {
  props.bridge?.clearAll()
  props.bridge?.notify()
}

function clearCollector(collector: Collector): void {
  collector.clear()
  props.bridge?.notify()
}

function toggleCollector(collector: Collector): void {
  collector.toggle()
  props.bridge?.notify()
}

function notifyBridge(): void {
  props.bridge?.notify()
}

// ─── Built-in collector metadata (overridable via collectorMeta prop) ────────

const BUILTIN_META: Record<string, CollectorMeta> = {
  errors: { icon: 'pi-exclamation-triangle', label: 'Errors', color: '#ef4444' },
  signals: { icon: 'pi-bolt', label: 'Signals', color: '#8b5cf6' },
  toasts: { icon: 'pi-bell', label: 'Toasts', color: '#f59e0b' },
  i18n: { icon: 'pi-globe', label: 'i18n', color: '#ec4899' },
  // Class-name aliases for legacy collector identifiers
  ErrorCollector: { icon: 'pi-exclamation-triangle', label: 'Errors', color: '#ef4444' },
  SignalCollector: { icon: 'pi-bolt', label: 'Signals', color: '#8b5cf6' },
  ToastCollector: { icon: 'pi-bell', label: 'Toasts', color: '#f59e0b' },
  I18nCollector: { icon: 'pi-globe', label: 'i18n', color: '#ec4899' },
}

function metaFor(name: string | undefined): CollectorMeta {
  if (!name) return {}
  return { ...BUILTIN_META[name], ...props.collectorMeta?.[name] }
}

function getCollectorIcon(name: string | undefined): string {
  return metaFor(name).icon ?? 'pi-database'
}

function getCollectorLabel(name: string | undefined): string {
  return metaFor(name).label ?? name ?? ''
}

function getCollectorColor(name: string | undefined): string {
  return metaFor(name).color ?? '#6b7280'
}

// ─── Built-in panel resolution ───────────────────────────────────────────────

const BUILTIN_PANELS: Record<string, Component> = {
  signals: SignalsPanel,
  SignalCollector: SignalsPanel,
  toasts: ToastsPanel,
  ToastCollector: ToastsPanel,
}

function panelFor(name: string | undefined): Component | null {
  if (!name) return null
  return props.panels?.[name] ?? BUILTIN_PANELS[name] ?? null
}

const currentPanel = computed<Component | null>(() => panelFor(currentCollector.value?.name))
</script>

<template>
  <Teleport to="body">
    <!-- Minimized: corner button with separate badges -->
    <div v-if="minimized" class="debug-minimized" :style="{ zIndex }" @click="expand">
      <svg viewBox="0 0 100 100" width="28" height="28">
        <polygon points="50,5 93,27.5 93,72.5 50,95 7,72.5 7,27.5" fill="#1E3A8A"/>
        <text x="48" y="50" text-anchor="middle" dominant-baseline="central" font-family="system-ui" font-size="58" font-weight="800" letter-spacing="-4">
          <tspan fill="#60A5FA">Q</tspan><tspan fill="#93C5FD">D</tspan>
        </text>
      </svg>
      <div v-if="errorBadge > 0 || signalBadge > 0" class="debug-badges">
        <span v-if="errorBadge > 0" class="debug-badge debug-badge-error" title="Errors">
          <i class="pi pi-exclamation-triangle" />{{ errorBadge }}
        </span>
        <span v-if="signalBadge > 0" class="debug-badge debug-badge-signal" title="Signals">
          <i class="pi pi-bolt" />{{ signalBadge }}
        </span>
      </div>
    </div>

    <!-- Full panel -->
    <div v-else class="debug-panel" :class="[
      isMobile ? 'debug-mobile' : (fullscreen ? 'debug-fullscreen' : `debug-${displayMode}`),
      { 'debug-expanded': expanded }
    ]" :style="!isMobile && displayMode === 'window' && !fullscreen ? {
      zIndex,
      left: windowBounds.x + 'px',
      top: windowBounds.y + 'px',
      width: windowBounds.width + 'px',
      height: windowBounds.height + 'px'
    } : !isMobile && displayMode === 'bottom' && expanded && !fullscreen ? {
      zIndex,
      height: panelSizes.bottomHeight + 'px'
    } : !isMobile && displayMode === 'right' && expanded && !fullscreen ? {
      zIndex,
      width: panelSizes.rightWidth + 'px'
    } : { zIndex }">
      <!-- Header -->
      <div ref="headerRef" class="debug-header" @mousedown="displayMode === 'window' && !fullscreen ? startDrag($event) : null" :class="{ 'debug-header-draggable': displayMode === 'window' && !fullscreen }">
        <div class="debug-title" :class="{ 'debug-title-draggable': displayMode === 'window' && !fullscreen }">
          <svg viewBox="0 0 100 100" width="18" height="18">
            <polygon points="50,5 93,27.5 93,72.5 50,95 7,72.5 7,27.5" fill="#1E3A8A"/>
            <text x="48" y="50" text-anchor="middle" dominant-baseline="central" font-family="system-ui" font-size="58" font-weight="800" letter-spacing="-4">
              <tspan fill="#60A5FA">Q</tspan><tspan fill="#93C5FD">D</tspan>
            </text>
          </svg>
          <span>Debug</span>
          <span v-if="errorBadge > 0" class="debug-header-badge debug-header-badge-error" title="Errors">
            <i class="pi pi-exclamation-triangle" />{{ errorBadge }}
          </span>
          <span v-if="signalBadge > 0" class="debug-header-badge debug-header-badge-signal" title="Signals">
            <i class="pi pi-bolt" />{{ signalBadge }}
          </span>
        </div>

        <!-- Collector tabs - dropdown mode when very narrow -->
        <div v-if="expanded && tabsDropdown" class="debug-tabs-dropdown">
          <button class="debug-dropdown-trigger" @click="showTabsDropdown = !showTabsDropdown">
            <i :class="['pi', getCollectorIcon(currentCollector?.name)]" :style="{ color: getCollectorColor(currentCollector?.name) }" />
            <span>{{ getCollectorLabel(currentCollector?.name) }}</span>
            <Badge v-if="currentCollector && currentCollector.badge > 0" :value="currentCollector.badge" severity="secondary" />
            <i class="pi pi-chevron-down" />
          </button>
          <div v-if="showTabsDropdown" class="debug-dropdown-menu" @click="showTabsDropdown = false">
            <button
              v-for="(c, idx) in collectors"
              :key="c.name"
              class="debug-dropdown-item"
              :class="{ 'debug-dropdown-item-active': activeCollector === idx }"
              @click="activeCollector = idx"
            >
              <i :class="['pi', getCollectorIcon(c.name)]" :style="{ color: getCollectorColor(c.name) }" />
              <span>{{ getCollectorLabel(c.name) }}</span>
              <Badge v-if="c.badge > 0" :value="c.badge" severity="secondary" />
            </button>
          </div>
        </div>

        <!-- Collector tabs - normal/compact mode -->
        <div v-else-if="expanded" class="debug-tabs" :class="{ 'debug-tabs-compact': tabsCompact }">
          <button
            v-for="(c, idx) in collectors"
            :key="c.name"
            class="debug-tab"
            :class="{ 'debug-tab-active': activeCollector === idx }"
            :title="getCollectorLabel(c.name)"
            @click="activeCollector = idx"
          >
            <i :class="['pi', getCollectorIcon(c.name)]" :style="{ color: getCollectorColor(c.name) }" />
            <span v-if="!tabsCompact" class="debug-tab-label">{{ getCollectorLabel(c.name) }}</span>
            <Badge v-if="c.badge > 0" :value="c.badge" severity="secondary" />
            <button
              v-if="c.records && displayMode === 'bottom' && !tabsCompact && !isMobile"
              class="debug-tab-toggle"
              :class="{ 'debug-tab-toggle-paused': !c.enabled }"
              :title="c.enabled ? 'Pause recording' : 'Resume recording'"
              @click.stop="toggleCollector(c.collector)"
            >
              <i :class="['pi', c.enabled ? 'pi-pause' : 'pi-play']" />
            </button>
            <button
              v-if="c.records && c.badge > 0 && displayMode === 'bottom' && !tabsCompact && !isMobile"
              class="debug-tab-clear"
              title="Clear entries"
              @click.stop="clearCollector(c.collector)"
            >
              <i class="pi pi-trash" />
            </button>
          </button>
        </div>

        <div class="debug-actions">
          <Button :icon="isEnabled ? 'pi pi-pause' : 'pi pi-play'" :severity="isEnabled ? 'success' : 'secondary'" size="small" text rounded :title="isEnabled ? 'Pause' : 'Resume'" @click="toggleEnabled" />
          <Button icon="pi pi-trash" severity="secondary" size="small" text rounded title="Clear all" @click="clearAll" />
          <Button :icon="countAllBadges ? 'pi pi-hashtag' : 'pi pi-eye'" :severity="countAllBadges ? 'info' : 'secondary'" size="small" text rounded :title="countAllBadges ? 'Showing all (click for unseen only)' : 'Showing unseen (click for all)'" @click="toggleCountMode" />
          <button
            v-if="!isMobile && displayMode !== 'window' && !fullscreen"
            class="debug-mode-btn"
            :title="getModeTitle()"
            @click="toggleMode"
          >{{ displayMode === 'bottom' ? '|' : '―' }}</button>
          <Button v-if="!isMobile && displayMode !== 'window' && !fullscreen" icon="pi pi-external-link" severity="secondary" size="small" text rounded title="Detach window" @click="enterWindowMode" />
          <Button v-if="!isMobile && displayMode === 'window'" icon="pi pi-link" severity="secondary" size="small" text rounded title="Dock panel" @click="exitWindowMode" />
          <Button v-if="!isMobile && displayMode !== 'window'" :icon="fullscreen ? 'pi pi-window-minimize' : 'pi pi-window-maximize'" severity="secondary" size="small" text rounded :title="fullscreen ? 'Exit fullscreen' : 'Fullscreen'" @click="toggleFullscreen" />
          <Button v-if="!isMobile && displayMode !== 'window' && !fullscreen" :icon="displayMode === 'right' ? (expanded ? 'pi pi-chevron-right' : 'pi pi-chevron-left') : (expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-up')" severity="secondary" size="small" text rounded @click="toggle" />
          <Button icon="pi pi-times" severity="secondary" size="small" text rounded title="Close" @click="minimize" />
        </div>
      </div>

      <!-- Resize handle for window mode -->
      <div v-if="!isMobile && displayMode === 'window' && !fullscreen" class="debug-resize-handle" @mousedown="startResize" />

      <!-- Resize handle for bottom mode -->
      <div
        v-if="!isMobile && displayMode === 'bottom' && expanded && !fullscreen"
        class="debug-panel-resize debug-panel-resize-top"
        @mousedown="startPanelResize($event, 'vertical')"
      />

      <!-- Resize handle for right mode -->
      <div
        v-if="!isMobile && displayMode === 'right' && expanded && !fullscreen"
        class="debug-panel-resize debug-panel-resize-left"
        @mousedown="startPanelResize($event, 'horizontal')"
      />

      <!-- Content -->
      <div v-if="expanded && currentCollector" class="debug-content">
        <div v-if="(isMobile || displayMode === 'right' || displayMode === 'window' || fullscreen) && currentCollector.records" class="debug-content-header">
          <span class="debug-content-title">{{ getCollectorLabel(currentCollector.name) }}</span>
          <div class="debug-content-controls">
            <button
              class="debug-tab-toggle"
              :class="{ 'debug-tab-toggle-paused': !currentCollector.enabled }"
              :title="currentCollector.enabled ? 'Pause recording' : 'Resume recording'"
              @click="toggleCollector(currentCollector.collector)"
            >
              <i :class="['pi', currentCollector.enabled ? 'pi-pause' : 'pi-play']" />
            </button>
            <button
              v-if="currentCollector.badge > 0"
              class="debug-tab-clear"
              title="Clear entries"
              @click="clearCollector(currentCollector.collector)"
            >
              <i class="pi pi-trash" />
            </button>
          </div>
        </div>

        <!-- Custom panel for this collector (from props.panels or built-in) -->
        <component
          v-if="currentPanel"
          :is="currentPanel"
          :collector="(currentCollector.collector as any)"
          :entries="(currentCollector.entries as any[])"
          @update="notifyBridge"
        />

        <!-- Empty state for unknown collectors with no entries -->
        <div v-else-if="currentCollector.entries.length === 0" class="debug-empty">
          <i class="pi pi-inbox" />
          <span>No entries</span>
        </div>

        <!-- Default entries fallback - horizontal (bottom mode, not mobile) -->
        <EntriesPanel
          v-else-if="!isMobile && displayMode === 'bottom' && !fullscreen"
          :entries="(currentCollector.entries as any[])"
          mode="horizontal"
        />

        <!-- Default entries fallback - vertical -->
        <EntriesPanel
          v-else
          :entries="(currentCollector.entries as any[])"
          mode="vertical"
        />
      </div>
    </div>
  </Teleport>
</template>
