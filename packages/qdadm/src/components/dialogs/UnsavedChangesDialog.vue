<script setup lang="ts">
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

interface Props {
  visible?: boolean
  saving?: boolean
  message?: string
  hasOnSave?: boolean
}

withDefaults(defineProps<Props>(), {
  visible: false,
  saving: false,
  message: 'You have unsaved changes that will be lost.',
  hasOnSave: false
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saveAndLeave: []
  leave: []
  stay: []
}>()

function onStay(): void {
  emit('stay')
  emit('update:visible', false)
}

function onLeave(): void {
  emit('leave')
}

function onSaveAndLeave(): void {
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
