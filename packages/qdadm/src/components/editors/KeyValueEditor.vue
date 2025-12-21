<script setup>
/**
 * KeyValueEditor - Reusable component for editing key-value pairs
 *
 * Props:
 * - modelValue: Array of {key, value} objects
 * - label: Field label
 * - help: Help text
 * - keyPlaceholder: Placeholder for key input
 * - valuePlaceholder: Placeholder for value input (text mode only)
 * - keySuggestions: Array of strings for autocomplete on key input
 * - valueType: 'number' (default) or 'text'
 * - min: Minimum value (default: 0, number mode only)
 * - max: Maximum value (default: 1, number mode only)
 * - step: Slider step (default: 0.1, number mode only)
 * - showSign: Show +/- sign for values (default: false, number mode only)
 * - colorize: Color negative/positive values (default: false, number mode only)
 */

import { ref, computed } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import AutoComplete from 'primevue/autocomplete'
import Slider from 'primevue/slider'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  label: {
    type: String,
    default: 'Key-Value Pairs'
  },
  help: {
    type: String,
    default: ''
  },
  keyPlaceholder: {
    type: String,
    default: 'Key'
  },
  valuePlaceholder: {
    type: String,
    default: 'Value'
  },
  keySuggestions: {
    type: Array,
    default: () => []
  },
  valueType: {
    type: String,
    default: 'number',
    validator: (v) => ['number', 'text'].includes(v)
  },
  min: {
    type: Number,
    default: 0
  },
  max: {
    type: Number,
    default: 1
  },
  step: {
    type: Number,
    default: 0.1
  },
  showSign: {
    type: Boolean,
    default: false
  },
  colorize: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const items = computed({
  get: () => props.modelValue || [],
  set: (value) => emit('update:modelValue', value)
})

const isTextMode = computed(() => props.valueType === 'text')
const hasKeySuggestions = computed(() => props.keySuggestions.length > 0)
const filteredKeySuggestions = ref([])

const newItem = ref({
  key: '',
  value: props.valueType === 'text' ? '' : (props.min + props.max) / 2
})

// Filter key suggestions for autocomplete (exclude already used keys)
function searchKeys(event) {
  const query = event.query.toLowerCase()
  const usedKeys = items.value.map(item => item.key)
  filteredKeySuggestions.value = props.keySuggestions
    .filter(k => !usedKeys.includes(k))
    .filter(k => k.toLowerCase().includes(query))
}

function formatValue(value) {
  if (isTextMode.value) {
    return value
  }
  const formatted = Number(value).toFixed(2)
  if (props.showSign && value > 0) {
    return '+' + formatted
  }
  return formatted
}

function addItem() {
  if (!newItem.value.key) return
  if (isTextMode.value && !newItem.value.value) return
  const updated = [...items.value, { ...newItem.value }]
  emit('update:modelValue', updated)
  newItem.value = {
    key: '',
    value: isTextMode.value ? '' : (props.min + props.max) / 2
  }
}

function removeItem(index) {
  const updated = items.value.filter((_, i) => i !== index)
  emit('update:modelValue', updated)
}

function updateItemValue(index, value) {
  const updated = [...items.value]
  updated[index] = { ...updated[index], value }
  emit('update:modelValue', updated)
}
</script>

<template>
  <div class="form-field">
    <label>{{ label }}</label>
    <div class="kv-list">
      <div v-if="items.length === 0" class="kv-empty">
        No items added yet
      </div>
      <div v-for="(item, index) in items" :key="index" class="kv-item">
        <span class="kv-key">{{ item.key }}</span>
        <div class="kv-value-container">
          <!-- Text mode: show text input -->
          <template v-if="isTextMode">
            <InputText
              :modelValue="item.value"
              @update:modelValue="(v) => updateItemValue(index, v)"
              class="kv-text-input"
            />
          </template>
          <!-- Number mode: show slider -->
          <template v-else>
            <span
              class="kv-value"
              :class="{
                negative: colorize && item.value < 0,
                positive: colorize && item.value > 0
              }"
            >
              {{ formatValue(item.value) }}
            </span>
            <Slider
              :modelValue="item.value"
              @update:modelValue="(v) => updateItemValue(index, v)"
              :min="min"
              :max="max"
              :step="step"
              style="width: 100px"
            />
          </template>
        </div>
        <Button
          icon="pi pi-times"
          severity="danger"
          text
          rounded
          size="small"
          @click="removeItem(index)"
        />
      </div>
    </div>
    <div class="kv-add">
      <Button
        icon="pi pi-plus"
        @click="addItem"
        :disabled="!newItem.key || (isTextMode && !newItem.value)"
        v-tooltip.top="'Add item'"
      />
      <!-- With autocomplete suggestions -->
      <AutoComplete
        v-if="hasKeySuggestions"
        v-model="newItem.key"
        :suggestions="filteredKeySuggestions"
        @complete="searchKeys"
        :placeholder="keyPlaceholder"
        class="kv-add-input"
        @keyup.enter="addItem"
      />
      <!-- Without suggestions: plain input -->
      <InputText
        v-else
        v-model="newItem.key"
        :placeholder="keyPlaceholder"
        class="kv-add-input"
        @keyup.enter="addItem"
      />
      <!-- Text mode: show text input for value -->
      <template v-if="isTextMode">
        <InputText
          v-model="newItem.value"
          :placeholder="valuePlaceholder"
          class="kv-add-value"
          @keyup.enter="addItem"
        />
      </template>
      <!-- Number mode: show slider -->
      <template v-else>
        <div class="kv-slider">
          <span>{{ formatValue(newItem.value) }}</span>
          <Slider v-model="newItem.value" :min="min" :max="max" :step="step" style="width: 100px" />
        </div>
      </template>
    </div>
    <small v-if="help" class="form-field-help">{{ help }}</small>
  </div>
</template>

<style scoped>
.kv-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.kv-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--p-surface-50);
  border-radius: 0.25rem;
}

.kv-key {
  font-weight: 500;
  min-width: 120px;
}

.kv-value-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.kv-value {
  min-width: 50px;
  text-align: right;
  font-family: monospace;
}

.kv-value.negative {
  color: var(--p-red-500);
}

.kv-value.positive {
  color: var(--p-green-500);
}

.kv-add {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.kv-add-input {
  flex: 1;
}

.kv-add-value {
  flex: 1;
  min-width: 150px;
}

.kv-text-input {
  flex: 1;
}

.kv-slider {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.kv-slider span {
  min-width: 50px;
  text-align: right;
  font-family: monospace;
}

.kv-empty {
  padding: 0.75rem;
  color: var(--p-text-secondary);
  font-style: italic;
  background: var(--p-surface-50);
  border-radius: 0.25rem;
  text-align: center;
}
</style>
