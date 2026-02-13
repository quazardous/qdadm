<script setup lang="ts">
/**
 * FormActions - Reusable form action buttons
 *
 * Props:
 * - isEdit: Boolean - Edit mode (changes labels)
 * - saving: Boolean - Loading state
 * - dirty: Boolean - Form has unsaved changes
 *
 * Emits:
 * - save: Save and stay on form
 * - saveAndClose: Save and navigate back
 * - cancel: Cancel/close without saving
 */

import Button from 'primevue/button'

interface Props {
  isEdit?: boolean
  saving?: boolean
  dirty?: boolean
  showSaveAndClose?: boolean
}

withDefaults(defineProps<Props>(), {
  isEdit: false,
  saving: false,
  dirty: true,  // Default true for backwards compatibility
  showSaveAndClose: true
})

const emit = defineEmits<{
  'save': []
  'saveAndClose': []
  'cancel': []
}>()
</script>

<template>
  <div class="form-actions">
    <div class="form-actions-left">
      <Button
        type="button"
        :label="isEdit ? 'Update' : 'Create'"
        :loading="saving"
        :disabled="!dirty || saving"
        icon="pi pi-check"
        @click="emit('save')"
        v-tooltip.top="'Save and continue editing'"
      />
      <Button
        v-if="showSaveAndClose"
        type="button"
        :label="isEdit ? 'Update & Close' : 'Create & Close'"
        :loading="saving"
        :disabled="!dirty || saving"
        icon="pi pi-check-circle"
        severity="success"
        @click="emit('saveAndClose')"
        v-tooltip.top="'Save and return to list'"
      />
      <span v-if="dirty" class="dirty-indicator" v-tooltip.top="'Unsaved changes'">
        <i class="pi pi-circle-fill"></i>
      </span>
    </div>
    <Button
      type="button"
      label="Cancel"
      severity="secondary"
      icon="pi pi-times"
      @click="emit('cancel')"
      :disabled="saving"
    />
  </div>
</template>
