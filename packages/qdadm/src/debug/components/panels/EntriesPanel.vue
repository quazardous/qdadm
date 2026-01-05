<script setup>
/**
 * EntriesPanel - Default entries display (horizontal/vertical)
 */
import { ref } from 'vue'
import ObjectTree from '../ObjectTree.vue'

defineProps({
  entries: { type: Array, required: true },
  mode: { type: String, default: 'vertical' }, // 'horizontal' or 'vertical'
  maxEntries: { type: Number, default: 10 }
})

const copiedIdx = ref(null)

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

function getEntryData(entry) {
  const { timestamp, _isNew, ...rest } = entry
  return rest
}

async function copyEntry(entry, idx) {
  try {
    const data = getEntryData(entry)
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    copiedIdx.value = idx
    setTimeout(() => { copiedIdx.value = null }, 1500)
  } catch (e) {
    console.error('Failed to copy:', e)
  }
}
</script>

<template>
  <!-- Horizontal layout -->
  <div v-if="mode === 'horizontal'" class="entries-h">
    <div
      v-for="(entry, idx) in entries.slice().reverse().slice(0, maxEntries)"
      :key="idx"
      class="entry-h"
      :class="{ 'entry-new': entry._isNew }"
    >
      <div class="entry-meta">
        <span v-if="entry._isNew" class="entry-new-dot" title="New (unseen)" />
        <span class="entry-time">{{ formatTime(entry.timestamp) }}</span>
        <span v-if="entry.name" class="entry-name">{{ entry.name }}</span>
      </div>
      <ObjectTree :data="getEntryData(entry)" :maxDepth="3" />
    </div>
  </div>

  <!-- Vertical layout -->
  <div v-else class="entries-v">
    <div
      v-for="(entry, idx) in entries.slice().reverse()"
      :key="idx"
      class="entry-v"
      :class="{ 'entry-new': entry._isNew }"
    >
      <div class="entry-header">
        <span v-if="entry._isNew" class="entry-new-dot" title="New (unseen)" />
        <span class="entry-time">{{ formatTime(entry.timestamp) }}</span>
        <span v-if="entry.name" class="entry-name">{{ entry.name }}</span>
        <span v-if="entry.message" class="entry-message">{{ entry.message }}</span>
        <button
          class="entry-copy"
          :class="{ 'entry-copied': copiedIdx === idx }"
          @click="copyEntry(entry, idx)"
          :title="copiedIdx === idx ? 'Copied!' : 'Copy to clipboard'"
        >
          <i :class="['pi', copiedIdx === idx ? 'pi-check' : 'pi-copy']" />
        </button>
      </div>
      <ObjectTree :data="getEntryData(entry)" :maxDepth="6" />
    </div>
  </div>
</template>

<style scoped>
/* Horizontal entries (bottom mode) */
.entries-h {
  display: flex;
  gap: 1px;
  height: 100%;
  overflow-x: auto;
}
.entry-h {
  flex: 0 0 auto;
  min-width: 200px;
  max-width: 320px;
  padding: 8px 12px;
  border-right: 1px solid #3f3f46;
  overflow: hidden;
}
.entry-h:last-child {
  border-right: none;
}

/* Vertical entries (right/fullscreen mode) */
.entries-v {
  display: flex;
  flex-direction: column;
}
.entry-v {
  padding: 8px 12px;
  border-bottom: 1px solid #27272a;
}
.entry-v:hover {
  background: #1f1f23;
}

/* New entry indicator */
.entry-new {
  position: relative;
  background: rgba(245, 158, 11, 0.08);
}
.entry-v.entry-new::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #f59e0b;
}
.entry-h.entry-new {
  border-left: 3px solid #f59e0b;
}

.entry-new-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  background: #f59e0b;
  border-radius: 50%;
  margin-right: 4px;
  flex-shrink: 0;
}

/* Entry parts */
.entry-meta, .entry-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.entry-time {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #71717a;
  background: #27272a;
  padding: 1px 4px;
  border-radius: 2px;
}
.entry-name {
  color: #a78bfa;
  font-weight: 500;
  font-size: 12px;
}
.entry-message {
  color: #f87171;
  font-size: 12px;
}
/* Copy button */
.entry-copy {
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 3px;
  color: #71717a;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s;
}
.entry-v:hover .entry-copy {
  opacity: 1;
}
.entry-copy:hover {
  background: #3f3f46;
  color: #d4d4d8;
}
.entry-copied {
  opacity: 1;
  color: #22c55e;
}
.entry-copy .pi {
  font-size: 12px;
}
</style>
