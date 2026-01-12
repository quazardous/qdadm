<script setup lang="ts">
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

interface RouteLocation {
  name?: string
  path: string
  fullPath: string
  params?: Record<string, string>
  query?: Record<string, string>
  hash?: string
  meta?: Record<string, unknown>
  matched?: MatchedRoute[]
}

interface MatchedRoute {
  name?: string
  path: string
  meta?: Record<string, unknown>
}

interface NavigationEntry {
  id: string | number
  timestamp: number
  from?: RouteLocation
  to: RouteLocation
  seen?: boolean
}

interface RouteEntry {
  name: string
  path: string
  meta?: Record<string, unknown>
  hasComponent?: boolean
}

interface StackLevel {
  entity: string
  param: string
  id?: string
  foreignKey?: string
  loading?: boolean
  hydrated?: boolean
  hasData?: boolean
  label?: string
}

interface ActiveStack {
  depth: number
  levels: StackLevel[]
}

interface BreadcrumbItem {
  kind: 'route' | 'entity'
  route?: string
  entity?: string
  id?: string
}

interface Tab {
  id: string
  label: string
  icon: string
}

interface RouterCollector {
  navigate: (path: string) => Promise<void>
  getActiveStack: () => ActiveStack | null
  getCurrentRoute: () => RouteLocation | null
  getBreadcrumb: () => BreadcrumbItem[]
  getRoutes: () => RouteEntry[]
  markSeen: () => void
  getBadge: () => number
  [key: string]: unknown
}

const props = defineProps<{
  collector: RouterCollector
  entries: NavigationEntry[]
}>()

// Active tab
const activeTab = ref<string>('current')
const tabs: Tab[] = [
  { id: 'current', label: 'Current', icon: 'pi-map-marker' },
  { id: 'history', label: 'History', icon: 'pi-history' },
  { id: 'routes', label: 'Routes', icon: 'pi-sitemap' }
]

// Route filter for routes tab
const routeFilter = ref<string>('')

// Address bar for navigation
const addressInput = ref<string>('')

async function navigateTo(): Promise<void> {
  const path = addressInput.value.trim()
  if (!path) return
  await props.collector.navigate(path)
  addressInput.value = ''
}

// ActiveStack state
const activeStack = computed<ActiveStack | null>(() => {
  void props.entries.length // trigger reactivity
  return props.collector.getActiveStack()
})

// Max history - persisted in localStorage
const STORAGE_KEY_MAX = 'qdadm-router-max'
const maxHistory = ref<number>(parseInt(localStorage.getItem(STORAGE_KEY_MAX) || '20') || 20)

watch(maxHistory, (val) => {
  localStorage.setItem(STORAGE_KEY_MAX, String(val))
})

// Current route (reactive via entries change)
const currentRoute = computed<RouteLocation | null>(() => {
  // Trigger reactivity from entries
  void props.entries.length
  return props.collector.getCurrentRoute()
})

// Breadcrumb
const breadcrumb = computed<BreadcrumbItem[]>(() => {
  void props.entries.length
  return props.collector.getBreadcrumb()
})

// Matched routes with their individual metas
const matchedRoutes = computed<MatchedRoute[]>(() => {
  void props.entries.length
  return currentRoute.value?.matched ?? []
})

// Navigation history (already newest-first from collector, apply max limit)
const history = computed<NavigationEntry[]>(() => {
  let result: NavigationEntry[] = props.entries
  if (maxHistory.value > 0 && result.length > maxHistory.value) {
    result = result.slice(0, maxHistory.value)
  }
  return result
})

// All routes filtered
const routes = computed<RouteEntry[]>(() => {
  void props.entries.length // trigger
  const all = props.collector.getRoutes()
  if (!routeFilter.value) return all
  const filter = routeFilter.value.toLowerCase()
  return all.filter((r: RouteEntry) =>
    r.name.toLowerCase().includes(filter) ||
    r.path.toLowerCase().includes(filter)
  )
})

// Mark history as seen when viewing history tab
watch(activeTab, (tab: string) => {
  if (tab === 'history') {
    props.collector.markSeen()
  }
})

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
}

function hasParams(obj: Record<string, unknown> | undefined): boolean {
  return obj !== undefined && obj !== null && Object.keys(obj).length > 0
}

