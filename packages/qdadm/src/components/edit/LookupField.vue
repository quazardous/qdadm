<script setup lang="ts">
/**
 * LookupField - Unified lookup input with two UI modes
 *
 * Wraps useOptionsLookup into a ready-to-use form field component.
 *
 * Modes (pickerMode):
 * - **inline** (default): PrimeVue AutoComplete with dropdown button.
 * - **picker**: Readonly input + search button → modal DataTable.
 *
 * Supports both single and multiple selection (multiple prop).
 *
 * Usage:
 * ```vue
 * <!-- Single inline -->
 * <LookupField v-model="form.data.value.bookId" :lookup="bookLookup" />
 *
 * <!-- Single picker -->
 * <LookupField v-model="bookId" :lookup="bookLookup" pickerMode="picker"
 *   :pickerColumns="['title', 'author']" pickerTitle="Select a Book" />
 *
 * <!-- Multi inline (chips) -->
 * <LookupField v-model="conditions.tags" :lookup="tagLookup" multiple />
 *
 * <!-- Multi picker (checkboxes) -->
 * <LookupField v-model="conditions.geoCountry" :lookup="geoLookup"
 *   multiple pickerMode="picker" :pickerColumns="['code', 'name']" />
 * ```
 */
import { ref, computed, watch, type PropType } from 'vue'
import AutoComplete from 'primevue/autocomplete'
import InputText from 'primevue/inputtext'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import Chip from 'primevue/chip'
import LookupPickerDialog from './LookupPickerDialog.vue'
import type { UseOptionsLookupReturn } from '../../composables/useOptionsLookup'
import type { LookupColumn } from './LookupPickerDialog.vue'

type PickerMode = 'inline' | 'picker'

