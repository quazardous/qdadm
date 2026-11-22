<script setup lang="ts">
/** A toggle control (#5445): a switch and its label, linked */
import { useId } from 'vue'
import ToggleSwitch from 'primevue/toggleswitch'
import type { RichDialogControl } from './types'

defineProps<{ control: RichDialogControl; modelValue?: unknown }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
const id = `qd-rich-control-${useId()}`
</script>

<template>
  <span class="qd-rich-control">
    <ToggleSwitch :input-id="id" :model-value="!!modelValue" :aria-required="control.required ? 'true' : undefined" @update:model-value="emit('update:modelValue', !!$event)" />
    <label :for="id">{{ control.label }}</label>
  </span>
</template>
