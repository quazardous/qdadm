<script setup>
/**
 * FormInput - Auto-renders the appropriate input based on field config
 *
 * Takes a field config object and renders the matching PrimeVue component.
 * Supports hint override but field.type takes precedence if specified.
 *
 * Usage:
 * <FormInput :field="f" v-model="form.data.value[f.name]" />
 */
import { computed } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import Password from 'primevue/password'
import DatePicker from 'primevue/datepicker'

const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { default: null },
  hint: { type: String, default: null }  // Optional type hint override
})

const emit = defineEmits(['update:modelValue'])

const value = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

// Resolve component type: field.type > hint > 'text'
const inputType = computed(() => props.field.type || props.hint || 'text')
</script>

<template>
  <InputText
    v-if="inputType === 'text' || inputType === 'email'"
    v-model="value"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :readonly="field.readonly"
    class="w-full"
  />
  <Password
    v-else-if="inputType === 'password'"
    v-model="value"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :feedback="false"
    toggleMask
    class="w-full"
  />
  <InputNumber
    v-else-if="inputType === 'number'"
    v-model="value"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :readonly="field.readonly"
    :useGrouping="false"
    class="w-full"
  />
  <Textarea
    v-else-if="inputType === 'textarea'"
    v-model="value"
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
    v-model="value"
    :disabled="field.disabled"
    binary
  />
  <DatePicker
    v-else-if="inputType === 'date' || inputType === 'datetime'"
    v-model="value"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :showTime="inputType === 'datetime'"
    class="w-full"
  />
  <!-- Fallback to text -->
  <InputText
    v-else
    v-model="value"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    class="w-full"
  />
</template>