const props = defineProps({
  /** v-model: raw value (single) or array of raw values (multiple) */
  modelValue: { type: [String, Number, Array, null] as PropType<unknown>, default: null },
  /** useOptionsLookup return object */
  lookup: { type: Object as PropType<UseOptionsLookupReturn>, required: true },
  /** UI mode */
  pickerMode: { type: String as PropType<PickerMode>, default: 'inline' },
  /** Allow multiple selection */
  multiple: { type: Boolean, default: false },
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

// ═══════════════════════════════════════════════════════
// SINGLE MODE
// ═══════════════════════════════════════════════════════

// Display string for single inline autocomplete
const displayValue = ref('')

watch(() => props.modelValue, (val) => {
  if (props.multiple) return
  if (val != null && val !== '') {
    displayValue.value = props.lookup.resolve(val)
  } else {
    displayValue.value = ''
  }
}, { immediate: true })

watch(() => props.lookup.options.value.length, () => {
  if (props.multiple) return
  if (props.modelValue != null && props.modelValue !== '') {
    displayValue.value = props.lookup.resolve(props.modelValue)
  }
})

function onInlineSelect(_event: { value: string }): void {
  const raw = props.lookup.decode(displayValue.value)
  emit('update:modelValue', raw)
}

function onInlineBlur(): void {
  if (displayValue.value) {
    emit('update:modelValue', props.lookup.decode(displayValue.value))
  } else {
    emit('update:modelValue', null)
  }
}

// Single picker display
const pickerDisplayLabel = computed(() => {
  if (props.multiple) return ''
  if (props.modelValue == null || props.modelValue === '') return ''
  return props.lookup.resolve(props.modelValue)
})

function onPickerSelect(item: Record<string, unknown>): void {
  const vf = guessValueField()
  emit('update:modelValue', item[vf] ?? item.value ?? item.id)
}

// ═══════════════════════════════════════════════════════
// MULTI MODE
// ═══════════════════════════════════════════════════════

const multiValues = computed(() => {
  if (!props.multiple) return []
  return Array.isArray(props.modelValue) ? props.modelValue : []
})

// Inline multi: chips as encoded strings
const multiChips = ref<string[]>([])

watch(() => props.modelValue, (val) => {
  if (!props.multiple) return
  const arr = Array.isArray(val) ? val : []
  multiChips.value = arr.map((v) => props.lookup.resolve(v))
}, { immediate: true })

watch(() => props.lookup.options.value.length, () => {
  if (!props.multiple) return
  const arr = Array.isArray(props.modelValue) ? props.modelValue : []
  if (arr.length > 0) {
    multiChips.value = arr.map((v) => props.lookup.resolve(v))
  }
})

function onMultiChipsUpdate(chips: string[]): void {
  emit('update:modelValue', chips.map((c) => props.lookup.decode(c)))
}

function onMultiInlineSelect(): void {
  emit('update:modelValue', multiChips.value.map((c) => props.lookup.decode(c)))
}

// Picker multi: chips display
const multiPickerChips = computed(() =>
  multiValues.value.map((v) => ({ raw: v, label: props.lookup.resolve(v) })),
)

function removeMultiChip(rawValue: unknown): void {
  const updated = multiValues.value.filter((v) => String(v) !== String(rawValue))
  emit('update:modelValue', updated)
}

function onPickerSelectMultiple(items: Record<string, unknown>[]): void {
  const vf = guessValueField()
  emit('update:modelValue', items.map((item) => item[vf] ?? item.value ?? item.id))
}

// ═══════════════════════════════════════════════════════
// SHARED
// ═══════════════════════════════════════════════════════

const pickerVisible = ref(false)

const resolvedPickerColumns = computed(() => {
  if (props.pickerColumns.length > 0) return props.pickerColumns
  const firstRaw = props.lookup.raw.value[0]
  if (firstRaw && typeof firstRaw === 'object') {
    return Object.keys(firstRaw as Record<string, unknown>).slice(0, 4)
  }
  return ['name', 'id']
})

function guessValueField(): string {
  const firstOpt = props.lookup.options.value[0]
  if (!firstOpt) return 'id'
  const firstRaw = props.lookup.raw.value[0] as Record<string, unknown> | undefined
  if (firstRaw) {
    for (const [key, val] of Object.entries(firstRaw)) {
      if (val === firstOpt.value) return key
    }
  }
  return 'id'
}

function openPicker(): void {
  if (!props.disabled) pickerVisible.value = true
}

const hasValue = computed(() => {
  if (props.multiple) return multiValues.value.length > 0
  return props.modelValue != null && props.modelValue !== ''
})

function clearValue(): void {
  emit('update:modelValue', props.multiple ? [] : null)
  displayValue.value = ''
  multiChips.value = []
}
</script>

<template>
  <!-- ════════════ SINGLE INLINE ════════════ -->
  <span v-if="!multiple && pickerMode === 'inline'" class="lookup-field-inline" :class="props.class || 'w-full'">
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

  <!-- ════════════ SINGLE PICKER ════════════ -->
  <span v-else-if="!multiple && pickerMode === 'picker'" :class="props.class || 'w-full'" class="lookup-field-picker">
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

  <!-- ════════════ MULTI INLINE (chips autocomplete) ════════════ -->
  <span v-else-if="multiple && pickerMode === 'inline'" class="lookup-field-inline" :class="props.class || 'w-full'">
    <AutoComplete
      v-model="multiChips"
      :suggestions="lookup.suggestions.value"
      @complete="lookup.search($event.query)"
      @item-select="onMultiInlineSelect"
      @update:modelValue="onMultiChipsUpdate"
      :loading="lookup.loading.value"
      :disabled="disabled"
      :placeholder="!hasValue ? placeholder : ''"
      multiple
      class="w-full"
    />
    <button
      v-if="hasValue && !disabled"
      type="button"
      class="lookup-clear-btn lookup-clear-btn--multi-inline"
      @click="clearValue"
      tabindex="-1"
    >
      <i class="pi pi-times" />
    </button>
  </span>

  <!-- ════════════ MULTI PICKER (chips + search dialog) ════════════ -->
  <span v-else :class="props.class || 'w-full'" class="lookup-field-picker">
    <InputGroup>
      <div class="lookup-multi-chips" @click="openPicker">
        <template v-if="multiPickerChips.length > 0">
          <Chip
            v-for="chip in multiPickerChips"
            :key="String(chip.raw)"
            :label="chip.label"
            removable
            @remove="removeMultiChip(chip.raw)"
            @click.stop
          />
        </template>
        <span v-else class="lookup-multi-placeholder">
          {{ placeholder || 'Click search to select...' }}
        </span>
      </div>
      <InputGroupAddon class="lookup-search-addon" @click="openPicker">
        <i v-if="lookup.loading.value" class="pi pi-spinner pi-spin" />
        <i v-else class="pi pi-search" />
      </InputGroupAddon>
    </InputGroup>

    <LookupPickerDialog
      v-model:visible="pickerVisible"
      :title="pickerTitle"
      :items="(lookup.raw.value as Record<string, unknown>[])"
      :columns="resolvedPickerColumns"
      :loading="lookup.loading.value"
      :currentValue="modelValue"
      :valueField="guessValueField()"
      :width="pickerWidth"
      multiple
      @select-multiple="onPickerSelectMultiple"
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
/* Single inline: before the dropdown arrow button */
.lookup-clear-btn--inline {
  right: 2.5rem;
}
/* Single picker: before the search addon */
.lookup-clear-btn--picker {
  right: 2.75rem;
}
/* Multi inline: top-right corner */
.lookup-clear-btn--multi-inline {
  right: 0.5rem;
  top: 0.25rem;
  transform: none;
}
/* Chips container for multi picker */
.lookup-multi-chips {
  flex: 1 1 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
  padding: 0.375rem 0.5rem;
  min-height: 2.5rem;
  cursor: pointer;
  border: 1px solid var(--p-inputtext-border-color);
  border-right: none;
  border-radius: var(--p-inputtext-border-radius) 0 0 var(--p-inputtext-border-radius);
  background: var(--p-inputtext-background);
  transition: border-color 0.15s;
}
.lookup-multi-chips:hover {
  border-color: var(--p-inputtext-hover-border-color);
}
.lookup-multi-placeholder {
  color: var(--p-inputtext-placeholder-color);
  font-size: 0.875rem;
}
.lookup-search-addon {
  cursor: pointer;
}
.lookup-search-addon:hover {
  background-color: var(--p-surface-100);
}
</style>
