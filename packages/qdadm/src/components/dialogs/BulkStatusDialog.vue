<script setup>
import SimpleDialog from './SimpleDialog.vue'
import Select from 'primevue/select'

defineProps({
  visible: Boolean,
  title: { type: String, default: 'Change Status' },
  options: { type: Array, required: true },
  modelValue: [String, Number],
  loading: Boolean,
  selectionCount: { type: Number, default: 0 }
})

defineEmits(['update:visible', 'update:modelValue', 'confirm', 'cancel'])
</script>

<template>
  <SimpleDialog
    :visible="visible"
    :title="title"
    width="400px"
    :loading="loading"
    confirmLabel="Update"
    confirmIcon="pi pi-check"
    :confirmDisabled="!modelValue"
    @update:visible="$emit('update:visible', $event)"
    @confirm="$emit('confirm')"
    @cancel="$emit('cancel')"
  >
    <p v-if="selectionCount > 0" class="mb-3">
      Change status for {{ selectionCount }} selected item(s):
    </p>
    <Select
      :modelValue="modelValue"
      :options="options"
      optionLabel="label"
      optionValue="value"
      placeholder="Select new status"
      class="w-full"
      @update:modelValue="$emit('update:modelValue', $event)"
    />
  </SimpleDialog>
</template>
