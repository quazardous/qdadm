<script setup lang="ts">
/** A checkbox control (#5445): a box and its label, linked */
import { useId } from 'vue'
import Checkbox from 'primevue/checkbox'
import type { RichDialogControl } from './types'

defineProps<{ control: RichDialogControl; modelValue?: unknown }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
const id = `qd-rich-control-${useId()}`
</script>

<template>
  <span class="qd-rich-control">
    <Checkbox :input-id="id" binary :model-value="!!modelValue" :aria-required="control.required ? 'true' : undefined" @update:model-value="emit('update:modelValue', !!$event)" />
    <label :for="id">{{ control.label }}</label>
  </span>
</template>
