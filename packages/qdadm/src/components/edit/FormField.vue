<script setup lang="ts">
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
 *
 * The label names the control inside (#2268): FormInput binds the field's id, any other control takes it after
 * render, and the slot receives `inputId` and `labelId` for controls that need them.
 */
import { inject, computed, provide, ref, useId, onMounted, onUpdated, type Ref, type CSSProperties } from 'vue'
import { FORM_FIELD_IDS } from './formFieldIds'

interface Props {
  name: string
  label?: string
  hint?: string
  fullWidth?: boolean
  /** Override error message (useful for custom validation) */
  error?: string | null
  /** Show error only after form submission */
  showErrorOnSubmit?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  hint: '',
  fullWidth: false,
  error: null,
  showErrorOnSubmit: false
})

// Inject from parent form (provided by useEntityItemFormPage)
const isFieldDirty = inject<(name: string) => boolean>('isFieldDirty', () => false)
const getFieldError = inject<(name: string) => string | null>('getFieldError', () => null)
const handleFieldBlur = inject<(name: string) => void>('handleFieldBlur', () => {})
const formSubmitted = inject<Ref<boolean>>('formSubmitted', { value: false } as Ref<boolean>)

const isDirty = computed((): boolean => isFieldDirty(props.name))

// Get error from prop or from form validation
const fieldError = computed((): string | null => {
  if (props.error) return props.error
  return getFieldError(props.name)
})

// Show error if: form submitted OR field was touched (validated on blur)
const showError = computed((): boolean => {
  if (!fieldError.value) return false
  if (props.showErrorOnSubmit) return formSubmitted.value
  return true
})

const fieldClasses = computed((): (string | Record<string, boolean>)[] => [
  'form-field',
  {
    'field-dirty': isDirty.value,
    'field-invalid': showError.value
  }
])

const fieldStyle = computed((): CSSProperties =>
  props.fullWidth ? { gridColumn: '1 / -1' } : {}
)

function onBlur(): void {
  handleFieldBlur(props.name)
}

// ─── The label names the control (#2268) ─────────────────────────────────────

// Unique to this field instance: two forms on one page do not share ids.
const uid = useId()
const inputId = computed((): string => `${uid}-${props.name.replace(/[^\w-]/g, '-')}`)
const labelId = computed((): string => `${inputId.value}-label`)
const slotLabelId = computed((): string | undefined => (props.label ? labelId.value : undefined))
provide(FORM_FIELD_IDS, { inputId, labelId: slotLabelId })

const root = ref<HTMLElement | null>(null)
/** The control's own id, when it has one: the label points there instead. */
const ownControlId = ref<string | null>(null)
const labelFor = computed((): string => ownControlId.value ?? inputId.value)

const CONTROLS =
  'input:not([type="hidden"]), select, textarea, button, [role="combobox"], [role="checkbox"], [role="switch"], ' +
  '[role="spinbutton"], [role="textbox"], [role="slider"], [contenteditable="true"]'
const LABELABLE = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'METER', 'OUTPUT', 'PROGRESS'])

/**
 * A control FormInput did not render (a widget put directly in the slot) takes the field's id; one with an id of its
 * own keeps it and the label follows. An element `<label for>` cannot name gets aria-labelledby.
 */
function tieLabel(): void {
  const el = root.value
  if (!el || !props.label) return
  // Array.from, not a spread: a consumer's tsconfig may lack DOM.Iterable.
  const controls = Array.from(el.querySelectorAll<HTMLElement>(CONTROLS))
  let control = controls.find((c) => c.id === labelFor.value)
  if (!control) {
    control = controls[0]
    if (!control) return
    if (!control.id) control.id = inputId.value
    const target = control.id === inputId.value ? null : control.id
    if (ownControlId.value !== target) ownControlId.value = target
  }
  if (!LABELABLE.has(control.tagName) && !control.hasAttribute('aria-labelledby') && !control.hasAttribute('aria-label')) {
    control.setAttribute('aria-labelledby', labelId.value)
  }
}
onMounted(tieLabel)
onUpdated(tieLabel)
</script>

<template>
  <div ref="root" :class="fieldClasses" :style="fieldStyle">
    <label v-if="label" :id="labelId" :for="labelFor">{{ label }}</label>
    <slot :onBlur="onBlur" :inputId="inputId" :labelId="slotLabelId"></slot>
    <small v-if="showError" class="field-error">{{ fieldError }}</small>
    <small v-else-if="hint" class="field-hint">{{ hint }}</small>
  </div>
</template>
