<script setup>
/**
 * EntitiesPanel - Entities collector display with expandable details
 */
import { ref, onMounted } from 'vue'
import ObjectTree from '../ObjectTree.vue'

const props = defineProps({
  collector: { type: Object, required: true },
  entries: { type: Array, required: true }
})

const emit = defineEmits(['update'])

// Mark all entities as seen when panel is viewed
onMounted(() => {
  props.collector.markSeen?.()
})

const expandedEntities = ref(new Set())
const loadingCache = ref(new Set())

function toggleExpand(name) {
  if (expandedEntities.value.has(name)) {
    expandedEntities.value.delete(name)
  } else {
    expandedEntities.value.add(name)
  }
  // Trigger reactivity
  expandedEntities.value = new Set(expandedEntities.value)
}

function isExpanded(name) {
  return expandedEntities.value.has(name)
}

async function loadCache(entityName) {
  if (loadingCache.value.has(entityName)) return
  loadingCache.value.add(entityName)
  loadingCache.value = new Set(loadingCache.value)
  try {
    await props.collector.refreshCache(entityName, true) // reload=true
    emit('update')
  } finally {
    loadingCache.value.delete(entityName)
    loadingCache.value = new Set(loadingCache.value)
  }
}

function invalidateCache(entityName) {
  props.collector.refreshCache(entityName, false) // just invalidate
  emit('update')
}

function isLoading(name) {
  return loadingCache.value.has(name)
}

function getCapabilityIcon(cap) {
  const icons = {
    supportsTotal: 'pi-hashtag',
    supportsFilters: 'pi-filter',
    supportsPagination: 'pi-ellipsis-h',
    supportsCaching: 'pi-database'
  }
  return icons[cap] || 'pi-question-circle'
}

function getCapabilityLabel(cap) {
  const labels = {
    supportsTotal: 'Total count',
    supportsFilters: 'Filters',
    supportsPagination: 'Pagination',
    supportsCaching: 'Caching'
  }
  return labels[cap] || cap
}
</script>

