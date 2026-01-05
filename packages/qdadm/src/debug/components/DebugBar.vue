<script setup>
/**
 * DebugBar - Floating debug toolbar for qdadm
 *
 * Display modes:
 * - bottom: wide horizontal layout (entries side by side)
 * - right: vertical sidebar (entries stacked)
 * - window: floating draggable/resizable window
 * - fullscreen: covers entire viewport
 * - minimized: small corner button
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import { ZonesPanel, AuthPanel, EntitiesPanel, ToastsPanel, EntriesPanel, SignalsPanel } from './panels'

const props = defineProps({
  bridge: { type: Object, required: true },
  zIndex: { type: Number, default: 9999 }
})

// Persistence
const STORAGE_KEY = 'qdadm-debug-bar'

const defaultWindowBounds = { x: 100, y: 100, width: 500, height: 400 }
const defaultPanelSizes = { bottomHeight: 180, rightWidth: 420 }

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const state = JSON.parse(saved)
      // Validate windowBounds (min 280x200)
      if (state.windowBounds) {
        const b = state.windowBounds
        if (typeof b.x !== 'number' || typeof b.y !== 'number' ||
            typeof b.width !== 'number' || typeof b.height !== 'number' ||
            b.width < 280 || b.height < 200) {
          state.windowBounds = { ...defaultWindowBounds }
        }
      }
      // Validate panelSizes
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
  } catch (e) { /* ignore */ }
  return { minimized: true, expanded: false, mode: 'bottom', fullscreen: false, windowBounds: { ...defaultWindowBounds }, panelSizes: { ...defaultPanelSizes } }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      minimized: minimized.value,
      expanded: expanded.value,
      mode: displayMode.value,
      fullscreen: fullscreen.value,
      windowBounds: windowBounds.value,
      panelSizes: panelSizes.value,
      countAllBadges: countAllBadges.value
    }))
  } catch (e) { /* ignore */ }
}

const savedState = loadState()

// State
const minimized = ref(savedState.minimized)
const expanded = ref(savedState.expanded)
const displayMode = ref(savedState.mode) // 'bottom', 'right', or 'window'
const fullscreen = ref(savedState.fullscreen || false)
const activeCollector = ref(0)
const countAllBadges = ref(savedState.countAllBadges ?? false) // false = show unseen only

// Reactive tick from bridge - collectors notify when they have new data
const bridgeTick = computed(() => props.bridge?.tick?.value ?? 0)

// Window mode state
const windowBounds = ref(savedState.windowBounds || defaultWindowBounds)
const isDragging = ref(false)
const isResizing = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 })

// Docked panel sizes (resizable)
const panelSizes = ref(savedState.panelSizes || defaultPanelSizes)
const isPanelResizing = ref(false)
const panelResizeStart = ref({ y: 0, x: 0, height: 0, width: 0 })

// Responsive tabs state (applies to bottom and window modes with horizontal header)
const headerRef = ref(null)
const headerWidth = ref(1000)
const isHorizontalHeader = computed(() => (displayMode.value === 'bottom' || displayMode.value === 'window' || fullscreen.value) && displayMode.value !== 'right')
const tabsCompact = computed(() => isHorizontalHeader.value && headerWidth.value < 600)
const tabsDropdown = computed(() => isHorizontalHeader.value && headerWidth.value < 400)
const showTabsDropdown = ref(false)

// Close dropdown when exiting dropdown mode
watch(tabsDropdown, (isDropdown) => {
  if (!isDropdown) showTabsDropdown.value = false
})

let resizeObserver = null
onMounted(() => {
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      headerWidth.value = entry.contentRect.width
    }
  })
  // Close dropdown on outside click
  document.addEventListener('click', onDocumentClick)
})
onUnmounted(() => {
  resizeObserver?.disconnect()
  document.removeEventListener('click', onDocumentClick)
})
watch(headerRef, (el) => {
  resizeObserver?.disconnect()
  if (el) resizeObserver?.observe(el)
}, { immediate: true })

