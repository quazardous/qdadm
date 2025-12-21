<script setup>
/**
 * JsonEditorFoldable - JSON editor with collapsible sections
 *
 * Displays each top-level key as a foldable section.
 * Long content (like "content" field) can be collapsed to reduce visual noise.
 *
 * Usage:
 * <JsonEditorFoldable v-model="jsonData" :defaultExpanded="['content']" />
 */

import { ref, computed, watch } from 'vue'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { getJsonValueType, getJsonPreview } from '../../composables/useJsonSyntax'

const props = defineProps({
  modelValue: {
    type: [Object, null],
    default: () => ({})
  },
  defaultExpanded: {
    type: Array,
    default: () => ['content'] // "content" expanded by default
  },
  height: {
    type: String,
    default: '400px'
  }
})

const emit = defineEmits(['update:modelValue'])

// Internal state: track which sections are expanded
const expandedSections = ref(new Set(props.defaultExpanded))

// Internal copy of data for editing
const localData = ref({})

// Parse error for raw JSON mode
const parseError = ref(null)
const rawJsonMode = ref(false)
const rawJsonText = ref('')

// Sync from modelValue
watch(() => props.modelValue, (newVal) => {
  if (newVal && typeof newVal === 'object') {
    localData.value = JSON.parse(JSON.stringify(newVal))
    rawJsonText.value = JSON.stringify(newVal, null, 2)
  } else {
    localData.value = {}
    rawJsonText.value = '{}'
  }
}, { immediate: true, deep: true })

// Computed: sorted keys with "content" first if present
const sortedKeys = computed(() => {
  const keys = Object.keys(localData.value || {})
  // Put 'content' first, then sort rest alphabetically
  return keys.sort((a, b) => {
    if (a === 'content') return -1
    if (b === 'content') return 1
    return a.localeCompare(b)
  })
})

function isExpanded(key) {
  return expandedSections.value.has(key)
}

function toggleSection(key) {
  if (expandedSections.value.has(key)) {
    expandedSections.value.delete(key)
  } else {
    expandedSections.value.add(key)
  }
  // Trigger reactivity
  expandedSections.value = new Set(expandedSections.value)
}

function expandAll() {
  expandedSections.value = new Set(sortedKeys.value)
}

function collapseAll() {
  expandedSections.value = new Set()
}

// Update a specific field
function updateField(key, newValue) {
  const type = getJsonValueType(localData.value[key])

  if (type === 'string') {
    localData.value[key] = newValue
  } else if (type === 'number') {
    localData.value[key] = parseFloat(newValue) || 0
  } else if (type === 'boolean') {
    localData.value[key] = newValue === 'true' || newValue === true
  } else if (type === 'array' || type === 'object') {
    // Parse as JSON for complex types
    try {
      localData.value[key] = JSON.parse(newValue)
    } catch {
      // Invalid JSON, don't update
      return
    }
  }

  emitUpdate()
}

function emitUpdate() {
  emit('update:modelValue', JSON.parse(JSON.stringify(localData.value)))
}

// Raw JSON mode handling
function toggleRawMode() {
  if (rawJsonMode.value) {
    // Switching from raw to structured - parse the raw JSON
    try {
      localData.value = JSON.parse(rawJsonText.value)
      parseError.value = null
      emitUpdate()
    } catch (e) {
      parseError.value = e.message
      return // Don't switch if invalid
    }
  } else {
    // Switching to raw mode - serialize current data
    rawJsonText.value = JSON.stringify(localData.value, null, 2)
  }
  rawJsonMode.value = !rawJsonMode.value
}

function onRawJsonInput(event) {
  rawJsonText.value = event.target.value
  try {
    JSON.parse(rawJsonText.value)
    parseError.value = null
  } catch (e) {
    parseError.value = e.message
  }
}

function saveRawJson() {
  try {
    localData.value = JSON.parse(rawJsonText.value)
    parseError.value = null
    emitUpdate()
  } catch (e) {
    parseError.value = e.message
  }
}

// Get appropriate editor for value type
function isMultiline(value) {
  if (typeof value !== 'string') return false
  return value.length > 100 || value.includes('\n')
}
</script>

