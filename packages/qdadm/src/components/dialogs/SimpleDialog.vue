<script setup>
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
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, required: true },
  width: { type: String, default: '500px' },

  // Footer buttons
  showCancel: { type: Boolean, default: true },
  showConfirm: { type: Boolean, default: true },
  cancelLabel: { type: String, default: 'Cancel' },
  confirmLabel: { type: String, default: 'Confirm' },
  confirmIcon: { type: String, default: null },
  confirmSeverity: { type: String, default: null },
  confirmDisabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },

  // Dialog behavior
  closable: { type: Boolean, default: true },
  dismissableMask: { type: Boolean, default: false }
})

const emit = defineEmits(['update:visible', 'confirm', 'cancel'])

function onCancel() {
  emit('cancel')
  emit('update:visible', false)
}

function onConfirm() {
  emit('confirm')
}

// Allow closing via escape/mask only when not loading
const canClose = computed(() => props.closable && !props.loading)
</script>

<script>
import { computed } from 'vue'
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
