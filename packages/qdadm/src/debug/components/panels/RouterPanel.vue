<script setup>
/**
 * RouterPanel - Debug panel for Vue Router state
 *
 * Displays:
 * - Current route (name, path, params, query, meta)
 * - Computed breadcrumb
 * - Navigation history (recent route changes)
 * - All registered routes
 */
import { ref, computed, watch } from 'vue'
import ObjectTree from '../ObjectTree.vue'

const props = defineProps({
  collector: { type: Object, required: true },
  entries: { type: Array, required: true }
})

// Active tab
const activeTab = ref('current')
const tabs = [
  { id: 'current', label: 'Current', icon: 'pi-map-marker' },
  { id: 'history', label: 'History', icon: 'pi-history' },
  { id: 'routes', label: 'Routes', icon: 'pi-sitemap' }
]

// Route filter for routes tab
const routeFilter = ref('')

// Max history - persisted in localStorage
const STORAGE_KEY_MAX = 'qdadm-router-max'
const maxHistory = ref(parseInt(localStorage.getItem(STORAGE_KEY_MAX)) || 20)

watch(maxHistory, (val) => {
  localStorage.setItem(STORAGE_KEY_MAX, String(val))
})

// Current route (reactive via entries change)
const currentRoute = computed(() => {
  // Trigger reactivity from entries
  props.entries.length
  return props.collector.getCurrentRoute()
})

// Breadcrumb
const breadcrumb = computed(() => {
  props.entries.length
  return props.collector.getBreadcrumb()
})

// Navigation history (already newest-first from collector, apply max limit)
const history = computed(() => {
  let result = props.entries
  if (maxHistory.value > 0 && result.length > maxHistory.value) {
    result = result.slice(0, maxHistory.value)
  }
  return result
})

// All routes filtered
const routes = computed(() => {
  props.entries.length // trigger
  const all = props.collector.getRoutes()
  if (!routeFilter.value) return all
  const filter = routeFilter.value.toLowerCase()
  return all.filter(r =>
    r.name.toLowerCase().includes(filter) ||
    r.path.toLowerCase().includes(filter)
  )
})

// Mark history as seen when viewing history tab
watch(activeTab, (tab) => {
  if (tab === 'history') {
    props.collector.markSeen()
  }
})

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
}

function hasParams(obj) {
  return obj && Object.keys(obj).length > 0
}
</script>

