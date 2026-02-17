<script setup lang="ts">
/**
 * EntitiesPanel - Entities collector display with expandable details
 */
import { ref, onMounted } from 'vue'
import ObjectTree from '../ObjectTree.vue'

interface StorageCapabilities {
  supportsTotal?: boolean
  supportsFilters?: boolean
  supportsPagination?: boolean
  supportsCaching?: boolean
  requiresAuth?: boolean
  [key: string]: boolean | undefined
}

interface StorageInfo {
  type: string
  endpoint?: string
  capabilities?: StorageCapabilities
  hasNormalize?: boolean
  hasDenormalize?: boolean
}

interface MultiStorage {
  enabled: boolean
  storages: Array<{
    name: string
    type: string
    endpoint?: string
    capabilities?: StorageCapabilities
    hasNormalize?: boolean
    hasDenormalize?: boolean
  }>
}

interface DetailCacheInfo {
  enabled: boolean
  ttlMs: number
  size: number
  maxSize: number
}

interface CacheInfo {
  enabled: boolean
  valid?: boolean
  itemCount?: number
  total?: number
  threshold?: number
  items?: Record<string, unknown>[]
  /** TTL in milliseconds (0=disabled, -1=infinite, >0=TTL) */
  ttlMs?: number
  /** Timestamp when cache expires (null if no TTL) */
  expiresAt?: number | null
  /** Whether the cache has expired based on TTL */
  expired?: boolean
  /** Whether the entity uses asymmetric mode */
  asymmetric?: boolean
  /** Detail cache info */
  detailCache?: DetailCacheInfo | null
}

interface RelationInfo {
  key: string
  entity: string
}

interface ReferenceInfo {
  field: string
  entity: string
}

interface EntityPermissions {
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  readOnly?: boolean
}

interface EntityStats {
  list: number
  get: number
  create: number
  update: number
  delete: number
  cacheHits: number
  cacheMisses: number
  detailCacheHits: number
  detailCacheMisses: number
  maxItemsSeen: number
  maxTotal: number
}

interface EntityEntry {
  type?: string
  message?: string
  name: string
  label?: string
  hasActivity?: boolean
  system?: boolean
  authSensitive?: boolean
  permissions: EntityPermissions
  storage: StorageInfo
  multiStorage?: MultiStorage
  cache: CacheInfo
  fields: {
    count: number
    required: string[]
  }
  relations: {
    parents: RelationInfo[]
    children: RelationInfo[]
    references?: ReferenceInfo[]
  }
  stats?: EntityStats
  [key: string]: unknown
}

interface StorageTestResult {
  success: boolean
  count?: number
  error?: string
  status?: number | string
}

interface EntitiesCollector {
  markSeen?: () => void
  refreshCache: (entityName: string, reload: boolean) => Promise<void> | void
  testStorageFetch: (entityName: string, storageName: string) => Promise<StorageTestResult>
  [key: string]: unknown
}

const props = defineProps<{
  collector: EntitiesCollector
  entries: EntityEntry[]
}>()

const emit = defineEmits<{
  (e: 'update'): void
}>()

// Mark all entities as seen when panel is viewed
onMounted(() => {
  props.collector.markSeen?.()
})

const expandedEntities = ref<Set<string>>(new Set())
const loadingCache = ref<Set<string>>(new Set())
const testingStorages = ref<Set<string>>(new Set()) // "entityName:storageName"
const storageTestResults = ref<Map<string, StorageTestResult>>(new Map()) // "entityName:storageName" -> { success, count, error, status }

function toggleExpand(name: string): void {
  if (expandedEntities.value.has(name)) {
    expandedEntities.value.delete(name)
  } else {
    expandedEntities.value.add(name)
  }
  // Trigger reactivity
  expandedEntities.value = new Set(expandedEntities.value)
}

function isExpanded(name: string): boolean {
  return expandedEntities.value.has(name)
}

