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

import QdButton from '../base/QdButton.vue'
import { useI18n } from '../../i18n/useI18n'

const { t } = useI18n()

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
      <QdButton
        type="button"
        :label="isEdit ? t('core.actions.update') : t('core.actions.create')"
        :loading="saving"
        :disabled="!dirty || saving"
        icon="pi pi-check"
        @click="emit('save')"
        v-tooltip.top="t('core.tooltips.saveAndContinue')"
      />
      <QdButton
        v-if="showSaveAndClose"
        type="button"
        :label="isEdit ? t('core.actions.updateAndClose') : t('core.actions.createAndClose')"
        :loading="saving"
        :disabled="!dirty || saving"
        icon="pi pi-check-circle"
        severity="success"
        @click="emit('saveAndClose')"
        v-tooltip.top="t('core.tooltips.saveAndReturn')"
      />
      <span v-if="dirty" class="dirty-indicator" v-tooltip.top="t('core.tooltips.unsavedChanges')">
        <i class="pi pi-circle-fill"></i>
      </span>
    </div>
    <QdButton
      type="button"
      :label="t('core.actions.cancel')"
      severity="secondary"
      icon="pi pi-times"
      @click="emit('cancel')"
      :disabled="saving"
    />
  </div>
</template>
