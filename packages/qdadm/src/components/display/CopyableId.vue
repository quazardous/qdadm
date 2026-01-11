<script setup>
/**
 * CopyableId - Read-only ID field with copy-to-clipboard functionality
 *
 * Usage:
 *   <CopyableId :value="entityId" label="ID" />
 *   <CopyableId :value="apiKey" label="API Key" />
 */
import { ref, inject } from 'vue'
import Button from 'primevue/button'

const props = defineProps({
  value: {
    type: String,
    required: true
  },
  label: {
    type: String,
    default: 'ID'
  }
})

const orchestrator = inject('qdadmOrchestrator', null)
const copied = ref(false)

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(props.value)
    copied.value = true
    orchestrator?.toast.success('Copied', `${props.label} copied to clipboard`, 'CopyableId')
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    orchestrator?.toast.error('Error', 'Failed to copy to clipboard', 'CopyableId')
  }
}
</script>

<template>
  <div class="form-field">
    <label class="form-field-label">{{ label }}</label>
    <div class="copyable-id">
      <Button
        type="button"
        :icon="copied ? 'pi pi-check' : 'pi pi-copy'"
        :severity="copied ? 'success' : 'secondary'"
        size="small"
        text
        rounded
        @click="copyToClipboard"
        :aria-label="`Copy ${label}`"
        class="copyable-id-button"
      />
      <code class="copyable-id-value">{{ value }}</code>
    </div>
  </div>
</template>

<style scoped>
.copyable-id {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--p-surface-100);
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  max-width: 100%;
}

.copyable-id-value {
  font-family: monospace;
  font-size: 0.875rem;
  color: var(--p-surface-700);
  word-break: break-all;
}

.copyable-id-button {
  flex-shrink: 0;
}
</style>
