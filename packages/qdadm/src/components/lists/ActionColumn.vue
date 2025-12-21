<script setup>
/**
 * ActionColumn - Reusable table action buttons (edit, delete)
 *
 * Slots:
 * - default: Extra actions (after edit/delete)
 *
 * Emits:
 * - edit: When edit button is clicked
 * - delete: When delete button is clicked
 */
import Button from 'primevue/button'

defineEmits(['edit', 'delete'])
</script>

<template>
  <div class="table-actions">
    <Button
      icon="pi pi-pencil"
      severity="secondary"
      text
      rounded
      @click="$emit('edit')"
      v-tooltip.top="'Edit'"
    />
    <Button
      icon="pi pi-trash"
      severity="danger"
      text
      rounded
      @click="$emit('delete')"
      v-tooltip.top="'Delete'"
    />
    <slot ></slot>
  </div>
</template>
