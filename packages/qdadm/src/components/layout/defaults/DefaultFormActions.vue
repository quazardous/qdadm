<script setup lang="ts">
/**
 * DefaultFormActions - Default component for the form actions zone
 *
 * Renders save/cancel buttons with loading states, using the form state
 * provided by FormLayout via Vue injection.
 *
 * This component is rendered by Zone when no blocks are registered
 * in the 'actions' zone and no slot override is provided.
 *
 * Uses FormActions component for consistent button rendering.
 *
 * Inject:
 * - qdadmFormState: { loading, saving, dirty, isEdit }
 * - qdadmFormEmit: { save, saveAndClose, cancel, delete }
 */
import { inject, computed, type Ref } from 'vue'
import FormActions from '../../forms/FormActions.vue'

interface FormState {
  isEdit?: boolean
  saving?: boolean
  dirty?: boolean
  loading?: boolean
}

interface FormEmit {
  save: () => void
  saveAndClose: () => void
  cancel: () => void
  delete?: () => void
}

// Inject form state from FormLayout
const formState = inject<Ref<FormState> | null>('qdadmFormState', null)
const formEmit = inject<FormEmit | null>('qdadmFormEmit', null)

// Fallback values if not injected (for standalone testing)
const isEdit = computed(() => formState?.value?.isEdit ?? false)
const saving = computed(() => formState?.value?.saving ?? false)
const dirty = computed(() => formState?.value?.dirty ?? true)

// Event handlers
function onSave(): void {
  formEmit?.save()
}

function onSaveAndClose(): void {
  formEmit?.saveAndClose()
}

function onCancel(): void {
  formEmit?.cancel()
}
</script>

<template>
  <FormActions
    :isEdit="isEdit"
    :saving="saving"
    :dirty="dirty"
    :showSaveAndClose="true"
    @save="onSave"
    @saveAndClose="onSaveAndClose"
    @cancel="onCancel"
  />
</template>