<template>
  <div class="json-editor-foldable">
    <!-- Toolbar -->
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <Button
          :icon="rawJsonMode ? 'pi pi-list' : 'pi pi-code'"
          :label="rawJsonMode ? 'Structured' : 'Raw JSON'"
          size="small"
          severity="secondary"
          text
          @click="toggleRawMode"
        />
      </div>
      <div class="toolbar-right" v-if="!rawJsonMode">
        <Button
          icon="pi pi-plus"
          label="Expand All"
          size="small"
          severity="secondary"
          text
          @click="expandAll"
        />
        <Button
          icon="pi pi-minus"
          label="Collapse All"
          size="small"
          severity="secondary"
          text
          @click="collapseAll"
        />
      </div>
    </div>

    <!-- Structured Mode -->
    <div v-if="!rawJsonMode" class="sections-container" :style="{ maxHeight: height }">
      <div
        v-for="key in sortedKeys"
        :key="key"
        class="section"
        :class="{ expanded: isExpanded(key) }"
      >
        <div class="section-header" @click="toggleSection(key)">
          <i
            class="pi"
            :class="isExpanded(key) ? 'pi-chevron-down' : 'pi-chevron-right'"
          ></i>
          <span class="section-key">{{ key }}</span>
          <span class="section-type">{{ getJsonValueType(localData[key]) }}</span>
          <span v-if="!isExpanded(key)" class="section-preview">{{ getJsonPreview(localData[key]) }}</span>
        </div>

        <div v-if="isExpanded(key)" class="section-content">
          <!-- String (multiline) -->
          <Textarea
            v-if="getJsonValueType(localData[key]) === 'string' && isMultiline(localData[key])"
            :modelValue="localData[key]"
            @update:modelValue="updateField(key, $event)"
            rows="8"
            class="w-full field-textarea"
            autoResize
          />

          <!-- String (single line) -->
          <InputText
            v-else-if="getJsonValueType(localData[key]) === 'string'"
            :modelValue="localData[key]"
            @update:modelValue="updateField(key, $event)"
            class="w-full"
          />

          <!-- Number -->
          <InputText
            v-else-if="getJsonValueType(localData[key]) === 'number'"
            type="number"
            :modelValue="String(localData[key])"
            @update:modelValue="updateField(key, $event)"
            class="w-full"
          />

          <!-- Boolean -->
          <select
            v-else-if="getJsonValueType(localData[key]) === 'boolean'"
            :value="String(localData[key])"
            @change="updateField(key, $event.target.value)"
            class="field-select"
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>

          <!-- Array or Object - show as JSON -->
          <Textarea
            v-else-if="getJsonValueType(localData[key]) === 'array' || getJsonValueType(localData[key]) === 'object'"
            :modelValue="JSON.stringify(localData[key], null, 2)"
            @update:modelValue="updateField(key, $event)"
            rows="6"
            class="w-full field-json"
            autoResize
          />

          <!-- Null -->
          <span v-else-if="getJsonValueType(localData[key]) === 'null'" class="null-value">null</span>
        </div>
      </div>

      <div v-if="sortedKeys.length === 0" class="empty-state">
        <i class="pi pi-inbox"></i>
        <span>No data</span>
      </div>
    </div>

    <!-- Raw JSON Mode -->
    <div v-else class="raw-json-container" :style="{ height }">
      <textarea
        class="raw-json-textarea"
        :class="{ 'has-error': parseError }"
        :value="rawJsonText"
        @input="onRawJsonInput"
        spellcheck="false"
      ></textarea>
      <div v-if="parseError" class="raw-json-actions">
        <Message severity="error" :closable="false" class="parse-error">
          {{ parseError }}
        </Message>
      </div>
      <div v-else class="raw-json-actions">
        <Button
          label="Apply Changes"
          icon="pi pi-check"
          size="small"
          @click="saveRawJson"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.json-editor-foldable {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--p-surface-300);
  border-radius: 0.375rem;
  background: var(--p-surface-0);
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  border-bottom: 1px solid var(--p-surface-200);
  background: var(--p-surface-50);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  gap: 0.25rem;
}

.sections-container {
  overflow-y: auto;
  padding: 0.5rem;
}

.section {
  border: 1px solid var(--p-surface-200);
  border-radius: 0.375rem;
  margin-bottom: 0.5rem;
  background: var(--p-surface-0);
}

.section:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  cursor: pointer;
  user-select: none;
  background: var(--p-surface-50);
  border-radius: 0.375rem;
}

.section.expanded .section-header {
  border-bottom: 1px solid var(--p-surface-200);
  border-radius: 0.375rem 0.375rem 0 0;
}

.section-header:hover {
  background: var(--p-surface-100);
}

.section-header .pi {
  font-size: 0.75rem;
  color: var(--p-surface-500);
}

.section-key {
  font-weight: 600;
  color: var(--p-primary-700);
}

.section-type {
  font-size: 0.75rem;
  color: var(--p-surface-400);
  padding: 0.125rem 0.375rem;
  background: var(--p-surface-100);
  border-radius: 0.25rem;
}

.section-preview {
  flex: 1;
  font-size: 0.8125rem;
  color: var(--p-surface-500);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

.section-content {
  padding: 0.75rem;
}

.field-textarea,
.field-json {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.field-json {
  background: var(--p-surface-50);
}

.field-select {
  padding: 0.5rem;
  border: 1px solid var(--p-surface-300);
  border-radius: 0.375rem;
  background: var(--p-surface-0);
  font-size: 0.875rem;
}

.null-value {
  color: var(--p-surface-400);
  font-style: italic;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--p-surface-400);
  gap: 0.5rem;
}

.empty-state .pi {
  font-size: 2rem;
}

/* Raw JSON mode */
.raw-json-container {
  display: flex;
  flex-direction: column;
}

.raw-json-textarea {
  flex: 1;
  padding: 1rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8125rem;
  line-height: 1.5;
  border: none;
  outline: none;
  resize: none;
  background: var(--p-surface-50);
}

.raw-json-textarea.has-error {
  background: var(--p-red-50);
}

.raw-json-actions {
  padding: 0.5rem;
  border-top: 1px solid var(--p-surface-200);
  background: var(--p-surface-50);
}

.parse-error {
  margin: 0;
}

.w-full {
  width: 100%;
}
</style>
