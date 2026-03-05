<script setup lang="ts">
/**
 * LookupField - Unified lookup input with two UI modes
 *
 * Wraps useOptionsLookup into a ready-to-use form field component.
 *
 * Modes (pickerMode):
 * - **inline** (default): PrimeVue AutoComplete with dropdown button.
 *   User types to filter, selects from suggestions. Value encoded/decoded via useOptionsLookup.
 * - **picker**: Readonly input + search button. Opens a modal DataTable
 *   for rich search (columns, sort, pagination). Current value untouched until selection.
 *
 * Usage:
 * ```vue
 * <!-- Inline autocomplete (default) -->
 * <LookupField v-model="form.data.value.authorId" :lookup="authorLookup" />
 *
 * <!-- Picker dialog -->
 * <LookupField
 *   v-model="form.data.value.bookId"
 *   :lookup="bookLookup"
 *   pickerMode="picker"
 *   :pickerColumns="['title', 'author', 'year']"
 *   pickerTitle="Select a Book"
 * />
 * ```
 */
import { ref, computed, watch, type PropType } from 'vue'
import AutoComplete from 'primevue/autocomplete'
import InputText from 'primevue/inputtext'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import Button from 'primevue/button'
import LookupPickerDialog from './LookupPickerDialog.vue'
import type { UseOptionsLookupReturn } from '../../composables/useOptionsLookup'
import type { LookupColumn } from './LookupPickerDialog.vue'

type PickerMode = 'inline' | 'picker'

const props = defineProps({
  /** v-model: the raw value (e.g. an ID) */
  modelValue: { type: [String, Number, null] as PropType<string | number | null>, default: null },
  /** useOptionsLookup return object */
  lookup: { type: Object as PropType<UseOptionsLookupReturn>, required: true },
  /** UI mode */
  pickerMode: { type: String as PropType<PickerMode>, default: 'inline' },
  /** Columns shown in picker dialog (picker mode only) */
  pickerColumns: { type: Array as PropType<(string | LookupColumn)[]>, default: () => [] },
  /** Dialog title (picker mode only) */
  pickerTitle: { type: String, default: 'Select item' },
  /** Dialog width (picker mode only) */
  pickerWidth: { type: String, default: '700px' },
  /** Placeholder text */
  placeholder: { type: String, default: '' },
  /** Disabled state */
  disabled: { type: Boolean, default: false },
  /** CSS class for the root element */
  class: { type: String, default: '' },
})

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
}>()

// --- Inline mode state ---
// Display string shown in autocomplete (encoded label, not the raw value)
const displayValue = ref('')

// Sync: when modelValue changes externally, resolve to display string
watch(() => props.modelValue, (val) => {
  if (val != null && val !== '') {
    displayValue.value = props.lookup.resolve(val)
  } else {
    displayValue.value = ''
  }
}, { immediate: true })

// When options load after mount, re-resolve display
watch(() => props.lookup.options.value.length, () => {
  if (props.modelValue != null && props.modelValue !== '') {
    displayValue.value = props.lookup.resolve(props.modelValue)
  }
})

function onInlineSelect(event: { value: string }): void {
  const raw = props.lookup.decode(event.value ?? displayValue.value)
  emit('update:modelValue', raw)
}

function onInlineBlur(): void {
  // On blur, decode whatever the user typed
  if (displayValue.value) {
    const raw = props.lookup.decode(displayValue.value)
    emit('update:modelValue', raw)
  } else {
    emit('update:modelValue', null)
  }
}

// --- Picker mode state ---
const pickerVisible = ref(false)

// Resolved display label for picker mode (readonly input)
const pickerDisplayLabel = computed(() => {
  if (props.modelValue == null || props.modelValue === '') return ''
  return props.lookup.resolve(props.modelValue)
})

// Picker columns: fall back to label+value fields if not specified
const resolvedPickerColumns = computed(() => {
  if (props.pickerColumns.length > 0) return props.pickerColumns
  // Default: show all raw item fields from first item, or label/value
  const firstRaw = props.lookup.raw.value[0]
  if (firstRaw && typeof firstRaw === 'object') {
    return Object.keys(firstRaw as Record<string, unknown>).slice(0, 4)
  }
  return ['name', 'id']
})