<template>
  <div class="router-panel">
    <!-- Tabs -->
    <div class="router-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="router-tab"
        :class="{ 'router-tab-active': activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <i :class="['pi', tab.icon]" />
        {{ tab.label }}
        <span v-if="tab.id === 'history' && collector.getBadge() > 0" class="tab-badge">
          {{ collector.getBadge() }}
        </span>
        <span v-if="tab.id === 'routes'" class="tab-count">
          {{ routes.length }}
        </span>
      </button>
    </div>

    <!-- Current Route -->
    <div v-if="activeTab === 'current'" class="router-content">
      <div v-if="currentRoute" class="route-current">
        <!-- Route name and path -->
        <div class="route-header">
          <span class="route-name">{{ currentRoute.name }}</span>
          <span class="route-path">{{ currentRoute.fullPath }}</span>
        </div>

        <!-- Breadcrumb -->
        <div v-if="breadcrumb.length > 0" class="route-section">
          <div class="section-label">Breadcrumb</div>
          <div class="breadcrumb-list">
            <div v-for="(item, idx) in breadcrumb" :key="idx" class="breadcrumb-entry" :class="'breadcrumb-' + item.kind">
              <div class="breadcrumb-entry-header">
                <span class="breadcrumb-index">{{ idx + 1 }}</span>
                <span class="breadcrumb-kind">{{ item.kind }}</span>
              </div>
              <div class="breadcrumb-entry-props">
                <template v-if="item.kind === 'route'">
                  <span class="breadcrumb-prop">route: <code>{{ item.route }}</code></span>
                </template>
                <template v-else>
                  <span class="breadcrumb-prop">entity: <code>{{ item.entity }}</code></span>
                  <span v-if="item.id" class="breadcrumb-prop">id: <code>{{ item.id }}</code></span>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- Params -->
        <div v-if="hasParams(currentRoute.params)" class="route-section">
          <div class="section-label">Params</div>
          <ObjectTree :data="currentRoute.params" :expanded="true" />
        </div>

        <!-- Query -->
        <div v-if="hasParams(currentRoute.query)" class="route-section">
          <div class="section-label">Query</div>
          <ObjectTree :data="currentRoute.query" :expanded="true" />
        </div>

        <!-- Meta -->
        <div v-if="hasParams(currentRoute.meta)" class="route-section">
          <div class="section-label">Meta</div>
          <ObjectTree :data="currentRoute.meta" :expanded="false" />
        </div>

        <!-- Hash -->
        <div v-if="currentRoute.hash" class="route-section">
          <div class="section-label">Hash</div>
          <code class="route-hash">{{ currentRoute.hash }}</code>
        </div>
      </div>
      <div v-else class="router-empty">
        <i class="pi pi-compass" />
        <span>No route active</span>
      </div>
    </div>

    <!-- History -->
    <div v-if="activeTab === 'history'" class="router-content">
      <!-- Max selector -->
      <div class="history-header-bar">
        <span class="history-stats">{{ history.length }}/{{ entries.length }}</span>
        <div class="history-max">
          <label>Max:</label>
          <select v-model.number="maxHistory" class="max-select">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>
      </div>
      <div v-if="history.length === 0" class="router-empty">
        <i class="pi pi-history" />
        <span>No navigation history</span>
      </div>
      <div v-else class="history-list">
        <div
          v-for="nav in history"
          :key="nav.id"
          class="history-entry"
          :class="{ 'history-new': !nav.seen }"
        >
          <div class="history-header">
            <span v-if="!nav.seen" class="history-dot" title="New" />
            <span class="history-time">{{ formatTime(nav.timestamp) }}</span>
            <span class="history-arrow">
              <template v-if="nav.from">
                {{ nav.from.name }}
                <i class="pi pi-arrow-right" />
              </template>
              {{ nav.to.name }}
            </span>
          </div>
          <div class="history-path">{{ nav.to.fullPath }}</div>
        </div>
      </div>
    </div>

    <!-- Routes -->
    <div v-if="activeTab === 'routes'" class="router-content">
      <div class="routes-filter">
        <i class="pi pi-search" />
        <input
          v-model="routeFilter"
          type="text"
          placeholder="Filter routes..."
          class="filter-input"
        />
      </div>
      <div class="routes-list">
        <div
          v-for="route in routes"
          :key="route.path"
          class="route-entry"
          :class="{
            'route-current-entry': currentRoute?.name === route.name,
            'route-internal': route.name?.startsWith('_')
          }"
        >
          <div class="route-entry-header">
            <span class="route-entry-name">{{ route.name }}</span>
            <span v-if="!route.hasComponent" class="route-no-component" title="No component">
              <i class="pi pi-exclamation-triangle" />
            </span>
          </div>
          <div class="route-entry-path">{{ route.path }}</div>
          <div v-if="hasParams(route.meta)" class="route-entry-meta">
            <span v-if="route.meta.public" class="meta-tag meta-public">public</span>
            <span v-if="route.meta.entity" class="meta-tag meta-entity">{{ route.meta.entity }}</span>
            <span v-if="route.meta.permission" class="meta-tag meta-permission">{{ route.meta.permission }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.router-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.router-tabs {
  display: flex;
  gap: 2px;
  padding: 8px 12px;
  background: #27272a;
  border-bottom: 1px solid #3f3f46;
}

.router-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  font-size: 11px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #a1a1aa;
  cursor: pointer;
}

.router-tab:hover {
  background: #3f3f46;
  color: #f4f4f5;
}

.router-tab-active {
  background: #3b82f6;
  color: white;
}

.router-tab .pi {
  font-size: 12px;
}

.tab-badge {
  background: #f59e0b;
  color: #18181b;
  font-size: 10px;
  padding: 0 5px;
  border-radius: 8px;
  font-weight: 600;
}

.tab-count {
  font-size: 10px;
  color: #71717a;
}

.router-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.router-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #71717a;
  gap: 8px;
}

.router-empty .pi {
  font-size: 24px;
}

/* Current Route */
.route-current {
  padding: 8px;
}

.route-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.route-name {
  font-size: 14px;
  font-weight: 600;
  color: #3b82f6;
}

.route-path {
  font-size: 12px;
  font-family: monospace;
  color: #a1a1aa;
  word-break: break-all;
}