<template>
  <div class="entities-panel">
    <div v-if="entries[0]?.type === 'status'" class="entities-status">
      {{ entries[0].message }}
    </div>
    <div v-else v-for="entity in entries" :key="entity.name" class="entity-item" :class="{ 'entity-active': entity.hasActivity }">
      <div class="entity-header" @click="toggleExpand(entity.name)">
        <button class="entity-expand">
          <i :class="['pi', isExpanded(entity.name) ? 'pi-chevron-down' : 'pi-chevron-right']" />
        </button>
        <i class="pi pi-database" />
        <span class="entity-name">{{ entity.name }}</span>
        <div class="entity-perms-icons">
          <i
            class="pi pi-plus"
            :class="entity.permissions.canCreate ? 'perm-icon-granted' : 'perm-icon-denied'"
            :title="entity.permissions.canCreate ? 'Create allowed' : 'Create denied'"
          />
          <i
            class="pi pi-pencil"
            :class="entity.permissions.canUpdate ? 'perm-icon-granted' : 'perm-icon-denied'"
            :title="entity.permissions.canUpdate ? 'Update allowed' : 'Update denied'"
          />
          <i
            class="pi pi-trash"
            :class="entity.permissions.canDelete ? 'perm-icon-granted' : 'perm-icon-denied'"
            :title="entity.permissions.canDelete ? 'Delete allowed' : 'Delete denied'"
          />
          <i
            v-if="entity.permissions.readOnly"
            class="pi pi-lock perm-icon-readonly"
            title="Read-only entity"
          />
        </div>
        <span class="entity-label">{{ entity.label }}</span>
        <span v-if="entity.cache.enabled" class="entity-cache" :class="{ 'entity-cache-valid': entity.cache.valid }">
          <i :class="['pi', entity.cache.valid ? 'pi-check-circle' : 'pi-hourglass']" />
          <template v-if="entity.cache.valid">{{ entity.cache.itemCount }}/{{ entity.cache.total }}</template>
          <template v-else>pending</template>
        </span>
        <span v-else class="entity-cache entity-cache-disabled">
          <i class="pi pi-ban" />
        </span>
      </div>

      <!-- Collapsed summary -->
      <div v-if="!isExpanded(entity.name)" class="entity-summary">
        <span class="entity-storage">{{ entity.storage.type }}</span>
        <span v-if="entity.storage.endpoint" class="entity-endpoint">{{ entity.storage.endpoint }}</span>
        <span class="entity-fields">{{ entity.fields.count }} fields</span>
      </div>

      <!-- Expanded details -->
      <div v-else class="entity-details">
        <div class="entity-row">
          <span class="entity-key">Storage:</span>
          <span class="entity-value">{{ entity.storage.type }}</span>
          <span v-if="entity.storage.endpoint" class="entity-endpoint">{{ entity.storage.endpoint }}</span>
        </div>
        <div v-if="entity.storage.capabilities && Object.keys(entity.storage.capabilities).length > 0" class="entity-row">
          <span class="entity-key">Caps:</span>
          <div class="entity-capabilities">
            <span
              v-for="(enabled, cap) in entity.storage.capabilities"
              :key="cap"
              class="entity-cap"
              :class="[enabled ? 'entity-cap-enabled' : 'entity-cap-disabled']"
              :title="getCapabilityLabel(cap) + (enabled ? ' ✓' : ' ✗')"
            >
              <i :class="['pi', getCapabilityIcon(cap)]" />
            </span>
          </div>
        </div>
        <div v-if="entity.cache.enabled" class="entity-row">
          <span class="entity-key">Cache:</span>
          <span class="entity-value">
            {{ entity.cache.valid ? 'Valid' : 'Not loaded' }}
            <template v-if="entity.cache.valid">
              ({{ entity.cache.itemCount }} items, threshold {{ entity.cache.threshold }})
            </template>
          </span>
          <button
            v-if="!entity.cache.valid"
            class="entity-load-btn"
            :disabled="isLoading(entity.name)"
            @click.stop="loadCache(entity.name)"
          >
            <i :class="['pi', isLoading(entity.name) ? 'pi-spin pi-spinner' : 'pi-download']" />
            {{ isLoading(entity.name) ? 'Loading...' : 'Load' }}
          </button>
          <button
            v-else
            class="entity-invalidate-btn"
            title="Invalidate cache"
            @click.stop="invalidateCache(entity.name)"
          >
            <i class="pi pi-times-circle" />
          </button>
        </div>
        <div v-else class="entity-row">
          <span class="entity-key">Cache:</span>
          <span class="entity-value entity-cache-na">Disabled</span>
        </div>
        <div class="entity-row">
          <span class="entity-key">Fields:</span>
          <span class="entity-value">{{ entity.fields.count }} fields</span>
          <span v-if="entity.fields.required.length > 0" class="entity-required">
            {{ entity.fields.required.length }} required
          </span>
        </div>
        <div v-if="entity.relations.parents.length > 0 || entity.relations.children.length > 0" class="entity-row">
          <span class="entity-key">Relations:</span>
          <span class="entity-value">
            <span v-for="p in entity.relations.parents" :key="p.key" class="entity-relation">
              <i class="pi pi-arrow-up" />{{ p.key }}→{{ p.entity }}
            </span>
            <span v-for="c in entity.relations.children" :key="c.key" class="entity-relation">
              <i class="pi pi-arrow-down" />{{ c.key }}→{{ c.entity }}
            </span>
          </span>
        </div>
        <!-- Operation stats -->
        <div v-if="entity.stats" class="entity-stats">
          <div class="entity-stats-header">
            <i class="pi pi-chart-bar" />
            <span>Stats</span>
          </div>
          <div class="entity-stats-grid">
            <div class="entity-stat">
              <span class="entity-stat-value">{{ entity.stats.list }}</span>
              <span class="entity-stat-label">list</span>
            </div>
            <div class="entity-stat">
              <span class="entity-stat-value">{{ entity.stats.get }}</span>
              <span class="entity-stat-label">get</span>
            </div>
            <div class="entity-stat">
              <span class="entity-stat-value">{{ entity.stats.create }}</span>
              <span class="entity-stat-label">create</span>
            </div>
            <div class="entity-stat">
              <span class="entity-stat-value">{{ entity.stats.update }}</span>
              <span class="entity-stat-label">update</span>
            </div>
            <div class="entity-stat">
              <span class="entity-stat-value">{{ entity.stats.delete }}</span>
              <span class="entity-stat-label">delete</span>
            </div>
            <div class="entity-stat entity-stat-cache">
              <span class="entity-stat-value" :class="{ 'stat-positive': entity.stats.cacheHits > 0 }">
                {{ entity.stats.cacheHits }}
              </span>
              <span class="entity-stat-label">hits</span>
            </div>
            <div class="entity-stat entity-stat-cache">
              <span class="entity-stat-value" :class="{ 'stat-negative': entity.stats.cacheMisses > 0 }">
                {{ entity.stats.cacheMisses }}
              </span>
              <span class="entity-stat-label">miss</span>
            </div>
            <div class="entity-stat entity-stat-max">
              <span class="entity-stat-value">{{ entity.stats.maxItemsSeen }}</span>
              <span class="entity-stat-label">items</span>
            </div>
            <div class="entity-stat entity-stat-max">
              <span class="entity-stat-value">{{ entity.stats.maxTotal }}</span>
              <span class="entity-stat-label">total</span>
            </div>
          </div>
        </div>
        <!-- Cached items -->
        <div v-if="entity.cache.items && entity.cache.items.length > 0" class="entity-items">
          <div class="entity-items-header">
            <i class="pi pi-list" />
            <span>Cached Items ({{ entity.cache.items.length }}/{{ entity.cache.itemCount }})</span>
          </div>
          <div class="entity-items-list">
            <div v-for="(item, idx) in entity.cache.items.slice(0, 10)" :key="idx" class="entity-item-row">
              <ObjectTree :data="item" :maxDepth="3" :collapsed="true" />
            </div>
            <div v-if="entity.cache.items.length > 10" class="entity-items-more">
              ... et {{ entity.cache.items.length - 10 }} de plus
            </div>
          </div>
        </div>

        <!-- Full entity config tree -->
        <details class="entity-config">
          <summary>Configuration complète</summary>
          <ObjectTree :data="entity" :maxDepth="6" />
        </details>
      </div>
    </div>
  </div>
