<script setup>
/**
 * ZonesPanel - Zones collector display
 */
const props = defineProps({
  collector: { type: Object, required: true },
  entries: { type: Array, required: true }
})

const emit = defineEmits(['update'])

function toggleFilter() {
  if (props.collector.toggleFilter) {
    props.collector.toggleFilter()
    emit('update')
  }
}

function isFilterActive() {
  return props.collector.showCurrentPageOnly ?? true
}

function toggleInternalFilter() {
  if (props.collector.toggleInternalFilter) {
    props.collector.toggleInternalFilter()
    emit('update')
  }
}

function showInternalZones() {
  return props.collector.showInternalZones ?? false
}

function highlightZone(zoneName) {
  if (props.collector.toggleHighlight) {
    props.collector.toggleHighlight(zoneName)
    emit('update')
  }
}

function isHighlighted(zoneName) {
  return props.collector.getHighlightedZone?.() === zoneName
}
</script>

<template>
  <div class="zones-panel">
    <div class="zones-toolbar">
      <button
        class="zones-toggle"
        :class="{ 'zones-toggle-on': !isFilterActive() }"
        :title="isFilterActive() ? 'Click to show all zones' : 'Click to show current page only'"
        @click="toggleFilter"
      >
        <i :class="['pi', isFilterActive() ? 'pi-filter-slash' : 'pi-filter']" />
        All Pages
      </button>
      <button
        class="zones-toggle"
        :class="{ 'zones-toggle-internal': showInternalZones() }"
        :title="showInternalZones() ? 'Click to hide internal zones' : 'Click to show internal zones (prefixed with _)'"
        @click="toggleInternalFilter"
      >
        <i :class="['pi', showInternalZones() ? 'pi-lock-open' : 'pi-lock']" />
        Internal
      </button>
    </div>
    <div v-if="entries.length === 0" class="zones-empty">
      <i class="pi pi-inbox" />
      <span>No zones</span>
    </div>
    <div v-for="zone in entries" :key="zone.name" class="zone-item">
      <div class="zone-header">
        <button
          class="zone-highlight"
          :class="{ 'zone-highlight-active': isHighlighted(zone.name) }"
          :title="isHighlighted(zone.name) ? 'Hide highlight' : 'Highlight zone'"
          @click="highlightZone(zone.name)"
        >
          <i class="pi pi-eye" />
        </button>
        <span class="zone-name">{{ zone.name }}</span>
        <span class="zone-count">{{ zone.blocksCount }} block(s)</span>
      </div>
      <div v-if="zone.blocks.length > 0" class="zone-blocks">
        <div v-for="block in zone.blocks" :key="block.id" class="zone-block">
          <span class="block-id">{{ block.id }}</span>
          <span class="block-component">{{ block.component }}</span>
          <span class="block-weight">w:{{ block.weight }}</span>
          <span v-if="block.hasWrappers" class="block-wrappers">
            <i class="pi pi-sitemap" :title="`${block.wrappersCount} wrapper(s)`" />
          </span>
        </div>
      </div>
      <div v-else-if="zone.hasDefault" class="zone-default">
        Default: {{ zone.defaultName || '(component)' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.zones-panel {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.zones-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.zones-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: #71717a;
  font-size: 12px;
}
.zones-empty i {
  font-size: 24px;
}
.zones-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #3f3f46;
  border: none;
  border-radius: 4px;
  color: #a1a1aa;
  cursor: pointer;
  font-size: 11px;
}
.zones-toggle:hover {
  background: #52525b;
  color: #f4f4f5;
}
.zones-toggle-on {
  background: #06b6d4;
  color: white;
}
.zones-toggle-on:hover {
  background: #0891b2;
}
.zones-toggle-internal {
  background: #f59e0b;
  color: white;
}
.zones-toggle-internal:hover {
  background: #d97706;
}
.zone-item {
  background: #27272a;
  border-radius: 4px;
  padding: 8px;
}
.zone-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.zone-highlight {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  background: #3f3f46;
  border: none;
  border-radius: 4px;
  color: #71717a;
  cursor: pointer;
}
.zone-highlight:hover {
  background: #52525b;
  color: #06b6d4;
}
.zone-highlight-active {
  background: #06b6d4;
  color: white;
}
.zone-name {
  font-weight: 600;
  color: #06b6d4;
}
.zone-count {
  color: #71717a;
  font-size: 11px;
}
.zone-blocks {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-left: 30px;
}
.zone-block {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  padding: 2px 6px;
  background: #1f1f23;
  border-radius: 2px;
}
.block-id {
  color: #a78bfa;
  font-weight: 500;
}
.block-component {
  color: #d4d4d8;
}
.block-weight {
  color: #71717a;
  font-size: 10px;
}
.block-wrappers {
  color: #f59e0b;
}
.zone-default {
  color: #71717a;
  font-size: 11px;
  margin-left: 30px;
}
</style>
