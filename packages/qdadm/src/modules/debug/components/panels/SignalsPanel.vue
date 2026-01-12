<script setup lang="ts">
/**
 * SignalsPanel - Debug panel for signals with pattern filter
 *
 * Supports QuarKernel wildcard patterns:
 * - auth:** → all auth signals (auth:login, auth:impersonate:start)
 * - cache:** → all cache signals
 * - *:created → all creation signals
 * - ** → all signals (default)
 */
import { ref, computed, watch } from 'vue'
import InputText from 'primevue/inputtext'
import ObjectTree from '../ObjectTree.vue'

interface SignalEntry {
  name: string
  timestamp: number
  data?: Record<string, unknown>
  _isNew?: boolean
}

interface SignalCollector {
  // Collector interface - minimal typing for now
  [key: string]: unknown
}

interface FilterPreset {
  label: string
  pattern: string
}

const props = defineProps<{
  collector: SignalCollector
  entries: SignalEntry[]
}>()

// Filter state - persisted in localStorage
const STORAGE_KEY = 'qdadm-signals-filter'
const STORAGE_KEY_MAX = 'qdadm-signals-max'
const filterPattern = ref<string>(localStorage.getItem(STORAGE_KEY) || '')
const maxSignals = ref<number>(parseInt(localStorage.getItem(STORAGE_KEY_MAX) || '50') || 50)

watch(filterPattern, (val) => {
  localStorage.setItem(STORAGE_KEY, val)
})

watch(maxSignals, (val) => {
  localStorage.setItem(STORAGE_KEY_MAX, String(val))
})

// Convert wildcard pattern to regex
function wildcardToRegex(pattern: string): RegExp | null {
  if (!pattern || pattern === '**') return null // No filter

  // Escape regex special chars except * and :
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    // ** matches anything (including colons)
    .replace(/\*\*/g, '.*')
    // * matches anything except colon
    .replace(/\*/g, '[^:]*')

  return new RegExp(`^${regex}$`)
}

const filterRegex = computed<RegExp | null>(() => wildcardToRegex(filterPattern.value.trim()))

// Apply filter, max limit, and reverse for top-down (newest first)
const filteredEntries = computed<SignalEntry[]>(() => {
  let result: SignalEntry[] = props.entries
  if (filterRegex.value) {
    result = result.filter((e: SignalEntry) => filterRegex.value!.test(e.name))
  }
  // Apply max limit (slice from end to keep newest)
  if (maxSignals.value > 0 && result.length > maxSignals.value) {
    result = result.slice(-maxSignals.value)
  }
  // Reverse for top-down display (newest first)
  return [...result].reverse()
})

const filterStats = computed<string>(() => {
  const total = props.entries.length
  const shown = filteredEntries.value.length
  return total !== shown ? `${shown}/${total}` : `${total}`
})

// Preset filters
const presets: FilterPreset[] = [
  { label: 'All', pattern: '' },
  { label: 'data', pattern: 'entity:data-invalidate' },
  { label: 'datalayer', pattern: 'entity:datalayer-invalidate' },
  { label: 'auth', pattern: 'auth:**' },
  { label: 'entity', pattern: 'entity:**' },
  { label: 'toast', pattern: 'toast:**' }
]

function applyPreset(pattern: string): void {
  filterPattern.value = pattern
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
}

// Extract domain from signal name (first segment)
function getDomain(name: string): string {
  return name.split(':')[0] ?? ''
}

const domainColors: Record<string, string> = {
  auth: '#10b981',
  cache: '#f59e0b',
  entity: '#3b82f6',
  toast: '#8b5cf6',
  route: '#06b6d4',
  error: '#ef4444'
}

function getDomainColor(name: string): string {
  const domain = getDomain(name)
  return domainColors[domain] || '#6b7280'
}
</script>

<template>
  <div class="signals-panel">
    <!-- Filter bar -->
    <div class="signals-filter">
      <div class="signals-filter-input">
        <i class="pi pi-filter" />
        <InputText
          v-model="filterPattern"
          placeholder="Filter: auth:** cache:** *:created"
          class="filter-input"
        />
        <span class="signals-count">{{ filterStats }}</span>
        <span class="signals-max-label">max</span>
        <input
          v-model.number="maxSignals"
          type="number"
          min="10"
          max="500"
          class="max-input"
        />
      </div>
      <div class="signals-presets">
        <button
          v-for="p in presets"
          :key="p.pattern"
          class="debug-toolbar-btn"
          :class="{ 'debug-toolbar-btn--active': filterPattern === p.pattern }"
          @click="applyPreset(p.pattern)"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <!-- Entries list -->
    <div class="signals-list">
      <div v-if="filteredEntries.length === 0" class="signals-empty">
        <i class="pi pi-inbox" />
        <span>{{ entries.length === 0 ? 'No signals' : 'No matching signals' }}</span>
      </div>

      <div
        v-for="(entry, idx) in filteredEntries"
        :key="idx"
        class="signal-entry"
        :class="{ 'signal-new': entry._isNew }"
      >
        <div class="signal-header">
          <span v-if="entry._isNew" class="signal-new-dot" title="New (unseen)" />
          <span class="signal-time">{{ formatTime(entry.timestamp) }}</span>
          <span class="signal-name" :style="{ color: getDomainColor(entry.name) }">
            {{ entry.name }}
          </span>
        </div>
        <div v-if="entry.data && Object.keys(entry.data).length > 0" class="signal-data">
          <ObjectTree :data="entry.data" :expanded="false" />
        </div>
      </div>
    </div>
  </div>
</template>

