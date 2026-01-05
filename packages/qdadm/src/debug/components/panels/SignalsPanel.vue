<script setup>
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

const props = defineProps({
  collector: { type: Object, required: true },
  entries: { type: Array, required: true }
})

// Filter state - persisted in localStorage
const STORAGE_KEY = 'qdadm-signals-filter'
const STORAGE_KEY_MAX = 'qdadm-signals-max'
const filterPattern = ref(localStorage.getItem(STORAGE_KEY) || '')
const maxSignals = ref(parseInt(localStorage.getItem(STORAGE_KEY_MAX)) || 50)

watch(filterPattern, (val) => {
  localStorage.setItem(STORAGE_KEY, val)
})

watch(maxSignals, (val) => {
  localStorage.setItem(STORAGE_KEY_MAX, String(val))
})

// Convert wildcard pattern to regex
function wildcardToRegex(pattern) {
  if (!pattern || pattern === '**') return null // No filter

  // Escape regex special chars except * and :
  let regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    // ** matches anything (including colons)
    .replace(/\*\*/g, '.*')
    // * matches anything except colon
    .replace(/\*/g, '[^:]*')

  return new RegExp(`^${regex}$`)
}

const filterRegex = computed(() => wildcardToRegex(filterPattern.value.trim()))

// Apply filter, max limit, and reverse for top-down (newest first)
const filteredEntries = computed(() => {
  let result = props.entries
  if (filterRegex.value) {
    result = result.filter(e => filterRegex.value.test(e.name))
  }
  // Apply max limit (slice from end to keep newest)
  if (maxSignals.value > 0 && result.length > maxSignals.value) {
    result = result.slice(-maxSignals.value)
  }
  // Reverse for top-down display (newest first)
  return [...result].reverse()
})

const filterStats = computed(() => {
  const total = props.entries.length
  const shown = filteredEntries.value.length
  return total !== shown ? `${shown}/${total}` : `${total}`
})

// Preset filters
const presets = [
  { label: 'All', pattern: '' },
  { label: 'data', pattern: 'entity:data-invalidate' },
  { label: 'datalayer', pattern: 'entity:datalayer-invalidate' },
  { label: 'auth', pattern: 'auth:**' },
  { label: 'entity', pattern: 'entity:**' },
  { label: 'toast', pattern: 'toast:**' }
]

function applyPreset(pattern) {
  filterPattern.value = pattern
}

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
}

// Extract domain from signal name (first segment)
function getDomain(name) {
  return name.split(':')[0]
}

const domainColors = {
  auth: '#10b981',
  cache: '#f59e0b',
  entity: '#3b82f6',
  toast: '#8b5cf6',
  route: '#06b6d4',
  error: '#ef4444'
}

function getDomainColor(name) {
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
          class="preset-btn"
          :class="{ 'preset-active': filterPattern === p.pattern }"
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

<style scoped>
.signals-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.signals-filter {
  padding: 8px 12px;
  background: #27272a;
  border-bottom: 1px solid #3f3f46;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.signals-filter-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.signals-filter-input .pi {
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
  border-color: #8b5cf6;
  outline: none;
}

.signals-count {
  font-size: 11px;
  color: #71717a;
  min-width: 40px;
  text-align: right;
}

.signals-max-label {
  font-size: 10px;
  color: #52525b;
  margin-left: 8px;
}

.max-input {
  width: 50px;
  font-size: 11px;
  padding: 2px 4px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 3px;
  color: #a1a1aa;
  text-align: center;
}

.max-input:focus {
  border-color: #8b5cf6;
  outline: none;
  color: #f4f4f5;
}

.signals-presets {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.preset-btn {
  padding: 2px 8px;
  font-size: 10px;
  background: #3f3f46;
  border: none;
  border-radius: 3px;
  color: #a1a1aa;
  cursor: pointer;
}

.preset-btn:hover {
  background: #52525b;
  color: #f4f4f5;
}

.preset-active {
  background: #8b5cf6;
  color: white;
}

.signals-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.signals-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #71717a;
  gap: 8px;
}

.signal-entry {
  padding: 6px 8px;
  margin-bottom: 2px;
  background: #27272a;
  border-radius: 4px;
  font-size: 12px;
}

.signal-entry:hover {
  background: #3f3f46;
}

.signal-entry.signal-new {
  border-left: 2px solid #f59e0b;
  padding-left: 6px;
}

.signal-new-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  background: #f59e0b;
  border-radius: 50%;
  margin-right: 4px;
  flex-shrink: 0;
}

.signal-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.signal-time {
  font-size: 10px;
  color: #71717a;
  font-family: monospace;
}

.signal-name {
  font-weight: 500;
  font-family: monospace;
}

.signal-data {
  margin-top: 4px;
  padding-left: 12px;
  font-size: 11px;
}
</style>
