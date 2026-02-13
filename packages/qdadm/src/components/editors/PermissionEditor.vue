<script setup lang="ts">
/**
 * PermissionEditor - Fragmented autocomplete for permissions
 *
 * Single text input with segment-aware completion:
 * - Type "au" → suggests "auth"
 * - Tab/select → completes to "auth:"
 * - Then suggests actions for that namespace
 *
 * Permission format: namespace:action
 * - entity:books:read (namespace=entity:books, action=read)
 * - auth:impersonate (namespace=auth, action=impersonate)
 */

import { ref, computed, nextTick, type ComponentPublicInstance } from 'vue'
import AutoComplete from 'primevue/autocomplete'
import Chip from 'primevue/chip'

interface Permission {
  key: string
  namespace: string
  action: string
  label: string
}

interface PermissionRegistry {
  getAll(): Permission[]
  get(key: string): Permission | undefined
}

interface Suggestion {
  label: string
  value: string
  type: 'namespace' | 'permission' | 'wildcard' | 'wildcard-action'
  description: string
}

interface PermissionInfo {
  namespace: string
  action: string
  label: string
  isWildcard?: boolean
}

interface Props {
  modelValue?: string[]
  disabled?: boolean
  permissionRegistry?: PermissionRegistry | null
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  disabled: false,
  placeholder: 'Type permission...'
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

// Current input value
const inputValue = ref<string>('')
const suggestions = ref<Suggestion[]>([])
const autocompleteRef = ref<ComponentPublicInstance | null>(null)

// Get all permissions from registry
const allPermissions = computed<Permission[]>(() => {
  if (!props.permissionRegistry) {
    console.warn('[PermissionEditor] No permissionRegistry provided')
    return []
  }
  const perms = props.permissionRegistry.getAll()
  return perms
})

// Check if registry is available
const hasRegistry = computed<boolean>(() => {
  return !!props.permissionRegistry && allPermissions.value.length > 0
})

// Get all permission keys
const allPermissionKeys = computed<string[]>(() => {
  return allPermissions.value.map(p => p.key)
})

// Get all unique prefixes at each level
// e.g., from "entity:books:read" we get ["entity", "entity:books", "entity:books:read"]
const allPrefixes = computed<string[]>(() => {
  const prefixes = new Set<string>()
  for (const key of allPermissionKeys.value) {
    const parts = key.split(':')
    let current = ''
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (part !== undefined) {
        current = current ? current + ':' + part : part
        prefixes.add(current)
      }
    }
  }
  return [...prefixes].sort()
})

// Get unique actions across all namespaces
const allActions = computed<string[]>(() => {
  const actions = new Set<string>()
  for (const perm of allPermissions.value) {
    actions.add(perm.action)
  }
  return [...actions].sort()
})

/**
 * Generate suggestions based on current input
 * Supports multi-level fragment completion:
 * - "ent" → "entity:"
 * - "entity:bo" → "entity:books:"
 * - "entity:books:re" → "entity:books:read"
 */
function searchSuggestions(event: { query?: string }): void {
  const query = event.query ?? ''
  const queryLower = query.toLowerCase()

  // Handle super wildcard **
  if (query === '**') {
    suggestions.value = [{
      label: '**',
      value: '**',
      type: 'wildcard',
      description: 'All permissions (super admin)'
    }]
    return
  }

  // Handle wildcard patterns
  if (query.includes('*')) {
    suggestions.value = generateWildcardSuggestions(query)
    return
  }

  // Check if query ends with ':'  - user wants next level suggestions
  const endsWithColon = query.endsWith(':')

  const results: Suggestion[] = []

  // Add wildcard option if at start or after colon
  if (query === '' || endsWithColon) {
    results.push({
      label: query + '*:',
      value: query + '*:',
      type: 'namespace',
      description: 'Wildcard (all at this level)'
    })
  }

  // Find matching prefixes that are NEXT level completions
  for (const prefix of allPrefixes.value) {
    const prefixLower = prefix.toLowerCase()

    if (endsWithColon) {
      // After "entity:", suggest "entity:books", "entity:users", etc.
      if (prefixLower.startsWith(queryLower) && prefix !== query.slice(0, -1)) {
        const isComplete = allPermissionKeys.value.includes(prefix)
        results.push({
          label: isComplete ? prefix : prefix + ':',
          value: isComplete ? prefix : prefix + ':',
          type: isComplete ? 'permission' : 'namespace',
          description: isComplete ? getPermissionLabel(prefix) : `${countChildren(prefix)} sub-items`
        })
      }
    } else {
      // Partial match: "ent" matches "entity", "entity:books:re" matches "entity:books:read"
      if (prefixLower.startsWith(queryLower) || (query === '' && true)) {
        // Only suggest if it's a progression from current input
        if (prefix.toLowerCase() !== queryLower) {
          const isComplete = allPermissionKeys.value.includes(prefix)
          // Find the next colon boundary for namespace suggestions
          const nextColonIdx = prefix.indexOf(':', query.length)
          const suggestionValue = nextColonIdx > -1 ? prefix.slice(0, nextColonIdx + 1) : (isComplete ? prefix : prefix + ':')

          // Avoid duplicates
          if (!results.some(r => r.value === suggestionValue)) {
            results.push({
              label: suggestionValue,
              value: suggestionValue,
              type: suggestionValue.endsWith(':') ? 'namespace' : 'permission',
              description: isComplete && !suggestionValue.endsWith(':') ? getPermissionLabel(prefix) : `${countChildren(suggestionValue.replace(/:$/, ''))} sub-items`
            })
          }
        }
      }
    }
  }

  // Sort: namespaces first, then permissions
  results.sort((a, b) => {
    if (a.type === 'namespace' && b.type !== 'namespace') return -1
    if (a.type !== 'namespace' && b.type === 'namespace') return 1
    return a.label.localeCompare(b.label)
  })

  suggestions.value = results.slice(0, 20) // Limit to 20 suggestions
}

