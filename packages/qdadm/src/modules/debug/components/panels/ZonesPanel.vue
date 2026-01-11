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

