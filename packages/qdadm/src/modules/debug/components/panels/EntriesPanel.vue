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