</template>

<style scoped>
.entities-panel {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.entities-status {
  color: #71717a;
  font-size: 12px;
  padding: 12px;
  text-align: center;
}
.entity-item {
  background: #27272a;
  border-radius: 4px;
  padding: 8px;
  border-left: 3px solid transparent;
  transition: border-color 0.2s ease;
}
.entity-active {
  border-left-color: #f59e0b;
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.1) 0%, #27272a 30%);
}
.entity-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #3b82f6;
  cursor: pointer;
}
.entity-header:hover {
  color: #60a5fa;
}
.entity-expand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  background: transparent;
  border: none;
  color: #71717a;
  cursor: pointer;
  font-size: 10px;
}
.entity-expand:hover {
  color: #f4f4f5;
}
.entity-name {
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
}
.entity-perms-icons {
  display: flex;
  gap: 4px;
  margin-left: 6px;
}
.entity-perms-icons .pi {
  font-size: 12px;
  cursor: help;
}
.perm-icon-granted {
  color: #22c55e;
}
.perm-icon-denied {
  color: #52525b;
}
.perm-icon-readonly {
  color: #f59e0b;
  margin-left: 2px;
}
.entity-label {
  color: #a1a1aa;
  font-size: 11px;
}
.entity-cache {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: #3f3f46;
  border-radius: 3px;
  font-size: 10px;
  color: #71717a;
}
.entity-cache-valid {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}
.entity-cache-disabled {
  background: transparent;
  color: #52525b;
  font-size: 9px;
}
.entity-cache-na {
  color: #52525b;
  font-style: italic;
}
.entity-load-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: #3f3f46;
  border: none;
  border-radius: 3px;
  color: #a1a1aa;
  cursor: pointer;
  font-size: 10px;
  margin-left: auto;
}
.entity-load-btn:hover {
  background: #52525b;
  color: #f4f4f5;
}
.entity-load-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.entity-invalidate-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 3px;
  color: #71717a;
  cursor: pointer;
  margin-left: auto;
}
.entity-invalidate-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

/* Collapsed summary */
.entity-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 24px;
  margin-top: 4px;
  font-size: 11px;
  color: #71717a;
}
.entity-storage {
  color: #a1a1aa;
}
.entity-fields {
  color: #71717a;
}

/* Expanded details */
.entity-details {
  font-size: 11px;
  margin-left: 24px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #3f3f46;
}
.entity-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}
.entity-key {
  color: #71717a;
  min-width: 60px;
}
.entity-value {
  color: #d4d4d8;
}
.entity-endpoint {
  color: #a1a1aa;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  padding: 1px 4px;
  background: #3f3f46;
  border-radius: 2px;
}
.entity-capabilities {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.entity-cap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 3px;
  cursor: help;
}
.entity-cap .pi {
  font-size: 11px;
}
.entity-cap-enabled {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}
.entity-cap-disabled {
  background: rgba(239, 68, 68, 0.15);
  color: #71717a;
}
.entity-required {
  color: #f59e0b;
  font-size: 10px;
}
.entity-relation {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 4px;
  background: #3f3f46;
  border-radius: 2px;
  margin-right: 4px;
  font-size: 10px;
}
.entity-relation .pi {
  font-size: 8px;
}
/* Stats */
.entity-stats {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #3f3f46;
}
.entity-stats-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #a1a1aa;
  font-size: 11px;
  margin-bottom: 6px;
}
.entity-stats-header .pi {
  font-size: 10px;
}
.entity-stats-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.entity-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 8px;
  background: #1f1f23;
  border-radius: 4px;
  min-width: 40px;
}
.entity-stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #d4d4d8;
  font-family: 'JetBrains Mono', monospace;
}
.entity-stat-label {
  font-size: 9px;
  color: #71717a;
  text-transform: uppercase;
}
.entity-stat-cache {
  border-left: 1px solid #3f3f46;
  padding-left: 12px;
  margin-left: 4px;
}
.entity-stat-max {
  border-left: 1px solid #3f3f46;
  padding-left: 12px;
  margin-left: 4px;
}
.entity-stat-max .entity-stat-value {
  color: #60a5fa;
}
.stat-positive {
  color: #22c55e;
}
.stat-negative {
  color: #f59e0b;
}
/* Cached items */
.entity-items {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #3f3f46;
}
.entity-items-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #a1a1aa;
  font-size: 11px;
  margin-bottom: 6px;
}
.entity-items-header .pi {
  font-size: 10px;
}
.entity-items-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}
.entity-item-row {
  background: #1f1f23;
  border-radius: 3px;
  padding: 4px 6px;
}
.entity-items-more {
  color: #71717a;
  font-size: 10px;
  font-style: italic;
  padding: 4px;
}

/* Full config tree */
.entity-config {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #3f3f46;
}
.entity-config summary {
  cursor: pointer;
  color: #71717a;
  font-size: 11px;
}
.entity-config summary:hover {
  color: #a1a1aa;
}
</style>
