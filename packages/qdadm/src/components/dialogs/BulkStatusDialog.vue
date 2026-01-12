<script setup lang="ts">
import SimpleDialog from './SimpleDialog.vue'
import Select from 'primevue/select'

interface StatusOption {
  label: string
  value: string | number
}

interface Props {
  visible?: boolean
  title?: string
  options: StatusOption[]
  modelValue?: string | number
  loading?: boolean
  selectionCount?: number
}

withDefaults(defineProps<Props>(), {
  visible: false,
  title: 'Change Status',
  loading: false,
  selectionCount: 0
})

defineEmits<{
  'update:visible': [value: boolean]
  'update:modelValue': [value: string | number]
  confirm: []
  cancel: []
}>()
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