function onDocumentClick(e) {
  if (showTabsDropdown.value && !e.target.closest('.debug-tabs-dropdown')) {
    showTabsDropdown.value = false
  }
}

// Computed
const isEnabled = computed(() => props.bridge?.enabled?.value ?? false)

const collectors = computed(() => {
  bridgeTick.value // Reactive dependency on bridge tick
  const result = []
  if (props.bridge?.collectors) {
    for (const [name, collector] of props.bridge.collectors) {
      result.push({
        name,
        collector,
        badge: collector.getBadge(countAllBadges.value),
        totalBadge: collector.getTotalCount?.() ?? collector.getBadge(true),
        entries: collector.getEntries(),
        records: collector.records, // Does this collector record events?
        enabled: collector.enabled   // Per-collector enabled state
      })
    }
  }
  return result
})

const currentCollector = computed(() => collectors.value[activeCollector.value])
const totalBadge = computed(() => {
  bridgeTick.value // Reactive dependency
  return props.bridge?.getTotalBadge?.(countAllBadges.value) ?? 0
})

// Separate badges for minimized state (always show unseen)
const errorBadge = computed(() => {
  bridgeTick.value // Reactive dependency
  const c = collectors.value.find(c => c.name === 'ErrorCollector' || c.name === 'errors')
  return c?.badge || 0
})
const signalBadge = computed(() => {
  bridgeTick.value // Reactive dependency
  const c = collectors.value.find(c => c.name === 'SignalCollector' || c.name === 'signals')
  return c?.badge || 0
})

// Mark previous collector as seen when leaving tab
watch(activeCollector, (newIdx, oldIdx) => {
  if (oldIdx !== undefined && collectors.value[oldIdx]?.collector?.markAsSeen) {
    collectors.value[oldIdx].collector.markAsSeen()
    props.bridge?.notify()
  }
})

// Mark current collector as seen when collapsing panel
watch(expanded, (isExpanded, wasExpanded) => {
  if (wasExpanded && !isExpanded) {
    const idx = activeCollector.value
    if (collectors.value[idx]?.collector?.markAsSeen) {
      collectors.value[idx].collector.markAsSeen()
      props.bridge?.notify()
    }
  }
})

function toggleCountMode() {
  countAllBadges.value = !countAllBadges.value
  saveState()
  props.bridge?.notify()
}

// Actions
function toggle() {
  expanded.value = !expanded.value
  saveState()
}

function expand() {
  minimized.value = false
  displayMode.value = 'right'
  expanded.value = true
  saveState()
}

function minimize() {
  minimized.value = true
  // Keep expanded state - will be restored when un-minimizing
  fullscreen.value = false
  saveState()
}

function toggleMode() {
  // Toggle between bottom and right (not window)
  if (displayMode.value === 'window') {
    displayMode.value = 'bottom'
  } else {
    displayMode.value = displayMode.value === 'bottom' ? 'right' : 'bottom'
  }
  saveState()
}

function enterWindowMode() {
  displayMode.value = 'window'
  expanded.value = true
  // Ensure window is visible within viewport with min size
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

function exitWindowMode() {
  displayMode.value = 'bottom'
  saveState()
}

function getModeIcon() {
  if (displayMode.value === 'window') return 'pi pi-window-maximize'
  return null // Using custom SVG icons instead
}

function getModeTitle() {
  if (displayMode.value === 'window') return 'Docked mode'
  return displayMode.value === 'bottom' ? 'Dock to right side' : 'Dock to bottom'
}

// Window drag handlers
function startDrag(e) {
  if (displayMode.value !== 'window') return
  isDragging.value = true
  dragOffset.value = {
    x: e.clientX - windowBounds.value.x,
    y: e.clientY - windowBounds.value.y
  }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

function onDrag(e) {
  if (!isDragging.value) return
  windowBounds.value = {
    ...windowBounds.value,
    x: Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffset.value.x)),
    y: Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragOffset.value.y))
  }
}

function stopDrag() {
  if (isDragging.value) {
    isDragging.value = false
    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup', stopDrag)
    saveState()
  }
}

