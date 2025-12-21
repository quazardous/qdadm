<script setup>
/**
 * JsonStructuredField - Reusable field with structured/JSON toggle
 *
 * A form field that shows either a structured view (slot) or raw JSON editor.
 * Uses a mini SelectButton to toggle between views.
 *
 * Usage patterns:
 *
 * 1. Simple - same v-model for both views:
 * <JsonStructuredField v-model="myData">
 *   <MyStructuredEditor v-model="myData" />
 * </JsonStructuredField>
 *
 * 2. With separate JSON binding (for complex computed mappings):
 * <JsonStructuredField v-model="myData" :jsonValue="jsonComputed" @update:jsonValue="onJsonUpdate">
 *   <MyStructuredEditor v-model="myData" />
 * </JsonStructuredField>
 *
 * 3. Controlled mode (parent manages viewMode):
 * <JsonStructuredField v-model="myData" v-model:mode="viewMode">
 *   <MyStructuredEditor v-model="myData" />
 * </JsonStructuredField>
 *
 * Props:
 * - modelValue: The JSON object to edit (used for JSON view if jsonValue not provided)
 * - jsonValue: Optional separate binding for JSON editor (for complex computed mappings)
 * - mode: Optional v-model for view mode ('structured' or 'json')
 * - label: Optional label for the field
 * - jsonHeight: Height of JSON editor (default: 400px)
 * - jsonMode: Mode for JSON editor - 'tree' or 'text' (default: 'text')
 * - defaultMode: Initial mode if not using v-model:mode (default: 'structured')
 * - showToggle: Whether to show the toggle (default: true, useful to hide in nested usage)
 */

import { ref, computed, watch } from 'vue'
import SelectButton from 'primevue/selectbutton'
import VanillaJsonEditor from './VanillaJsonEditor.vue'

const props = defineProps({
  modelValue: {
    type: [Object, Array],
    default: () => ({})
  },
  jsonValue: {
    type: [Object, Array],
    default: null
  },
  mode: {
    type: String,
    default: null
  },
  label: {
    type: String,
    default: null
  },
  jsonHeight: {
    type: String,
    default: '400px'
  },
  jsonMode: {
    type: String,
    default: 'text',
    validator: (v) => ['tree', 'text'].includes(v)
  },
  defaultMode: {
    type: String,
    default: 'structured',
    validator: (v) => ['structured', 'json'].includes(v)
  },
  showToggle: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'update:jsonValue', 'update:mode'])

// Internal view mode (used when not controlled externally)
const internalMode = ref(props.defaultMode)

// Computed view mode - use external if provided, else internal
const viewMode = computed({
  get: () => props.mode ?? internalMode.value,
  set: (val) => {
    if (props.mode !== null) {
      emit('update:mode', val)
    } else {
      internalMode.value = val
    }
  }
})

const viewModeOptions = [
  { label: 'Structured', value: 'structured', icon: 'pi pi-list' },
  { label: 'JSON', value: 'json', icon: 'pi pi-code' }
]

// Computed JSON value - use separate jsonValue if provided, else modelValue
const effectiveJsonValue = computed(() => {
  return props.jsonValue !== null ? props.jsonValue : props.modelValue
})

// Handle JSON editor updates
function onJsonUpdate(newValue) {
  if (props.jsonValue !== null) {
    // Using separate jsonValue binding
    emit('update:jsonValue', newValue)
  } else {
    // Using modelValue for both
    emit('update:modelValue', newValue)
  }
}

// Forward modelValue updates (for structured view)
// eslint-disable-next-line no-unused-vars
function emitUpdate(newValue) {
  emit('update:modelValue', newValue)
}

// Sync internal mode with prop if it changes
watch(() => props.mode, (newMode) => {
  if (newMode !== null) {
    internalMode.value = newMode
  }
})
</script>

<template>
  <div class="json-structured-field">
    <!-- Header with label and mode toggle -->
    <div v-if="showToggle || label" class="field-header">
      <label v-if="label" class="field-label">{{ label }}</label>
      <SelectButton
        v-if="showToggle"
        v-model="viewMode"
        :options="viewModeOptions"
        optionLabel="label"
        optionValue="value"
        :allowEmpty="false"
        class="mode-toggle"
      >
        <template #option="{ option }">
          <i :class="option.icon"></i>
          <span class="toggle-label">{{ option.label }}</span>
        </template>
      </SelectButton>
    </div>

    <!-- JSON View -->
    <div v-if="viewMode === 'json'" class="json-view">
      <VanillaJsonEditor
        :modelValue="effectiveJsonValue"
        @update:modelValue="onJsonUpdate"
        :mode="jsonMode"
        :height="jsonHeight"
      />
    </div>

    <!-- Structured View (slot) -->
    <div v-else class="structured-view">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped>
.json-structured-field {
  width: 100%;
}

.field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.field-label {
  font-weight: 600;
  font-size: 0.95rem;
}

.mode-toggle {
  flex-shrink: 0;
}

/* Smaller toggle buttons */
.mode-toggle :deep(.p-button) {
  padding: 0.35rem 0.6rem;
  font-size: 0.8rem;
}

.mode-toggle :deep(.p-button i) {
  font-size: 0.75rem;
  margin-right: 0.25rem;
}

.toggle-label {
  display: none;
}

@media (min-width: 640px) {
  .toggle-label {
    display: inline;
  }
}

.json-view {
  margin-top: 0.25rem;
}

.structured-view {
  margin-top: 0.25rem;
}
</style>