async function loadCache(entityName: string): Promise<void> {
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

function invalidateCache(entityName: string): void {
  props.collector.refreshCache(entityName, false) // just invalidate
  emit('update')
}

function isLoading(name: string): boolean {
  return loadingCache.value.has(name)
}

function isTestingStorage(entityName: string, storageName: string): boolean {
  return testingStorages.value.has(`${entityName}:${storageName}`)
}

function getStorageTestResult(entityName: string, storageName: string): StorageTestResult | undefined {
  return storageTestResults.value.get(`${entityName}:${storageName}`)
}

async function testStorageFetch(entityName: string, storageName: string): Promise<void> {
  const key = `${entityName}:${storageName}`
  if (testingStorages.value.has(key)) return
  testingStorages.value.add(key)
  testingStorages.value = new Set(testingStorages.value)
  storageTestResults.value.delete(key)
  storageTestResults.value = new Map(storageTestResults.value)
  try {
    const result = await props.collector.testStorageFetch(entityName, storageName)
    storageTestResults.value.set(key, result)
    storageTestResults.value = new Map(storageTestResults.value)
  } finally {
    testingStorages.value.delete(key)
    testingStorages.value = new Set(testingStorages.value)
  }
}

function getCapabilityIcon(cap: string): string {
  const icons: Record<string, string> = {
    supportsTotal: 'pi-hashtag',
    supportsFilters: 'pi-filter',
    supportsPagination: 'pi-ellipsis-h',
    supportsCaching: 'pi-database',
    requiresAuth: 'pi-lock'
  }
  return icons[cap] || 'pi-question-circle'
}

function getCapabilityLabel(cap: string): string {
  const labels: Record<string, string> = {
    supportsTotal: 'Total count',
    supportsFilters: 'Filters',
    supportsPagination: 'Pagination',
    supportsCaching: 'Caching',
    requiresAuth: 'Requires authentication'
  }
  return labels[cap] || cap
}

function formatTtl(ttlMs: number | undefined): string {
  if (ttlMs === undefined) return '?'
  if (ttlMs === -1) return '∞'
  if (ttlMs === 0) return 'off'
  if (ttlMs < 1000) return `${ttlMs}ms`
  if (ttlMs < 60000) return `${Math.round(ttlMs / 1000)}s`
  if (ttlMs < 3600000) return `${Math.round(ttlMs / 60000)}min`
  return `${Math.round(ttlMs / 3600000)}h`
}

function formatExpiresIn(expiresAt: number | null | undefined): string {
  if (!expiresAt) return ''
  const diff = expiresAt - Date.now()
  if (diff <= 0) return 'expired'
  if (diff < 1000) return `${diff}ms`
  if (diff < 60000) return `${Math.round(diff / 1000)}s`
  if (diff < 3600000) return `${Math.round(diff / 60000)}min`
  return `${Math.round(diff / 3600000)}h`
}
</script>

<template>
  <div class="entities-panel">
    <div v-if="entries[0]?.type === 'status'" class="entities-status">
      {{ entries[0].message }}
    </div>
    <div v-else v-for="entity in entries" :key="entity.name" class="entity-item" :class="{ 'entity-active': entity.hasActivity, 'entity-system': entity.system }">
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
            class="pi pi-eye perm-icon-readonly"
            title="Read-only entity"
          />
          <i
            v-if="entity.authSensitive"
            class="pi pi-shield perm-icon-auth-sensitive"
            title="Auth-sensitive"
          />
          <i
            v-if="entity.cache.asymmetric"
            class="pi pi-arrows-v perm-icon-asymmetric"
            title="Asymmetric: list and detail return different structures"
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
        <!-- Storages section -->
        <div class="entity-storages-section">
          <div class="entity-storages-header">
            <i class="pi pi-database" />
            <span>Storages</span>
            <span v-if="entity.multiStorage?.enabled" class="entity-multi-badge" title="Multi-storage routing">
              <i class="pi pi-sitemap" />
              {{ 1 + entity.multiStorage.storages.length }}
            </span>
          </div>

          <!-- Primary storage -->
          <div class="entity-storage-card">
            <div class="entity-storage-header">
              <span class="entity-storage-name">storage</span>
              <span class="entity-storage-type">{{ entity.storage.type }}</span>
              <span v-if="entity.storage.hasNormalize || entity.storage.hasDenormalize" class="entity-normalize-badge" title="Has normalize/denormalize">
                <i class="pi pi-arrows-h" />
              </span>
              <button
                class="entity-storage-fetch-btn"
                :disabled="isTestingStorage(entity.name, 'storage')"
                @click.stop="testStorageFetch(entity.name, 'storage')"
                title="Test fetch on this storage"
              >
                <i :class="['pi', isTestingStorage(entity.name, 'storage') ? 'pi-spin pi-spinner' : 'pi-download']" />
              </button>
            </div>
            <div v-if="entity.storage.endpoint" class="entity-storage-endpoint">
              {{ entity.storage.endpoint }}
            </div>
            <div class="entity-storage-row">
              <div v-if="entity.storage.capabilities && Object.keys(entity.storage.capabilities).length > 0" class="entity-storage-caps">
                <span
                  v-for="(enabled, cap) in entity.storage.capabilities"
                  :key="cap"
                  class="entity-cap"
                  :class="[cap === 'requiresAuth' && enabled ? 'entity-cap-auth' : (enabled ? 'entity-cap-enabled' : 'entity-cap-disabled')]"
                  :title="getCapabilityLabel(cap) + (enabled ? ' ✓' : ' ✗')"
                >
                  <i :class="['pi', getCapabilityIcon(cap)]" />
                </span>
              </div>
              <span v-if="getStorageTestResult(entity.name, 'storage')" class="entity-storage-test-result" :class="getStorageTestResult(entity.name, 'storage')?.success ? 'test-success' : 'test-error'">
                <template v-if="getStorageTestResult(entity.name, 'storage')?.success">
                  <i class="pi pi-check-circle" /> {{ getStorageTestResult(entity.name, 'storage')?.count }}
                </template>
                <template v-else>
                  <i class="pi pi-times-circle" /> {{ getStorageTestResult(entity.name, 'storage')?.status || 'ERR' }}
                </template>
              </span>
            </div>
          </div>

          <!-- Additional storages -->
          <div v-for="s in entity.multiStorage?.storages || []" :key="s.name" class="entity-storage-card entity-storage-alt">
            <div class="entity-storage-header">
              <span class="entity-storage-name">{{ s.name }}</span>
              <span class="entity-storage-type">{{ s.type }}</span>
              <span v-if="s.hasNormalize || s.hasDenormalize" class="entity-normalize-badge" title="Has normalize/denormalize">
                <i class="pi pi-arrows-h" />
              </span>
              <button
                class="entity-storage-fetch-btn"
                :disabled="isTestingStorage(entity.name, s.name)"
                @click.stop="testStorageFetch(entity.name, s.name)"
                title="Test fetch on this storage"
              >
                <i :class="['pi', isTestingStorage(entity.name, s.name) ? 'pi-spin pi-spinner' : 'pi-download']" />
              </button>
            </div>
            <div v-if="s.endpoint" class="entity-storage-endpoint">
              {{ s.endpoint }}
            </div>
            <div class="entity-storage-row">
              <div v-if="s.capabilities && Object.keys(s.capabilities).length > 0" class="entity-storage-caps">
                <span
                  v-for="(enabled, cap) in s.capabilities"
                  :key="cap"
                  class="entity-cap"
                  :class="[cap === 'requiresAuth' && enabled ? 'entity-cap-auth' : (enabled ? 'entity-cap-enabled' : 'entity-cap-disabled')]"
                  :title="getCapabilityLabel(cap) + (enabled ? ' ✓' : ' ✗')"
                >
                  <i :class="['pi', getCapabilityIcon(cap)]" />
                </span>
              </div>
              <span v-if="getStorageTestResult(entity.name, s.name)" class="entity-storage-test-result" :class="getStorageTestResult(entity.name, s.name)?.success ? 'test-success' : 'test-error'">
                <template v-if="getStorageTestResult(entity.name, s.name)?.success">
                  <i class="pi pi-check-circle" /> {{ getStorageTestResult(entity.name, s.name)?.count }}
                </template>
                <template v-else>
                  <i class="pi pi-times-circle" /> {{ getStorageTestResult(entity.name, s.name)?.status || 'ERR' }}
                </template>
              </span>
            </div>
          </div>
        </div>
        <div v-if="entity.cache.enabled" class="entity-row">
          <span class="entity-key">Cache:</span>
          <span class="entity-value">
            {{ entity.cache.valid ? 'Valid' : 'Not loaded' }}
            <template v-if="entity.cache.valid">
              ({{ entity.cache.itemCount }} items, threshold {{ entity.cache.threshold }})
            </template>
            <span class="entity-cache-ttl" :class="{ 'ttl-expired': entity.cache.expired }">
              TTL: {{ formatTtl(entity.cache.ttlMs) }}
              <template v-if="entity.cache.valid && entity.cache.expiresAt && !entity.cache.expired">
                ({{ formatExpiresIn(entity.cache.expiresAt) }} left)
              </template>
              <template v-if="entity.cache.expired">
                <i class="pi pi-exclamation-triangle" title="Cache expired" />
              </template>
            </span>
          </span>
          <button
            v-if="!entity.cache.valid || entity.cache.expired"
            class="entity-load-btn"
            :disabled="isLoading(entity.name)"
            @click.stop="loadCache(entity.name)"
          >
            <i :class="['pi', isLoading(entity.name) ? 'pi-spin pi-spinner' : 'pi-download']" />
            {{ isLoading(entity.name) ? 'Loading...' : (entity.cache.expired ? 'Reload' : 'Load') }}
          </button>
          <button
            v-if="entity.cache.valid && !entity.cache.expired"
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
        <div v-if="entity.cache.detailCache" class="entity-row">
          <span class="entity-key">Detail cache:</span>
          <span class="entity-value">
            {{ entity.cache.detailCache.size }}<template v-if="entity.cache.detailCache.maxSize > 0">/{{ entity.cache.detailCache.maxSize }}</template> items
            <span class="entity-cache-ttl">
              TTL: {{ formatTtl(entity.cache.detailCache.ttlMs) }}
            </span>
          </span>
        </div>
        <div class="entity-row">
          <span class="entity-key">Fields:</span>
          <span class="entity-value">{{ entity.fields.count }} fields</span>
          <span v-if="entity.fields.required.length > 0" class="entity-required">
            {{ entity.fields.required.length }} required
          </span>
        </div>
        <div v-if="entity.relations.parents.length > 0 || entity.relations.children.length > 0 || (entity.relations.references?.length ?? 0) > 0" class="entity-row">
          <span class="entity-key">Relations:</span>
          <span class="entity-value">
            <span v-for="p in entity.relations.parents" :key="p.key" class="entity-relation" title="Parent relation">
              <i class="pi pi-arrow-up" />{{ p.key }}→{{ p.entity }}
            </span>
            <span v-for="c in entity.relations.children" :key="c.key" class="entity-relation" title="Child relation">
              <i class="pi pi-arrow-down" />{{ c.key }}→{{ c.entity }}
            </span>
            <span v-for="r in entity.relations.references" :key="r.field" class="entity-relation entity-reference" title="Field reference">
              <i class="pi pi-link" />{{ r.field }}→{{ r.entity }}
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
            <div v-if="entity.cache.asymmetric" class="entity-stat entity-stat-cache">
              <span class="entity-stat-value" :class="{ 'stat-positive': entity.stats.detailCacheHits > 0 }">
                {{ entity.stats.detailCacheHits }}
              </span>
              <span class="entity-stat-label">d-hits</span>
            </div>
            <div v-if="entity.cache.asymmetric" class="entity-stat entity-stat-cache">
              <span class="entity-stat-value" :class="{ 'stat-negative': entity.stats.detailCacheMisses > 0 }">
                {{ entity.stats.detailCacheMisses }}
              </span>
              <span class="entity-stat-label">d-miss</span>
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

