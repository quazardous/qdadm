<script setup lang="ts">
/**
 * The JSON face of StructuredField (#5333), on VanillaJsonEditor.
 * Registered by '@quazardous/qdadm/editors/json'.
 */
import VanillaJsonEditor from '../VanillaJsonEditor.vue'

withDefaults(
  defineProps<{
    modelValue?: unknown
    height?: string
    options?: { mode?: 'tree' | 'text' | 'table' }
  }>(),
  { height: '400px', options: () => ({}) }
)

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
  invalid: [invalid: boolean]
}>()

function onUpdate(value: unknown): void {
  // The editor reports only valid JSON here
  emit('invalid', false)
  emit('update:modelValue', value)
}
</script>

<template>
  <VanillaJsonEditor
    :modelValue="modelValue as never"
    :mode="(options.mode ?? 'text') as never"
    :height="height"
    @update:modelValue="onUpdate"
    @error="emit('invalid', true)"
  />
</template>
