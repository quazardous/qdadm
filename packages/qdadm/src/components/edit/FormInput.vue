<script setup lang="ts">
/**
 * FormInput - Auto-renders the appropriate input based on field config
 *
 * Takes a field config object and renders the matching PrimeVue component.
 * Supports hint override but field.type takes precedence if specified.
 *
 * Usage:
 * <FormInput :field="f" v-model="form.data.value[f.name]" />
 */
import { computed, inject, type PropType } from 'vue'
import { FORM_FIELD_IDS } from './formFieldIds'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import Password from 'primevue/password'
import DatePicker from 'primevue/datepicker'

type InputType = 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'boolean' | 'date' | 'datetime'
type ModelValue = string | number | boolean | Date | null

interface SelectOption {
  label?: string
  value?: string | number
  [key: string]: unknown
}

interface FieldConfig {
  name: string
  /** Known widget types get dedicated rendering; other strings (e.g. from
   *  ResolvedFieldConfig, #1387) fall back to the text input. */
  type?: InputType | (string & {})
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  options?: SelectOption[] | unknown[]
  optionLabel?: string
  optionValue?: string
  /** number: digits after the decimal point — `2`, or `{ min, max }` (#2316) */
  fractionDigits?: number | { min?: number; max?: number }
  /** number: bounds and increment (#2316) */
  min?: number
  max?: number
  step?: number
}

const props = defineProps({
  field: { type: Object as PropType<FieldConfig>, required: true },
  // unknown: v-model over Record<string, unknown> indexes (the documented
  // generateFields loop) must bind without casts (#1387)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelValue: { type: null as unknown as PropType<any>, default: null },
  hint: { type: String as () => InputType | null, default: null },  // Optional type hint override
  /** The control's id. Inside a FormField it defaults to the id the field's label points at (#2268). */
  inputId: { type: String as PropType<string | null>, default: null }
})

// Inside a FormField, its label names this control (#2268): each PrimeVue control takes the id with its own prop.
const fieldIds = inject(FORM_FIELD_IDS, null)
const controlId = computed<string | undefined>(() => props.inputId ?? fieldIds?.inputId.value ?? undefined)
const labelledBy = computed<string | undefined>(() => fieldIds?.labelId.value)

const emit = defineEmits<{
  'update:modelValue': [value: ModelValue]
}>()

const value = computed<ModelValue>({
  get: (): ModelValue => (props.modelValue ?? null) as ModelValue,
  set: (v: ModelValue): void => emit('update:modelValue', v)
})

// Type-specific computed values for PrimeVue components
const stringValue = computed<string | null>({
  get: (): string | null => (props.modelValue as string | null) ?? null,
  set: (v: string | null): void => emit('update:modelValue', v)
})

const numberValue = computed<number | null>({
  get: (): number | null => (props.modelValue as number | null) ?? null,
  set: (v: number | null): void => emit('update:modelValue', v)
})

const booleanValue = computed<boolean>({
  get: (): boolean => (props.modelValue as boolean | null | undefined) ?? false,
  set: (v: boolean): void => emit('update:modelValue', v)
})

/**
 * Digits after the decimal point in a number field (#2316): `fractionDigits: 2`, or `{ min, max }`. Without it
 * InputNumber refuses the decimal key, so none is set by default: whole numbers, as before.
 */
const fraction = computed<{ min?: number; max?: number }>(() => {
  const digits = props.field?.fractionDigits as number | { min?: number; max?: number } | undefined
  if (typeof digits === 'number') return { min: digits, max: digits }
  if (digits && typeof digits === 'object') {
    const min = digits.min ?? 0
    return { min, max: Math.max(min, digits.max ?? min) }
  }
  return {}
})

// Resolve component type: field.type > hint > 'text'
const inputType = computed<InputType>(() => (props.field?.type as InputType) || props.hint || 'text')

// Date value with string ↔ Date conversion for DatePicker
const dateValue = computed<Date | null>({
  get: (): Date | null => {
    const v = props.modelValue as string | Date | null
    if (!v) return null
    if (v instanceof Date) return v
    // Convert ISO string to Date
    return new Date(v as string)
  },
  set: (v: Date | null): void => {
    // Convert Date back to ISO string for storage
    emit('update:modelValue', v ? v.toISOString() : null)
  }
})
</script>

<template>
  <InputText
    v-if="inputType === 'text' || inputType === 'email'"
    v-model="stringValue"
    :id="controlId"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :readonly="field.readonly"
    class="w-full"
  />
  <Password
    v-else-if="inputType === 'password'"
    v-model="stringValue"
    :inputId="controlId"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :feedback="false"
    toggleMask
    class="w-full"
  />
  <InputNumber
    v-else-if="inputType === 'number'"
    v-model="numberValue"
    :inputId="controlId"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :readonly="field.readonly"
    :useGrouping="false"
    :minFractionDigits="fraction.min"
    :maxFractionDigits="fraction.max"
    :min="field.min"
    :max="field.max"
    :step="field.step"
    class="w-full"
  />
  <Textarea
    v-else-if="inputType === 'textarea'"
    v-model="stringValue"
    :id="controlId"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :readonly="field.readonly"
    rows="3"
    class="w-full"
  />
  <Select
    v-else-if="inputType === 'select'"
    v-model="value"
    :labelId="controlId"
    :ariaLabelledby="labelledBy"
    :options="field.options"
    :optionLabel="field.optionLabel"
    :optionValue="field.optionValue"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    class="w-full"
  />
  <Checkbox
    v-else-if="inputType === 'boolean'"
    v-model="booleanValue"
    :inputId="controlId"
    :disabled="field.disabled"
    binary
  />
  <DatePicker
    v-else-if="inputType === 'date' || inputType === 'datetime'"
    v-model="dateValue"
    :inputId="controlId"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :showTime="inputType === 'datetime'"
    class="w-full"
  />
  <!-- Fallback to text -->
  <InputText
    v-else
    v-model="stringValue"
    :id="controlId"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    class="w-full"
  />
</template>