/* Breadcrumb list */
.breadcrumb-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.breadcrumb-entry {
  padding: 6px 8px;
  background: #27272a;
  border-radius: 4px;
  font-size: 11px;
  border-left: 2px solid #3f3f46;
}

.breadcrumb-entry-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.breadcrumb-index {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #3f3f46;
  border-radius: 50%;
  font-size: 10px;
  color: #a1a1aa;
}

.breadcrumb-kind {
  font-weight: 500;
  color: #f4f4f5;
}

.breadcrumb-entry-props {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding-left: 24px;
  margin-top: 4px;
}

.breadcrumb-prop {
  color: #71717a;
  font-size: 10px;
}

.breadcrumb-prop code {
  color: #60a5fa;
  background: #18181b;
  padding: 1px 4px;
  border-radius: 2px;
}

/* Kind-based colors */
.breadcrumb-route {
  border-left-color: #71717a;
}

.breadcrumb-entity-list {
  border-left-color: #3b82f6;
}

.breadcrumb-entity-show {
  border-left-color: #10b981;
}

.breadcrumb-entity-edit {
  border-left-color: #f59e0b;
}

.breadcrumb-entity-create {
  border-left-color: #8b5cf6;
}

.breadcrumb-entity-delete {
  border-left-color: #ef4444;
}

.route-section {
  margin-bottom: 12px;
}

.section-label {
  font-size: 10px;
  font-weight: 600;
  color: #71717a;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.route-hash {
  font-size: 12px;
  color: #fbbf24;
  background: #27272a;
  padding: 2px 6px;
  border-radius: 3px;
}

/* History */
.history-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: #27272a;
  border-radius: 4px;
  margin-bottom: 8px;
}

.history-stats {
  font-size: 11px;
  color: #71717a;
}

.history-max {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #a1a1aa;
}

.max-select {
  padding: 2px 6px;
  font-size: 11px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  color: #f4f4f5;
  cursor: pointer;
}

.max-select:focus {
  border-color: #3b82f6;
  outline: none;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-entry {
  padding: 8px;
  background: #27272a;
  border-radius: 4px;
  font-size: 12px;
}

.history-entry:hover {
  background: #3f3f46;
}

.history-new {
  border-left: 2px solid #f59e0b;
  padding-left: 6px;
}

.history-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-dot {
  width: 6px;
  height: 6px;
  background: #f59e0b;
  border-radius: 50%;
  flex-shrink: 0;
}

.history-time {
  font-size: 10px;
  color: #71717a;
  font-family: monospace;
}

.history-arrow {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #d4d4d8;
}

.history-arrow .pi {
  font-size: 10px;
  color: #52525b;
}

.history-path {
  font-size: 11px;
  color: #71717a;
  font-family: monospace;
  margin-top: 4px;
  word-break: break-all;
}

/* Routes */
.routes-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #27272a;
  border-radius: 4px;
  margin-bottom: 8px;
}

.routes-filter .pi {
  color: #71717a;
  font-size: 12px;
}

.filter-input {
  flex: 1;
  font-size: 12px;
  padding: 4px 8px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  color: #f4f4f5;
}

.filter-input:focus {
  border-color: #3b82f6;
  outline: none;
}

.routes-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.route-entry {
  padding: 8px;
  background: #27272a;
  border-radius: 4px;
  font-size: 12px;
}

.route-entry:hover {
  background: #3f3f46;
}

.route-current-entry {
  border-left: 2px solid #3b82f6;
  padding-left: 6px;
}

.route-internal {
  opacity: 0.6;
}

.route-internal .route-entry-name {
  font-style: italic;
}

.route-entry-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.route-entry-name {
  font-weight: 500;
  color: #d4d4d8;
}

.route-no-component {
  color: #f59e0b;
  font-size: 10px;
}

.route-entry-path {
  font-size: 11px;
  color: #71717a;
  font-family: monospace;
  margin-top: 2px;
}

.route-entry-meta {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.meta-tag {
  padding: 1px 6px;
  font-size: 10px;
  border-radius: 3px;
}

.meta-public {
  background: #065f46;
  color: #6ee7b7;
}

.meta-entity {
  background: #1e3a5f;
  color: #93c5fd;
}

.meta-permission {
  background: #4c1d95;
  color: #c4b5fd;
}
</style>
