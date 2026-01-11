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
import { ZonesPanel, AuthPanel, EntitiesPanel, ToastsPanel, EntriesPanel, SignalsPanel, RouterPanel } from './panels'

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

// Mobile detection
const MOBILE_BREAKPOINT = 768
const isMobile = ref(window.innerWidth < MOBILE_BREAKPOINT)

function updateMobileState() {
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT
}


// Responsive tabs state (applies to bottom and window modes with horizontal header, not mobile)
const headerRef = ref(null)
const headerWidth = ref(1000)
const isHorizontalHeader = computed(() => !isMobile.value && (displayMode.value === 'bottom' || displayMode.value === 'window' || fullscreen.value) && displayMode.value !== 'right')
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
  // Mobile detection on resize
  window.addEventListener('resize', updateMobileState)
})
onUnmounted(() => {
  resizeObserver?.disconnect()
  document.removeEventListener('click', onDocumentClick)
  window.removeEventListener('resize', updateMobileState)
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
  // On mobile, go directly to fullscreen
  if (isMobile.value) {
    fullscreen.value = true
  } else {
    displayMode.value = 'right'
  }
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
    router: 'pi-directions',
    ErrorCollector: 'pi-exclamation-triangle',
    SignalCollector: 'pi-bolt',
    ToastCollector: 'pi-bell',
    ZonesCollector: 'pi-th-large',
    AuthCollector: 'pi-user',
    EntitiesCollector: 'pi-database',
    RouterCollector: 'pi-directions'
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
    router: 'Router',
    ErrorCollector: 'Errors',
    SignalCollector: 'Signals',
    ToastCollector: 'Toasts',
    ZonesCollector: 'Zones',
    AuthCollector: 'Auth',
    EntitiesCollector: 'Entities',
    RouterCollector: 'Router'
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
    entities: '#3b82f6',
    router: '#ec4899'
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
        <!-- Mode toggle (bottom/right) - not shown in window/fullscreen/mobile mode -->
        <button
          v-if="!isMobile && displayMode !== 'window' && !fullscreen"
          class="debug-mode-btn"
          :title="getModeTitle()"
          @click="toggleMode"
        >{{ displayMode === 'bottom' ? '|' : '―' }}</button>
        <!-- Enter window mode button - not in fullscreen/mobile -->
        <Button v-if="!isMobile && displayMode !== 'window' && !fullscreen" icon="pi pi-external-link" severity="secondary" size="small" text rounded title="Detach window" @click="enterWindowMode" />
        <!-- Exit window mode button (dock back) - not on mobile -->
        <Button v-if="!isMobile && displayMode === 'window'" icon="pi pi-link" severity="secondary" size="small" text rounded title="Dock panel" @click="exitWindowMode" />
        <!-- Fullscreen (not in window/mobile mode) -->
        <Button v-if="!isMobile && displayMode !== 'window'" :icon="fullscreen ? 'pi pi-window-minimize' : 'pi pi-window-maximize'" severity="secondary" size="small" text rounded :title="fullscreen ? 'Exit fullscreen' : 'Fullscreen'" @click="toggleFullscreen" />
        <!-- Expand/collapse (not in window/fullscreen/mobile mode) -->
        <Button v-if="!isMobile && displayMode !== 'window' && !fullscreen" :icon="displayMode === 'right' ? (expanded ? 'pi pi-chevron-right' : 'pi pi-chevron-left') : (expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-up')" severity="secondary" size="small" text rounded @click="toggle" />
        <!-- Minimize - always show (on mobile, this is the only way to close) -->
        <Button icon="pi pi-times" severity="secondary" size="small" text rounded title="Close" @click="minimize" />
      </div>
    </div>

    <!-- Resize handle for window mode (not in fullscreen/mobile) -->
    <div v-if="!isMobile && displayMode === 'window' && !fullscreen" class="debug-resize-handle" @mousedown="startResize" />

    <!-- Resize handle for bottom mode (drag to resize height) - not on mobile -->
    <div
      v-if="!isMobile && displayMode === 'bottom' && expanded && !fullscreen"
      class="debug-panel-resize debug-panel-resize-top"
      @mousedown="startPanelResize($event, 'vertical')"
    />

    <!-- Resize handle for right mode (drag to resize width) - not on mobile -->
    <div
      v-if="!isMobile && displayMode === 'right' && expanded && !fullscreen"
      class="debug-panel-resize debug-panel-resize-left"
      @mousedown="startPanelResize($event, 'horizontal')"
    />

    <!-- Content -->
    <div v-if="expanded && currentCollector" class="debug-content">
      <!-- Content header with controls (right/window/fullscreen/mobile mode, for recording collectors) -->
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

      <!-- Router collector -->
      <RouterPanel
        v-else-if="currentCollector.name === 'router' || currentCollector.name === 'RouterCollector'"
        :collector="currentCollector.collector"
        :entries="currentCollector.entries"
      />

      <!-- Toasts collector (vertical modes) -->
      <ToastsPanel
        v-else-if="(currentCollector.name === 'toasts' || currentCollector.name === 'ToastCollector') && (isMobile || displayMode !== 'bottom' || fullscreen)"
        :entries="currentCollector.entries"
      />

      <!-- Empty state for generic collectors without entries -->
      <div v-else-if="currentCollector.entries.length === 0" class="debug-empty">
        <i class="pi pi-inbox" />
        <span>No entries</span>
      </div>

      <!-- Default entries - horizontal (bottom mode, not mobile) -->
      <EntriesPanel
        v-else-if="!isMobile && displayMode === 'bottom' && !fullscreen"
        :entries="currentCollector.entries"
        mode="horizontal"
      />

      <!-- Default entries - vertical (right/fullscreen/mobile mode) -->
      <EntriesPanel
        v-else
        :entries="currentCollector.entries"
        mode="vertical"
      />
    </div>
  </div>
  </Teleport>
</template>