// Hydration state helpers
function getHydrationIcon(level: StackLevel): string {
  if (level.loading) return '⏳'
  if (level.hydrated) return level.hasData ? '✓' : '○'
  return '…'
}

function getHydrationClass(level: StackLevel): string {
  if (level.loading) return 'hydration-badge-loading'
  if (level.hydrated) return level.hasData ? 'hydration-badge-data' : 'hydration-badge-ready'
  return 'hydration-badge-pending'
}

function getHydrationTitle(level: StackLevel): string {
  if (level.loading) return 'Loading entity data...'
  if (level.hydrated && level.hasData) return 'Hydrated with data'
  if (level.hydrated) return 'Hydrated (no data to fetch)'
  return 'Pending hydration'
}
</script>

<template>
  <div class="router-panel">
    <!-- Address Bar -->
    <div class="address-bar">
      <i class="pi pi-compass" />
      <input
        v-model="addressInput"
        type="text"
        placeholder="Navigate to path..."
        class="address-input"
        @keyup.enter="navigateTo"
      />
      <button class="address-go" @click="navigateTo" :disabled="!addressInput.trim()">
        <i class="pi pi-arrow-right" />
      </button>
    </div>

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

        <!-- ActiveStack -->
        <div v-if="activeStack" class="route-section">
          <div class="section-label">Active Stack (depth: {{ activeStack.depth }})</div>
          <div v-if="activeStack.levels.length === 0" class="stack-empty">
            <i class="pi pi-inbox" />
            <span>Stack empty (no entity with ID in route)</span>
          </div>
          <div v-else class="stack-list">
            <div
              v-for="(level, idx) in activeStack.levels"
              :key="idx"
              class="stack-entry"
              :class="{
                'stack-current': idx === activeStack.levels.length - 1,
                'stack-loading': level.loading
              }"
            >
              <div class="stack-entry-header">
                <span class="stack-index">{{ idx }}</span>
                <span class="stack-entity">{{ level.entity }}</span>
                <span class="stack-hydration-badge" :class="getHydrationClass(level)" :title="getHydrationTitle(level)">
                  {{ getHydrationIcon(level) }}
                </span>
              </div>
              <div class="stack-entry-props">
                <span class="stack-prop">param: <code>{{ level.param }}</code></span>
                <span class="stack-prop">id: <code>{{ level.id || '—' }}</code></span>
                <span v-if="level.foreignKey" class="stack-prop">fk: <code>{{ level.foreignKey }}</code></span>
              </div>
              <div class="stack-entry-hydration">
                <span v-if="level.loading" class="hydration-loading">⏳ loading...</span>
                <span v-else-if="level.hydrated" class="hydration-ready">
                  <span class="hydration-label">{{ level.label || '(no label)' }}</span>
                  <span v-if="level.hasData" class="hydration-data">📦</span>
                </span>
                <span v-else class="hydration-pending">⏸ pending</span>
              </div>
            </div>
          </div>
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

        <!-- Matched Routes -->
        <div v-if="matchedRoutes.length > 0" class="route-section">
          <div class="section-label">Matched Routes ({{ matchedRoutes.length }})</div>
          <div class="matched-list">
            <div v-for="(match, idx) in matchedRoutes" :key="idx" class="matched-entry">
              <div class="matched-header">
                <span class="matched-index">{{ idx }}</span>
                <span class="matched-name">{{ match.name || '(unnamed)' }}</span>
              </div>
              <div class="matched-path">{{ match.path }}</div>
              <div v-if="hasParams(match.meta)" class="matched-meta">
                <ObjectTree :data="match.meta" :expanded="false" />
              </div>
            </div>
          </div>
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
            <button
              class="history-nav-btn"
              title="Navigate to this route"
              @click="collector.navigate(nav.to.fullPath)"
            >
              <i class="pi pi-external-link" />
            </button>
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
            <span v-if="route.meta?.public" class="meta-tag meta-public">public</span>
            <span v-if="route.meta?.entity" class="meta-tag meta-entity">{{ route.meta.entity }}</span>
            <span v-if="route.meta?.permission" class="meta-tag meta-permission">{{ route.meta.permission }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