// Window resize handlers
function startResize(e) {
  if (displayMode.value !== 'window') return
  isResizing.value = true
  resizeStart.value = {
    x: e.clientX,
    y: e.clientY,
    width: windowBounds.value.width,
    height: windowBounds.value.height
  }
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
  e.stopPropagation()
}

const MIN_WINDOW_WIDTH = 280
const MIN_WINDOW_HEIGHT = 200

function onResize(e) {
  if (!isResizing.value) return
  const deltaX = e.clientX - resizeStart.value.x
  const deltaY = e.clientY - resizeStart.value.y
  windowBounds.value = {
    ...windowBounds.value,
    width: Math.max(MIN_WINDOW_WIDTH, resizeStart.value.width + deltaX),
    height: Math.max(MIN_WINDOW_HEIGHT, resizeStart.value.height + deltaY)
  }
}

function stopResize() {
  if (isResizing.value) {
    isResizing.value = false
    document.removeEventListener('mousemove', onResize)
    document.removeEventListener('mouseup', stopResize)
    saveState()
  }
}

// Docked panel resize handlers
const MIN_PANEL_HEIGHT = 100
const MAX_PANEL_HEIGHT = 600
const MIN_PANEL_WIDTH = 200
const MAX_PANEL_WIDTH = 800

function startPanelResize(e, direction) {
  if (displayMode.value === 'window' || fullscreen.value) return
  isPanelResizing.value = true
  panelResizeStart.value = {
    y: e.clientY,
    x: e.clientX,
    height: panelSizes.value.bottomHeight,
    width: panelSizes.value.rightWidth
  }
  const handler = direction === 'vertical' ? onPanelResizeVertical : onPanelResizeHorizontal
  const stop = () => stopPanelResize(handler, stop)
  document.addEventListener('mousemove', handler)
  document.addEventListener('mouseup', stop)
  e.preventDefault()
}

function onPanelResizeVertical(e) {
  if (!isPanelResizing.value) return
  const deltaY = panelResizeStart.value.y - e.clientY
  panelSizes.value = {
    ...panelSizes.value,
    bottomHeight: Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, panelResizeStart.value.height + deltaY))
  }
}

function onPanelResizeHorizontal(e) {
  if (!isPanelResizing.value) return
  const deltaX = panelResizeStart.value.x - e.clientX
  panelSizes.value = {
    ...panelSizes.value,
    rightWidth: Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, panelResizeStart.value.width + deltaX))
  }
}

function stopPanelResize(moveHandler, upHandler) {
  if (isPanelResizing.value) {
    isPanelResizing.value = false
    document.removeEventListener('mousemove', moveHandler)
    document.removeEventListener('mouseup', upHandler)
    saveState()
  }
}

// State before entering fullscreen (to restore on exit)
let preFullscreenExpanded = false

function toggleFullscreen() {
  if (!fullscreen.value) {
    // Entering fullscreen - save current state
    preFullscreenExpanded = expanded.value
    fullscreen.value = true
    expanded.value = true
  } else {
    // Exiting fullscreen - restore previous state
    fullscreen.value = false
    expanded.value = preFullscreenExpanded
  }
  saveState()
}

function toggleEnabled() {
  props.bridge?.toggle()
}

function clearAll() {
  props.bridge?.clearAll()
  props.bridge?.notify()
}

function clearCollector(collector) {
  collector.clear()
  props.bridge?.notify()
}

function toggleCollector(collector) {
  collector.toggle()
  props.bridge?.notify()
}

function notifyBridge() {
  props.bridge?.notify()
}

function getCollectorIcon(name) {
  const icons = {
    errors: 'pi-exclamation-triangle',
    signals: 'pi-bolt',
    toasts: 'pi-bell',
    zones: 'pi-th-large',
    auth: 'pi-user',
    entities: 'pi-database',
    ErrorCollector: 'pi-exclamation-triangle',
    SignalCollector: 'pi-bolt',
    ToastCollector: 'pi-bell',
    ZonesCollector: 'pi-th-large',
    AuthCollector: 'pi-user',
    EntitiesCollector: 'pi-database'
  }
  return icons[name] || 'pi-database'
}