function onPickerSelect(item: Record<string, unknown>): void {
  const valueField = guessValueField()
  const raw = item[valueField] ?? item.value ?? item.id
  emit('update:modelValue', raw)
}

function guessValueField(): string {
  // Try to infer from lookup options
  const firstOpt = props.lookup.options.value[0]
  if (!firstOpt) return 'id'
  // Check raw items for the value field
  const firstRaw = props.lookup.raw.value[0] as Record<string, unknown> | undefined
  if (firstRaw) {
    // Find which raw field matches the first option's value
    for (const [key, val] of Object.entries(firstRaw)) {
      if (val === firstOpt.value) return key
    }
  }
  return 'id'
}

function openPicker(): void {
  if (!props.disabled) pickerVisible.value = true
}

const hasValue = computed(() => props.modelValue != null && props.modelValue !== '')

function clearValue(): void {
  emit('update:modelValue', null)
  displayValue.value = ''
}
</script>

<template>
  <!-- Inline mode: standalone AutoComplete (no InputGroup, preserves native border-radius) -->
  <span v-if="pickerMode === 'inline'" class="lookup-field-inline" :class="props.class || 'w-full'">
    <AutoComplete
      v-model="displayValue"
      :suggestions="lookup.suggestions.value"
      @complete="lookup.search($event.query)"
      @item-select="onInlineSelect"
      @blur="onInlineBlur"
      :loading="lookup.loading.value"
      :disabled="disabled"
      :placeholder="placeholder"
      dropdown
      class="w-full"
    />
    <button
      v-if="hasValue && !disabled"
      type="button"
      class="lookup-clear-btn lookup-clear-btn--inline"
      @click="clearValue"
      tabindex="-1"
    >
      <i class="pi pi-times" />
    </button>
  </span>

  <!-- Picker mode: InputGroup = input + clear overlay + search group button -->
  <span v-else :class="props.class || 'w-full'" class="lookup-field-picker">
    <InputGroup>
      <InputText
        :modelValue="pickerDisplayLabel"
        readonly
        :placeholder="placeholder || 'Click to select...'"
        :disabled="disabled"
        @click="openPicker"
        style="cursor: pointer"
      />
      <InputGroupAddon class="lookup-search-addon" @click="openPicker">
        <i v-if="lookup.loading.value" class="pi pi-spinner pi-spin" />
        <i v-else class="pi pi-search" />
      </InputGroupAddon>
    </InputGroup>
    <button
      v-if="hasValue && !disabled"
      type="button"
      class="lookup-clear-btn lookup-clear-btn--picker"
      @click.stop="clearValue"
      tabindex="-1"
    >
      <i class="pi pi-times" />
    </button>

    <LookupPickerDialog
      v-model:visible="pickerVisible"
      :title="pickerTitle"
      :items="(lookup.raw.value as Record<string, unknown>[])"
      :columns="resolvedPickerColumns"
      :loading="lookup.loading.value"
      :currentValue="modelValue"
      :valueField="guessValueField()"
      :width="pickerWidth"
      @select="onPickerSelect"
    />
  </span>
</template>

<style scoped>
.lookup-field-inline,
.lookup-field-picker {
  position: relative;
  display: inline-flex;
}
.lookup-clear-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--p-text-muted-color);
  padding: 0.25rem;
  display: flex;
  align-items: center;
  opacity: 0.6;
  transition: opacity 0.15s;
}
.lookup-clear-btn:hover {
  opacity: 1;
  color: var(--p-text-color);
}
/* Inline: before the dropdown arrow button (~37px wide) */
.lookup-clear-btn--inline {
  right: 2.5rem;
}
/* Picker: before the search addon (~40px wide) */
.lookup-clear-btn--picker {
  right: 2.75rem;
}
.lookup-search-addon {
  cursor: pointer;
}
.lookup-search-addon:hover {
  background-color: var(--p-surface-100);
}
</style>
