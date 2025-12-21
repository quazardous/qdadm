<script setup>
/**
 * UnsavedChangesDialog - Confirm leaving with unsaved changes
 *
 * Uses SimpleDialog with custom actions:
 * - Save & Leave (optional): saves then navigates
 * - Leave: discards changes and navigates
 * - Stay: cancels navigation
 */
import SimpleDialog from './SimpleDialog.vue'
import Button from 'primevue/button'

const props = defineProps({
  visible: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  message: { type: String, default: 'You have unsaved changes that will be lost.' },
  hasOnSave: { type: Boolean, default: false }
})

const emit = defineEmits(['update:visible', 'saveAndLeave', 'leave', 'stay'])

function onStay() {
  emit('stay')
  emit('update:visible', false)
}

function onLeave() {
  emit('leave')
}

function onSaveAndLeave() {
  emit('saveAndLeave')
}
</script>

<template>
  <SimpleDialog
    :visible="visible"
    title="Unsaved Changes"
    width="400px"
    :closable="false"
    :showCancel="true"
    :showConfirm="true"
    cancelLabel="Stay"
    confirmLabel="Leave"
    confirmSeverity="danger"
    :loading="saving"
    @cancel="onStay"
    @confirm="onLeave"
    @update:visible="$emit('update:visible', $event)"
  >
    <div class="dialog-content">
      <i class="pi pi-exclamation-triangle dialog-icon"></i>
      <p>{{ message }}</p>
    </div>

    <template #actions>
      <Button
        v-if="hasOnSave"
        label="Save & Leave"
        icon="pi pi-save"
        severity="success"
        :loading="saving"
        @click="onSaveAndLeave"
      />
    </template>
  </SimpleDialog>
</template>

<style scoped>
.dialog-content {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.dialog-icon {
  font-size: 2rem;
  color: var(--p-orange-500);
  flex-shrink: 0;
}

.dialog-content p {
  margin: 0;
  line-height: 1.5;
}
</style>
