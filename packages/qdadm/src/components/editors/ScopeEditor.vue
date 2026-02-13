<script setup lang="ts">
import { ref, computed, onMounted, watch, inject } from 'vue'
import AutoComplete from 'primevue/autocomplete'
import Select from 'primevue/select'
import Button from 'primevue/button'

interface ScopeRow {
  resource: string
  action: string
}

interface ScopeDefinition {
  resources: string[]
  actions: string[]
}

interface ScopeConfig {
  endpoint?: string
  prefix?: string
  resources?: string[]
  actions?: string[]
}

interface ApiAdapter {
  request: (method: string, url: string) => Promise<ScopeDefinition>
}

interface Props {
  modelValue?: string[]
  disabled?: boolean
  scopeEndpoint?: string | null
  scopePrefix?: string | null
  defaultResources?: string[] | null
  defaultActions?: string[] | null
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  disabled: false,
  scopeEndpoint: null,
  scopePrefix: null,
  defaultResources: null,
  defaultActions: null
})

// Get API adapter (optional)
const api = inject<ApiAdapter | null>('apiAdapter', null)

// Get global scope config (optional) - allows app-level configuration
const globalScopeConfig = inject<ScopeConfig>('scopeConfig', {})

// Computed config with priority: props > globalConfig > defaults
const config = computed<Required<ScopeConfig>>(() => ({
  endpoint: props.scopeEndpoint ?? globalScopeConfig.endpoint ?? '/reference/scopes',
  prefix: props.scopePrefix ?? globalScopeConfig.prefix ?? 'app',
  resources: props.defaultResources ?? globalScopeConfig.resources ?? ['api', 'users', 'roles', 'apikeys'],
  actions: props.defaultActions ?? globalScopeConfig.actions ?? ['read', 'write', 'grant']
}))

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

// Scope structure from API
const scopeDefinition = ref<ScopeDefinition>({
  resources: [],
  actions: [],
})
const loading = ref<boolean>(true)

// Local scopes state
const scopeRows = ref<ScopeRow[]>([])

// Resource suggestions for autocomplete
const resourceSuggestions = ref<string[]>([])

// All resources with * prefix
const allResources = computed<string[]>(() => ['*', ...scopeDefinition.value.resources])

// All actions with access prefix
const allActions = computed<string[]>(() => ['access', ...scopeDefinition.value.actions])

/**
 * Search resources for autocomplete
 */
function searchResources(event: { query: string }): void {
  const query = (event.query || '').toLowerCase()
  if (!query) {
    resourceSuggestions.value = [...allResources.value]
  } else {
    resourceSuggestions.value = allResources.value.filter(r =>
      r.toLowerCase().includes(query)
    )
  }
}

/**
 * Parse a scope string into resource and action
 */
function parseScope(scope: string): ScopeRow {
  if (!scope) return { resource: '', action: '' }
  // prefix.resource:action
  const regex = new RegExp(`^${config.value.prefix}\\.([^:]+):(.+)$`)
  const match = scope.match(regex)
  if (match && match[1] && match[2]) {
    return { resource: match[1], action: match[2] }
  }
  return { resource: '', action: '' }
}

/**
 * Build scope string from resource and action
 */
function buildScope(resource: string, action: string): string {
  if (!resource || !action) return ''
  return `${config.value.prefix}.${resource}:${action}`
}

// Initialize from modelValue
function initFromValue(): void {
  if (!props.modelValue || props.modelValue.length === 0) {
    scopeRows.value = []
    return
  }
  scopeRows.value = props.modelValue.map(scope => {
    const { resource, action } = parseScope(scope)
    return { resource, action }
  })
}

// Emit changes - only complete scopes
function emitChanges(): void {
  const scopes = scopeRows.value
    .map(row => buildScope(row.resource, row.action))
    .filter(s => s) // Filter out empty
  emit('update:modelValue', scopes)
}

// Add new scope row
function addRow(): void {
  scopeRows.value.push({ resource: '', action: 'read' })
}

// Remove scope row
function removeRow(index: number): void {
  scopeRows.value.splice(index, 1)
  emitChanges()
}

// Update resource
function updateResource(index: number, value: string): void {
  const row = scopeRows.value[index]
  if (row) {
    row.resource = value
    if (value && row.action) {
      emitChanges()
    }
  }
}

// Update action
function updateAction(index: number, value: string): void {
  const row = scopeRows.value[index]
  if (row) {
    row.action = value
    if (row.resource && value) {
      emitChanges()
    }
  }
}

