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
 *
 * The permissions to suggest: a `permissionRegistry`, or a plain list of keys
 * as `permissions` (#5333). Wildcards follow PermissionMatcher (`*` one
 * segment, `**` any number): `**`, `**:read`, `logs:**`, `logs:*:read`…
 *
 * For a raw text face of the same list, put it in a StructuredField:
 *   <StructuredField v-model="scopes" format="yaml"><PermissionEditor v-model="scopes" :permissions="all" /></StructuredField>
 */

import { ref, computed, nextTick, type ComponentPublicInstance } from 'vue'
import AutoComplete from 'primevue/autocomplete'
import Chip from 'primevue/chip'
import { useI18n } from '../../i18n/useI18n'
import {
  permissionRegistryFromList,
  suggestPermissions,
  type PermissionRegistry,
  type Permission,
  type Suggestion,
  type SuggestionTexts,
} from './permissionSuggestions'

interface PermissionInfo {
  namespace: string
  action: string
  label: string
  isWildcard?: boolean
}

interface Props {
  modelValue?: string[]
  disabled?: boolean
  /** The permissions to suggest, as a registry… */
  permissionRegistry?: PermissionRegistry | null
  /** …or as a plain list of keys (#5333) */
  permissions?: string[] | null
  /** Default from the catalogue */
  placeholder?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  disabled: false,
  permissionRegistry: null,
  permissions: null,
  placeholder: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const { tOr } = useI18n()

// Current input value
const inputValue = ref<string>('')
const suggestions = ref<Suggestion[]>([])
const autocompleteRef = ref<ComponentPublicInstance | null>(null)

/** The registry given, or one made from the plain list; labels `permissions.<key>` from the catalogue */
const registry = computed<PermissionRegistry | null>(() => {
  if (props.permissionRegistry) return props.permissionRegistry
  if (props.permissions) return permissionRegistryFromList(props.permissions, (key) => tOr(`permissions.${key}`, key))
  return null
})

let warnedNoSource = false
const allPermissions = computed<Permission[]>(() => {
  if (!registry.value) {
    if (!warnedNoSource) {
      warnedNoSource = true
      console.warn('[PermissionEditor] No permissionRegistry or permissions given: nothing to suggest')
    }
    return []
  }
  return registry.value.getAll()
})

const hasRegistry = computed<boolean>(() => allPermissions.value.length > 0)
const allPermissionKeys = computed<string[]>(() => allPermissions.value.map((p) => p.key))
const placeholderText = computed(() => props.placeholder ?? tOr('core.permissionEditor.placeholder', 'Type a permission…'))

const texts: SuggestionTexts = {
  all: () => tOr('core.permissionEditor.all', 'All permissions'),
  actionEverywhere: (action) => tOr('core.permissionEditor.actionEverywhere', '{action}, everywhere', { action }),
  anActionEverywhere: () => tOr('core.permissionEditor.anActionEverywhere', 'One action, everywhere'),
  allUnder: (prefix) => tOr('core.permissionEditor.allUnder', 'Everything under {prefix}', { prefix }),
  directUnder: (prefix) => tOr('core.permissionEditor.directUnder', 'Every {prefix} permission, one level', { prefix }),
  actionUnder: (action, prefix) => tOr('core.permissionEditor.actionUnder', '{action} under {prefix}', { action, prefix }),
  subItems: (count) => tOr('core.permissionEditor.subItems', '{count} sub-item | {count} sub-items', { count }),
  label: (key) => getPermissionLabel(key),
}

/** Suggestions for the current input: next segments and the wildcards that make sense */
function searchSuggestions(event: { query?: string }): void {
  suggestions.value = suggestPermissions(event.query ?? '', allPermissionKeys.value, texts)
}

/**
 * Get permission label
 */
function getPermissionLabel(key: string): string {
  const perm = registry.value?.get(key)
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
      label: tOr('core.permissionEditor.all', 'All permissions'),
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

  const perm = registry.value?.get(permKey)
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
          :placeholder="placeholderText"
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
              {{ tOr('core.permissionEditor.noMatch', 'No matching permission') }}
            </div>
          </template>
        </AutoComplete>
        <small class="text-color-secondary mt-1 block">
          {{ tOr('core.permissionEditor.help', 'Type a permission (e.g. "entity:books:read"), Tab to complete') }}
        </small>
      </template>
      <template v-else>
        <div class="no-registry">
          <i class="pi pi-info-circle"></i>
          <span>{{ tOr('core.permissionEditor.noPermissions', 'No permission to suggest') }}</span>
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
