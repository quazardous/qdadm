<script setup>
/**
 * FormField - Wrapper for form fields with automatic dirty state styling
 *
 * Usage:
 * <FormField name="username" label="Username *">
 *   <InputText v-model="form.username" />
 * </FormField>
 *
 * The parent form must provide isFieldDirty via useForm's provideFormContext()
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
  }
})

// Inject isFieldDirty from parent form (provided by useForm)
const isFieldDirty = inject('isFieldDirty', () => false)

const isDirty = computed(() => isFieldDirty(props.name))

const fieldClasses = computed(() => [
  'form-field',
  {
    'field-dirty': isDirty.value
  }
])

const fieldStyle = computed(() =>
  props.fullWidth ? { gridColumn: '1 / -1' } : {}
)
</script>

<template>
  <div :class="fieldClasses" :style="fieldStyle">
    <label v-if="label" :for="name">{{ label }}</label>
    <slot ></slot>
    <small v-if="hint" class="field-hint">{{ hint }}</small>
  </div>
</template>

<style scoped>
.field-hint {
  color: var(--p-surface-500);
  margin-top: 0.25rem;
  display: block;
}
</style>