// Check if row is complete
function isRowComplete(row: ScopeRow): boolean {
  return !!row.resource && !!row.action
}

// Load scope definition from API
async function loadScopeDefinition(): Promise<void> {
  loading.value = true
  try {
    if (!api) {
      // No API adapter, use defaults
      scopeDefinition.value = {
        resources: [...config.value.resources],
        actions: [...config.value.actions],
      }
      return
    }

    const data = await api.request('GET', config.value.endpoint)
    scopeDefinition.value = {
      resources: data.resources || [...config.value.resources],
      actions: data.actions || [...config.value.actions],
    }
  } catch (error) {
    console.error('[ScopeEditor] Failed to load scope definition:', error)
    scopeDefinition.value = {
      resources: [...config.value.resources],
      actions: [...config.value.actions],
    }
  } finally {
    loading.value = false
  }
}

// Watch for external changes
watch(() => props.modelValue, (newVal: string[] | undefined) => {
  // Compare to avoid loops
  const currentScopes = scopeRows.value
    .map(row => buildScope(row.resource, row.action))
    .filter(s => s)
    .sort()
    .join(',')
  const newScopes = (newVal || []).sort().join(',')

  if (currentScopes !== newScopes) {
    initFromValue()
  }
}, { deep: true })

onMounted(async () => {
  await loadScopeDefinition()
  initFromValue()
})
</script>

<template>
  <div class="scope-editor">
    <div v-if="scopeRows.length === 0" class="scope-empty">
      <span class="text-surface-400">No scopes defined</span>
    </div>

    <div v-for="(row, index) in scopeRows" :key="index" class="scope-row">
      <span class="scope-prefix">{{ scopePrefix }}.</span>
      <AutoComplete
        v-model="row.resource"
        :suggestions="resourceSuggestions"
        @complete="searchResources"
        @change="updateResource(index, row.resource)"
        @item-select="(e) => updateResource(index, e.value)"
        :disabled="disabled || loading"
        placeholder="resource"
        class="scope-resource"
        :dropdown="true"
        :minLength="0"
      />
      <span class="scope-separator">:</span>
      <Select
        v-model="row.action"
        :options="allActions"
        @change="updateAction(index, row.action)"
        :disabled="disabled || loading"
        placeholder="action"
        class="scope-action"
      />
      <span v-if="isRowComplete(row)" class="scope-valid">✓</span>
      <span v-else class="scope-incomplete">...</span>
      <Button
        icon="pi pi-trash"
        severity="danger"
        text
        rounded
        size="small"
        :disabled="disabled"
        @click="removeRow(index)"
        class="scope-remove"
      />
    </div>

    <div class="scope-add">
      <Button
        label="Add Scope"
        icon="pi pi-plus"
        severity="secondary"
        text
        size="small"
        :disabled="disabled"
        @click="addRow"
      />
    </div>
  </div>
</template>

<style scoped>
/*
 * Only keep styles here that REQUIRE scoping (:deep, dynamic binding, component-specific overrides).
 * Generic/reusable styles belong in src/styles/ partials (see _forms.scss, _cards.scss, etc.).
 */
.scope-editor {
  border: 1px solid var(--p-surface-200);
  border-radius: 0.5rem;
  padding: 0.75rem;
  background: var(--p-surface-50);
}

.scope-empty {
  padding: 1rem;
  text-align: center;
  font-size: 0.875rem;
}

.scope-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.scope-prefix {
  font-family: monospace;
  font-size: 0.875rem;
  color: var(--p-surface-500);
  flex-shrink: 0;
}

.scope-separator {
  font-family: monospace;
  font-size: 0.875rem;
  color: var(--p-surface-500);
  flex-shrink: 0;
}

.scope-resource {
  flex: 1 1 auto !important;
  min-width: 200px !important;
}

.scope-action {
  width: 120px !important;
  min-width: 120px !important;
  flex: 0 0 120px !important;
}

.scope-valid {
  color: var(--p-green-500);
  font-weight: bold;
  width: 20px;
  text-align: center;
}

.scope-incomplete {
  color: var(--p-surface-400);
  width: 20px;
  text-align: center;
}

.scope-remove {
  flex-shrink: 0;
}

.scope-add {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--p-surface-200);
}

:deep(.scope-resource .p-autocomplete) {
  width: 100% !important;
}

:deep(.scope-resource .p-autocomplete-input) {
  width: 100%;
  font-family: monospace;
  font-size: 0.875rem;
}

:deep(.scope-action .p-select) {
  width: 120px !important;
  font-family: monospace;
  font-size: 0.875rem;
}
</style>
