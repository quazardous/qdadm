<script setup lang="ts">
/**
 * SimpleDialog - Wrapper for common dialog patterns
 *
 * Simplifies the most common dialog use case:
 * - Modal with title
 * - Content slot
 * - Cancel/Confirm footer buttons
 *
 * Usage:
 *   <SimpleDialog
 *     v-model:visible="showDialog"
 *     title="Confirm Action"
 *     :loading="saving"
 *     @confirm="onSave"
 *   >
 *     <p>Are you sure?</p>
 *   </SimpleDialog>
 *
 * For read-only dialogs (no confirm button):
 *   <SimpleDialog v-model:visible="showDialog" title="View" :showConfirm="false">
 *     <p>Content here</p>
 *   </SimpleDialog>
 *
 * For dialogs with extra action buttons:
 *   <SimpleDialog v-model:visible="showDialog" title="View Key" :showConfirm="false">
 *     <p>{{ key }}</p>
 *     <template #actions>
 *       <Button label="Copy" icon="pi pi-copy" @click="copyKey" />
 *     </template>
 *   </SimpleDialog>
 */
import { computed } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'

interface Props {
  visible?: boolean
  title: string
  width?: string
  // Footer buttons
  showCancel?: boolean
  showConfirm?: boolean
  cancelLabel?: string
  confirmLabel?: string
  confirmIcon?: string
  confirmSeverity?: string
  confirmDisabled?: boolean
  loading?: boolean
  // Dialog behavior
  closable?: boolean
  dismissableMask?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  width: '500px',
  showCancel: true,
  showConfirm: true,
  cancelLabel: 'Cancel',
  confirmLabel: 'Confirm',
  confirmIcon: undefined,
  confirmSeverity: undefined,
  confirmDisabled: false,
  loading: false,
  closable: true,
  dismissableMask: false
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'confirm': []
  'cancel': []
}>()

function onCancel(): void {
  emit('cancel')
  emit('update:visible', false)
}

function onConfirm(): void {
  emit('confirm')
}

// Allow closing via escape/mask only when not loading
const canClose = computed((): boolean => props.closable && !props.loading)
</script>

<template>
  <Dialog
    :visible="visible"
    :header="title"
    :modal="true"
    :style="{ width }"
    :closable="canClose"
    :closeOnEscape="canClose"
    :dismissableMask="dismissableMask && canClose"
    @update:visible="$emit('update:visible', $event)"
  >
    <slot />

    <template #footer v-if="showCancel || showConfirm || $slots.actions">
      <slot name="actions" />
      <Button
        v-if="showCancel"
        :label="cancelLabel"
        severity="secondary"
        @click="onCancel"
        :disabled="loading"
      />
      <Button
        v-if="showConfirm"
        :label="confirmLabel"
        :icon="confirmIcon"
        :severity="confirmSeverity"
        :loading="loading"
        :disabled="confirmDisabled"
        @click="onConfirm"
      />
    </template>
  </Dialog>
</template>
