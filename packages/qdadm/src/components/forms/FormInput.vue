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
import { computed, type PropType } from 'vue'
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
  type?: InputType
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  options?: SelectOption[]
  optionLabel?: string
  optionValue?: string
}

const props = defineProps({
  field: { type: Object as PropType<FieldConfig>, required: true },
  modelValue: { type: [String, Number, Boolean, Date, Object] as PropType<ModelValue>, default: null },
  hint: { type: String as () => InputType | null, default: null }  // Optional type hint override
})

const emit = defineEmits<{
  'update:modelValue': [value: ModelValue]
}>()

const value = computed<ModelValue>({
  get: (): ModelValue => props.modelValue,
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
  get: (): boolean => (props.modelValue as boolean) ?? false,
  set: (v: boolean): void => emit('update:modelValue', v)
})

// Resolve component type: field.type > hint > 'text'
const inputType = computed<InputType>(() => props.field?.type || props.hint || 'text')

// Date value with string ↔ Date conversion for DatePicker
const dateValue = computed<Date | null>({
  get: (): Date | null => {
    const v = props.modelValue
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
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :readonly="field.readonly"
    class="w-full"
  />
  <Password
    v-else-if="inputType === 'password'"
    v-model="stringValue"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :feedback="false"
    toggleMask
    class="w-full"
  />
  <InputNumber
    v-else-if="inputType === 'number'"
    v-model="numberValue"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :readonly="field.readonly"
    :useGrouping="false"
    class="w-full"
  />
  <Textarea
    v-else-if="inputType === 'textarea'"
    v-model="stringValue"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :readonly="field.readonly"
    rows="3"
    class="w-full"
  />
  <Select
    v-else-if="inputType === 'select'"
    v-model="value"
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
    :disabled="field.disabled"
    binary
  />
  <DatePicker
    v-else-if="inputType === 'date' || inputType === 'datetime'"
    v-model="dateValue"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :showTime="inputType === 'datetime'"
    class="w-full"
  />
  <!-- Fallback to text -->
  <InputText
    v-else
    v-model="stringValue"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    class="w-full"
  />
</template>