function getCollectorLabel(name) {
  const labels = {
    errors: 'Errors',
    signals: 'Signals',
    toasts: 'Toasts',
    zones: 'Zones',
    auth: 'Auth',
    entities: 'Entities',
    ErrorCollector: 'Errors',
    SignalCollector: 'Signals',
    ToastCollector: 'Toasts',
    ZonesCollector: 'Zones',
    AuthCollector: 'Auth',
    EntitiesCollector: 'Entities'
  }
  return labels[name] || name
}

function getCollectorColor(name) {
  const colors = {
    errors: '#ef4444',
    toasts: '#f59e0b',
    signals: '#8b5cf6',
    zones: '#06b6d4',
    auth: '#10b981',
    entities: '#3b82f6'
  }
  return colors[name] || '#6b7280'
}
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
    fullscreen ? 'debug-fullscreen' : `debug-${displayMode}`,
    { 'debug-expanded': expanded }
  ]" :style="displayMode === 'window' && !fullscreen ? {
    zIndex,
    left: windowBounds.x + 'px',
    top: windowBounds.y + 'px',
    width: windowBounds.width + 'px',
    height: windowBounds.height + 'px'
  } : displayMode === 'bottom' && expanded && !fullscreen ? {
    zIndex,
    height: panelSizes.bottomHeight + 'px'
  } : displayMode === 'right' && expanded && !fullscreen ? {
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
          <Badge v-if="currentCollector?.badge > 0" :value="currentCollector.badge" severity="secondary" />
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
          <!-- Per-collector play/pause for recording collectors (bottom mode only, not compact) -->
          <button
            v-if="c.records && displayMode === 'bottom' && !tabsCompact"
            class="debug-tab-toggle"
            :class="{ 'debug-tab-toggle-paused': !c.enabled }"
            :title="c.enabled ? 'Pause recording' : 'Resume recording'"
            @click.stop="toggleCollector(c.collector)"
          >
            <i :class="['pi', c.enabled ? 'pi-pause' : 'pi-play']" />
          </button>
          <!-- Per-collector clear button for recording collectors (bottom mode only, not compact) -->
          <button
            v-if="c.records && c.badge > 0 && displayMode === 'bottom' && !tabsCompact"
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
        <!-- Badge count mode toggle -->
        <Button :icon="countAllBadges ? 'pi pi-hashtag' : 'pi pi-eye'" :severity="countAllBadges ? 'info' : 'secondary'" size="small" text rounded :title="countAllBadges ? 'Showing all (click for unseen only)' : 'Showing unseen (click for all)'" @click="toggleCountMode" />
        <!-- Mode toggle (bottom/right) - not shown in window/fullscreen mode -->
        <button
          v-if="displayMode !== 'window' && !fullscreen"
          class="debug-mode-btn"
          :title="getModeTitle()"
          @click="toggleMode"
        >{{ displayMode === 'bottom' ? '|' : '―' }}</button>
        <!-- Enter window mode button - not in fullscreen -->
        <Button v-if="displayMode !== 'window' && !fullscreen" icon="pi pi-external-link" severity="secondary" size="small" text rounded title="Detach window" @click="enterWindowMode" />
        <!-- Exit window mode button (dock back) -->
        <Button v-if="displayMode === 'window'" icon="pi pi-link" severity="secondary" size="small" text rounded title="Dock panel" @click="exitWindowMode" />
        <!-- Fullscreen (not in window mode) -->
        <Button v-if="displayMode !== 'window'" :icon="fullscreen ? 'pi pi-window-minimize' : 'pi pi-window-maximize'" severity="secondary" size="small" text rounded :title="fullscreen ? 'Exit fullscreen' : 'Fullscreen'" @click="toggleFullscreen" />
        <!-- Expand/collapse (not in window/fullscreen mode) -->
        <Button v-if="displayMode !== 'window' && !fullscreen" :icon="displayMode === 'right' ? (expanded ? 'pi pi-chevron-right' : 'pi pi-chevron-left') : (expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-up')" severity="secondary" size="small" text rounded @click="toggle" />
        <!-- Minimize - not in fullscreen -->
        <Button v-if="!fullscreen" icon="pi pi-arrow-down-right" severity="secondary" size="small" text rounded title="Minimize" @click="minimize" />
      </div>
    </div>

    <!-- Resize handle for window mode (not in fullscreen) -->
    <div v-if="displayMode === 'window' && !fullscreen" class="debug-resize-handle" @mousedown="startResize" />

    <!-- Resize handle for bottom mode (drag to resize height) -->
    <div
      v-if="displayMode === 'bottom' && expanded && !fullscreen"
      class="debug-panel-resize debug-panel-resize-top"
      @mousedown="startPanelResize($event, 'vertical')"
    />

    <!-- Resize handle for right mode (drag to resize width) -->
    <div
      v-if="displayMode === 'right' && expanded && !fullscreen"
      class="debug-panel-resize debug-panel-resize-left"
      @mousedown="startPanelResize($event, 'horizontal')"
    />

    <!-- Content -->
    <div v-if="expanded && currentCollector" class="debug-content">
      <!-- Content header with controls (right/window/fullscreen mode, for recording collectors) -->
      <div v-if="(displayMode === 'right' || displayMode === 'window' || fullscreen) && currentCollector.records" class="debug-content-header">
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

      <!-- Zones collector - always render for toolbar access -->
      <ZonesPanel
        v-if="currentCollector.name === 'zones' || currentCollector.name === 'ZonesCollector'"
        :collector="currentCollector.collector"
        :entries="currentCollector.entries"
        @update="notifyBridge"
      />

      <!-- Signals collector -->
      <SignalsPanel
        v-else-if="currentCollector.name === 'signals' || currentCollector.name === 'SignalCollector'"
        :collector="currentCollector.collector"
        :entries="currentCollector.entries"
      />

      <div v-else-if="currentCollector.entries.length === 0" class="debug-empty">
        <i class="pi pi-inbox" />
        <span>No entries</span>
      </div>

      <!-- Auth collector -->
      <AuthPanel
        v-else-if="currentCollector.name === 'auth' || currentCollector.name === 'AuthCollector'"
        :collector="currentCollector.collector"
        :entries="currentCollector.entries"
      />

      <!-- Entities collector -->
      <EntitiesPanel
        v-else-if="currentCollector.name === 'entities' || currentCollector.name === 'EntitiesCollector'"
        :collector="currentCollector.collector"
        :entries="currentCollector.entries"
        @update="notifyBridge"
      />

      <!-- Toasts collector (vertical modes) -->
      <ToastsPanel
        v-else-if="(currentCollector.name === 'toasts' || currentCollector.name === 'ToastCollector') && (displayMode !== 'bottom' || fullscreen)"
        :entries="currentCollector.entries"
      />

      <!-- Default entries - horizontal (bottom mode) -->
      <EntriesPanel
        v-else-if="displayMode === 'bottom' && !fullscreen"
        :entries="currentCollector.entries"
        mode="horizontal"
      />

      <!-- Default entries - vertical (right/fullscreen mode) -->
      <EntriesPanel
        v-else
        :entries="currentCollector.entries"
        mode="vertical"
      />
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
/* Minimized button */
.debug-minimized {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: #18181b;
  border: 1px solid #3f3f46;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s;
}
.debug-minimized:hover {
  transform: scale(1.08);
  border-color: #60a5fa;
}

/* Separate badges */
.debug-badge {
  position: absolute;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.debug-badge .pi {
  font-size: 8px;
}

/* Header inline badges */
.debug-header-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.debug-header-badge .pi {
  font-size: 10px;
}
.debug-header-badge-error {
  background: #ef4444;
  color: white;
}
.debug-header-badge-signal {
  background: #8b5cf6;
  color: white;
}
.debug-badge-error {
  top: -4px;
  right: -4px;
  background: #ef4444;
  color: white;
}
.debug-badge-signal {
  bottom: -4px;
  right: -4px;
  background: #8b5cf6;
  color: white;
}

/* Panel base */
.debug-panel {
  position: fixed;
  background: #18181b;
  border: 1px solid #3f3f46;
  font-family: system-ui, sans-serif;
  font-size: 13px;
  color: #f4f4f5;
  display: flex;
  flex-direction: column;
}

/* Bottom mode */
.debug-bottom {
  bottom: 0; left: 0; right: 0;
  border-top: 1px solid #3f3f46;
  border-left: none; border-right: none; border-bottom: none;
}
.debug-bottom.debug-expanded {
  min-height: 100px;
  max-height: 600px;
}

/* Right mode - vertical header on left, horizontal slide */
.debug-right {
  top: 0; right: 0; bottom: 0;
  flex-direction: row;
  border-left: 1px solid #3f3f46;
  border-top: none; border-right: none; border-bottom: none;
  transition: transform 0.2s ease-out;
}
.debug-right:not(.debug-expanded) {
  transform: translateX(calc(100% - 44px));
}
.debug-right.debug-expanded {
  min-width: 200px;
  max-width: 800px;
  transform: translateX(0);
}

/* Window mode - floating draggable/resizable */
.debug-window {
  /* Window appearance */
  position: fixed;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  border: 1px solid #3f3f46;
  min-width: 280px;
  min-height: 200px;
}
.debug-window .debug-header {
  cursor: move;
  user-select: none;
  flex-wrap: nowrap;
}
.debug-window .debug-tabs {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.debug-window .debug-actions {
  flex-shrink: 0;
}
.debug-window .debug-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.debug-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, #3f3f46 50%);
  border-bottom-right-radius: 8px;
  z-index: 10;
}
.debug-resize-handle:hover {
  background: linear-gradient(135deg, transparent 50%, #60a5fa 50%);
}

/* Panel resize handles for docked modes */
.debug-panel-resize {
  position: absolute;
  z-index: 10;
  background: transparent;
}
.debug-panel-resize-top {
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  cursor: ns-resize;
}
.debug-panel-resize-top:hover {
  background: linear-gradient(180deg, #60a5fa 0%, transparent 100%);
}
.debug-panel-resize-left {
  top: 0;
  left: 0;
  bottom: 0;
  width: 4px;
  cursor: ew-resize;
}
.debug-panel-resize-left:hover {
  background: linear-gradient(90deg, #60a5fa 0%, transparent 100%);
}

.debug-right .debug-header {
  flex-direction: column;
  width: 44px;
  padding: 8px 6px;
  border-bottom: none;
  border-right: 1px solid #3f3f46;
  align-items: center;
  gap: 4px;
}
.debug-right .debug-title {
  flex-direction: column;
  gap: 4px;
}
.debug-right .debug-title span:not(.debug-header-badge) {
  display: none;
}
.debug-right .debug-tabs {
  flex-direction: column;
  margin-left: 0;
  margin-top: 8px;
  gap: 2px;
}
.debug-right .debug-tab {
  width: 32px;
  height: 32px;
  padding: 0;
  justify-content: center;
  position: relative;
}
.debug-right .debug-tab-label {
  display: none;
}
.debug-right .debug-tab .p-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 14px;
  height: 14px;
  font-size: 9px;
  padding: 0 3px;
}
/* Content header for right mode */
.debug-content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #27272a;
  border-bottom: 1px solid #3f3f46;
  flex-shrink: 0;
}
.debug-content-title {
  font-weight: 600;
  font-size: 12px;
  color: #a1a1aa;
}
.debug-content-controls {
  display: flex;
  gap: 4px;
}
.debug-content-controls .debug-tab-toggle,
.debug-content-controls .debug-tab-clear {
  margin-left: 0;
  width: 22px;
  height: 22px;
}
.debug-right .debug-actions {
  flex-direction: column;
  margin-left: 0;
  margin-top: auto;
  gap: 2px;
}
.debug-right .debug-actions .p-button {
  width: 28px;
  height: 28px;
}
.debug-right .debug-content {
  flex: 1;
  min-width: 0;
}

/* Fullscreen - standalone mode like window but full viewport */
.debug-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: auto;
  height: auto;
  border: none;
  border-radius: 0;
  flex-direction: column;
}
.debug-fullscreen .debug-header {
  flex-direction: row;
  width: auto;
  height: auto;
  padding: 8px 16px;
  border-bottom: 1px solid #3f3f46;
  border-right: none;
}
.debug-fullscreen .debug-title {
  flex-direction: row;
}
.debug-fullscreen .debug-title span:not(.debug-header-badge) {
  display: inline;
}
.debug-fullscreen .debug-tabs {
  flex-direction: row;
  margin-left: 12px;
  margin-top: 0;
}
.debug-fullscreen .debug-tab {
  width: auto;
  height: auto;
  padding: 4px 10px;
}
.debug-fullscreen .debug-tab-label {
  display: inline;
}
.debug-fullscreen .debug-tab .p-badge {
  position: static;
}
.debug-fullscreen .debug-actions {
  flex-direction: row;
  margin-left: auto;
  margin-top: 0;
}
.debug-fullscreen .debug-actions .p-button {
  width: auto;
  height: auto;
}
.debug-fullscreen .debug-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

/* Header */
.debug-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #27272a;
  border-bottom: 1px solid #3f3f46;
  flex-shrink: 0;
}
.debug-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.debug-title-draggable {
  cursor: grab;
}
.debug-title-draggable:active {
  cursor: grabbing;
}
.debug-tabs {
  display: flex;
  gap: 2px;
  margin-left: 12px;
}
.debug-tabs-compact {
  gap: 1px;
}
.debug-tabs-compact .debug-tab {
  padding: 4px 6px;
}
.debug-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #a1a1aa;
  cursor: pointer;
  font-size: 12px;
}
.debug-tab:hover {
  background: #3f3f46;
  color: #f4f4f5;
}
.debug-tab-active {
  background: #3f3f46;
  color: #a78bfa;
}