/**
 * Generate wildcard suggestions
 */
function generateWildcardSuggestions(query: string): Suggestion[] {
  const results: Suggestion[] = []

  // *: pattern - suggest actions
  if (query === '*:' || query.startsWith('*:')) {
    const actionPart = query.slice(2).toLowerCase()

    results.push({
      label: '*:*',
      value: '*:*',
      type: 'wildcard',
      description: 'All permissions'
    })

    for (const action of allActions.value) {
      if (actionPart === '' || action.toLowerCase().startsWith(actionPart)) {
        results.push({
          label: '*:' + action,
          value: '*:' + action,
          type: 'wildcard-action',
          description: `All ${action} permissions`
        })
      }
    }
  } else if (query === '*') {
    // Just * - suggest *: to continue
    results.push({
      label: '*:',
      value: '*:',
      type: 'namespace',
      description: 'All namespaces (wildcard)'
    })
  }

  return results
}

/**
 * Count children of a prefix
 */
function countChildren(prefix: string): number {
  return allPrefixes.value.filter(p => p.startsWith(prefix + ':') || p === prefix).length
}

/**
 * Get permission label
 */
function getPermissionLabel(key: string): string {
  const perm = props.permissionRegistry?.get(key)
  return perm?.label || key
}

/**
 * Handle selection from dropdown
 */
function onSelect(event: { value: Suggestion }): void {
  const selected = event.value

  if (!selected) return

  // If selection ends with ':', it's a namespace - continue typing
  if (selected.value.endsWith(':')) {
    inputValue.value = selected.value
    nextTick(() => {
      const input = (autocompleteRef.value as ComponentPublicInstance & { $el: HTMLElement })?.$el?.querySelector('input') as HTMLInputElement | null
      input?.focus()
      // Trigger new search for next level and show dropdown
      searchSuggestions({ query: selected.value })
      // Force show the dropdown with new suggestions
      ;(autocompleteRef.value as ComponentPublicInstance & { show: () => void })?.show()
    })
  } else {
    // Complete permission or wildcard - add to list
    if (!props.modelValue.includes(selected.value)) {
      emit('update:modelValue', [...props.modelValue, selected.value])
    }
    inputValue.value = ''
  }
}

/**
 * Handle click on input - show suggestions if input ends with ':'
 * This ensures the dropdown appears when clicking back into the field
 */
function onInputClick(): void {
  if (inputValue.value.endsWith(':')) {
    searchSuggestions({ query: inputValue.value })
    nextTick(() => {
      ;(autocompleteRef.value as ComponentPublicInstance & { show: () => void })?.show()
    })
  }
}

/**
 * Handle keyboard events for Tab completion
 */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Tab' && suggestions.value.length > 0) {
    event.preventDefault()
    // Select first suggestion
    const first = suggestions.value[0]
    if (first) {
      // If it's a namespace, onSelect will show the dropdown for next level
      onSelect({ value: first })
    }
  } else if (event.key === 'Enter' && inputValue.value) {
    event.preventDefault()
    const value = inputValue.value

    // Check if it's a valid complete permission or wildcard pattern
    if (allPermissionKeys.value.includes(value) || value.includes('*')) {
      if (!props.modelValue.includes(value)) {
        emit('update:modelValue', [...props.modelValue, value])
      }
      inputValue.value = ''
    } else if (suggestions.value.length > 0 && suggestions.value[0]) {
      // Select first suggestion on Enter
      onSelect({ value: suggestions.value[0] })
    }
  }
}

/**
 * Remove a permission
 */
function removePermission(permKey: string): void {
  emit('update:modelValue', props.modelValue.filter(p => p !== permKey))
}

/**
 * Get display info for a permission
 */
