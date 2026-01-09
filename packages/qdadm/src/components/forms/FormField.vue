<script setup>
/**
 * FormField - Wrapper for form fields with automatic dirty state and error display
 *
 * Usage:
 * <FormField name="username" label="Username *">
 *   <InputText v-model="form.username" />
 * </FormField>
 *
 * The parent form (useEntityItemFormPage) provides:
 * - isFieldDirty: function to check if field is dirty
 * - getFieldError: function to get field error message
 * - handleFieldBlur: function to trigger validation on blur
 * - formSubmitted: ref indicating if form was submitted
 */
import { inject, computed } from 'vue'

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  label: {
    type: String,
    default: ''
  },
  hint: {
    type: String,
    default: ''
  },
  fullWidth: {
    type: Boolean,
    default: false
  },
  /** Override error message (useful for custom validation) */
  error: {
    type: String,
    default: null
  },
  /** Show error only after form submission */
  showErrorOnSubmit: {
    type: Boolean,
    default: false
  }
})

// Inject from parent form (provided by useEntityItemFormPage)
const isFieldDirty = inject('isFieldDirty', () => false)
const getFieldError = inject('getFieldError', () => null)
const handleFieldBlur = inject('handleFieldBlur', () => {})
const formSubmitted = inject('formSubmitted', { value: false })

const isDirty = computed(() => isFieldDirty(props.name))

// Get error from prop or from form validation
const fieldError = computed(() => {
  if (props.error) return props.error
  return getFieldError(props.name)
})

// Show error if: form submitted OR field was touched (validated on blur)
const showError = computed(() => {
  if (!fieldError.value) return false
  if (props.showErrorOnSubmit) return formSubmitted.value
  return true
})

const fieldClasses = computed(() => [
  'form-field',
  {
    'field-dirty': isDirty.value,
    'field-invalid': showError.value
  }
])

const fieldStyle = computed(() =>
  props.fullWidth ? { gridColumn: '1 / -1' } : {}
)

function onBlur() {
  handleFieldBlur(props.name)
}
</script>

<template>
  <div :class="fieldClasses" :style="fieldStyle">
    <label v-if="label" :for="name">{{ label }}</label>
    <slot :onBlur="onBlur"></slot>
    <small v-if="showError" class="field-error">{{ fieldError }}</small>
    <small v-else-if="hint" class="field-hint">{{ hint }}</small>
  </div>
</template>

<style scoped>
/* .field-hint and .field-error are global (main.css) */

.field-invalid :deep(input),
.field-invalid :deep(textarea),
.field-invalid :deep(.p-inputtext),
.field-invalid :deep(.p-select),
.field-invalid :deep(.p-dropdown) {
  border-color: var(--p-red-500);
}

.field-invalid :deep(input:focus),
.field-invalid :deep(textarea:focus),
.field-invalid :deep(.p-inputtext:focus),
.field-invalid :deep(.p-select:focus),
.field-invalid :deep(.p-dropdown:focus) {
  box-shadow: 0 0 0 1px var(--p-red-500);
}
</style>