/* Tabs dropdown mode */
.debug-tabs-dropdown {
  position: relative;
  margin-left: 12px;
  overflow: visible;
}
.debug-dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #3f3f46;
  border: none;
  border-radius: 4px;
  color: #f4f4f5;
  cursor: pointer;
  font-size: 12px;
}
.debug-dropdown-trigger:hover {
  background: #52525b;
}
.debug-dropdown-trigger .pi-chevron-down {
  font-size: 10px;
  color: #71717a;
  margin-left: 4px;
}
.debug-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  min-width: 160px;
  z-index: 10001;
  padding: 4px;
}
.debug-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #a1a1aa;
  cursor: pointer;
  font-size: 12px;
  text-align: left;
}
.debug-dropdown-item:hover {
  background: #3f3f46;
  color: #f4f4f5;
}
.debug-dropdown-item-active {
  background: #3f3f46;
  color: #a78bfa;
}
.debug-actions {
  display: flex;
  gap: 2px;
  margin-left: auto;
}

/* Content */
.debug-content {
  flex: 1;
  overflow: auto;
  background: #18181b;
}
.debug-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #71717a;
  gap: 8px;
}

/* Per-collector toggle button */
.debug-tab-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 4px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 3px;
  color: #71717a;
  cursor: pointer;
  font-size: 9px;
}
.debug-tab-toggle:hover {
  background: #52525b;
  color: #f4f4f5;
}
.debug-tab-toggle-paused {
  color: #f59e0b;
}
.debug-tab-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 2px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 3px;
  color: #71717a;
  cursor: pointer;
  font-size: 9px;
}
.debug-tab-clear:hover {
  background: #ef4444;
  color: white;
}

/* Custom mode toggle button */
.debug-mode-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: #a1a1aa;
  cursor: pointer;
  font-size: 18px;
  font-weight: bold;
  font-family: monospace;
  line-height: 1;
  transition: background-color 0.15s, color 0.15s;
}
.debug-mode-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f4f4f5;
}
</style>