function getPermissionInfo(permKey: string): PermissionInfo {
  // Handle super wildcard
  if (permKey === '**') {
    return {
      namespace: '',
      action: '**',
      label: 'All permissions',
      isWildcard: true
    }
  }

  // Handle wildcard patterns
  if (permKey.includes('*')) {
    const parts = permKey.split(':')
    const action = parts.pop() || ''
    const namespace = parts.join(':')
    return {
      namespace: namespace || '*',
      action,
      label: permKey,
      isWildcard: true
    }
  }

  const perm = props.permissionRegistry?.get(permKey)
  if (perm) {
    return {
      namespace: perm.namespace,
      action: perm.action,
      label: perm.label
    }
  }
  // Fallback for unknown permissions
  const parts = permKey.split(':')
  return {
    namespace: parts.slice(0, -1).join(':'),
    action: parts[parts.length - 1] || '',
    label: permKey
  }
}

/**
 * Custom template for suggestions
 */
function getSuggestionClass(item: Suggestion): string {
  return item.type === 'namespace' ? 'suggestion-namespace' : 'suggestion-permission'
}
</script>

<template>
  <div class="permission-editor">
    <!-- Selected permissions as chips -->
    <div v-if="modelValue.length > 0" class="permission-chips">
      <Chip
        v-for="perm in modelValue"
        :key="perm"
        :label="perm"
        removable
        :disabled="disabled"
        @remove="removePermission(perm)"
        :class="['permission-chip', { 'wildcard-chip': getPermissionInfo(perm).isWildcard }]"
      >
        <template #default>
          <template v-if="perm === '**'">
            <span class="chip-wildcard">**</span>
          </template>
          <template v-else-if="getPermissionInfo(perm).namespace">
            <span class="chip-namespace">{{ getPermissionInfo(perm).namespace }}:</span>
            <span :class="['chip-action', { 'chip-wildcard': getPermissionInfo(perm).action === '*' }]">
              {{ getPermissionInfo(perm).action }}
            </span>
          </template>
          <template v-else>
            <span class="chip-action">{{ perm }}</span>
          </template>
        </template>
      </Chip>
    </div>

    <!-- Autocomplete input -->
    <div class="permission-input">
      <template v-if="hasRegistry">
        <AutoComplete
          ref="autocompleteRef"
          v-model="inputValue"
          :suggestions="suggestions"
          optionLabel="label"
          :disabled="disabled"
          :placeholder="placeholder"
          :minLength="0"
          completeOnFocus
          @complete="searchSuggestions"
          @item-select="onSelect"
          @keydown="onKeydown"
          @click="onInputClick"
          dropdown
          class="w-full"
        >
          <template #option="{ option }">
            <div :class="['suggestion-item', getSuggestionClass(option)]">
              <span class="suggestion-label">{{ option.label }}</span>
              <span class="suggestion-desc">{{ option.description }}</span>
            </div>
          </template>
          <template #empty>
            <div class="suggestion-empty">
              No matching permissions
            </div>
          </template>
        </AutoComplete>
        <small class="text-color-secondary mt-1 block">
          Type permission path (e.g., "entity:books:read"), Tab to complete
        </small>
      </template>
      <template v-else>
        <div class="no-registry">
          <i class="pi pi-info-circle"></i>
          <span>No permissions registered in the system</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/*
 * Only keep styles here that REQUIRE scoping (:deep, dynamic binding, component-specific overrides).
 * Generic/reusable styles belong in src/styles/ partials (see _forms.scss, _cards.scss, etc.).
 */
/* Uses global .editor-box pattern */
.permission-editor {
  border: 1px solid var(--p-surface-200);
  border-radius: 0.5rem;
  padding: 0.75rem;
  background: var(--p-surface-50);
}

/* Uses global .editor-chips pattern */
.permission-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--p-surface-200);
}

.permission-chip {
  font-family: monospace;
  font-size: 0.875rem;
}

/* .chip-namespace, .chip-action, .chip-wildcard are global (main.css) */

.wildcard-chip {
  background: var(--p-orange-50) !important;
  border-color: var(--p-orange-200) !important;
}

.permission-input {
  display: flex;
  flex-direction: column;
}

.suggestion-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0;
  gap: 1rem;
}

.suggestion-namespace .suggestion-label,
.suggestion-permission .suggestion-label {
  font-family: monospace;
}

.suggestion-namespace .suggestion-label {
  color: var(--p-primary-600);
}

.suggestion-permission .suggestion-label {
  font-weight: 500;
}

.suggestion-desc {
  font-size: 0.75rem;
  color: var(--p-surface-500);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.suggestion-empty {
  padding: 0.5rem;
  color: var(--p-surface-400);
  font-style: italic;
}

.no-registry {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  color: var(--p-surface-500);
  font-style: italic;
}

:deep(.p-autocomplete) {
  width: 100%;
}

:deep(.p-autocomplete-input) {
  width: 100%;
  font-family: monospace;
}
</style>
