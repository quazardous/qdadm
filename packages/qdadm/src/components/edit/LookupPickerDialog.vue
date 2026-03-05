<script setup lang="ts">
/**
 * LookupPickerDialog - Modal search dialog for entity lookup
 *
 * Opens a DataTable with search to select an item from a large dataset.
 * The current field value is NOT modified until the user confirms a selection.
 *
 * Used internally by LookupField in 'picker' mode.
 */
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

export interface LookupColumn {
  field: string
  header?: string
  sortable?: boolean
  style?: string | Record<string, string>
}

interface Props {
  visible: boolean
  title?: string
  items: Record<string, unknown>[]
  columns: (string | LookupColumn)[]
  loading?: boolean
  labelField?: string
  valueField?: string
  currentValue?: unknown
  width?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Select item',
  loading: false,
  labelField: 'name',
  valueField: 'id',
  currentValue: undefined,
  width: '700px',
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'select': [item: Record<string, unknown>]
}>()

const searchQuery = ref('')
const selectedRow = ref<Record<string, unknown> | null>(null)

// Reset state when dialog opens
watch(() => props.visible, (open) => {
  if (open) {
    searchQuery.value = ''
    selectedRow.value = null
  }
})

// Resolve columns config
const resolvedColumns = computed((): LookupColumn[] => {
  return props.columns.map((col) => {
    if (typeof col === 'string') {
      return { field: col, header: col.charAt(0).toUpperCase() + col.slice(1), sortable: true }
    }
    return { header: col.field.charAt(0).toUpperCase() + col.field.slice(1), sortable: true, ...col }
  })
})

// Filter items by search query across all visible columns
const filteredItems = computed(() => {
  if (!searchQuery.value) return props.items
  const q = searchQuery.value.toLowerCase()
  return props.items.filter((item) =>
    resolvedColumns.value.some((col) => {
      const val = item[col.field]
      return val != null && String(val).toLowerCase().includes(q)
    }),
  )
})

// Highlight the row that matches currentValue
const rowClass = (data: Record<string, unknown>): string | undefined => {
  const val = data[props.valueField]
  if (val != null && props.currentValue != null && String(val) === String(props.currentValue)) {
    return 'lookup-current-row'
  }
  return undefined
}

function onRowSelect(event: { data: Record<string, unknown> }): void {
  selectedRow.value = event.data
}

function onRowDblClick(event: { data: Record<string, unknown> }): void {
  emit('select', event.data)
  emit('update:visible', false)
}

function onConfirm(): void {
  if (selectedRow.value) {
    emit('select', selectedRow.value)
    emit('update:visible', false)
  }
}

function onCancel(): void {
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    :header="title"
    :modal="true"
    :style="{ width }"
    :closable="true"
    :dismissableMask="true"
    @update:visible="$emit('update:visible', $event)"
  >
    <!-- Search bar -->
    <div class="flex gap-2 mb-3">
      <span class="p-input-icon-left flex-1">
        <i class="pi pi-search" />
        <InputText
          v-model="searchQuery"
          placeholder="Search..."
          class="w-full"
          autofocus
        />
      </span>
    </div>

    <!-- Results table -->
    <DataTable
      :value="filteredItems"
      :loading="loading"
      :selection="selectedRow"
      selectionMode="single"
      @row-select="onRowSelect"
      @row-dblclick="onRowDblClick"
      :rowClass="rowClass"
      :paginator="filteredItems.length > 10"
      :rows="10"
      dataKey=""
      scrollable
      scrollHeight="400px"
      stripedRows
      class="lookup-picker-table"
    >
      <Column
        v-for="col in resolvedColumns"
        :key="col.field"
        :field="col.field"
        :header="col.header"
        :sortable="col.sortable"
        :style="col.style"
      />
      <template #empty>
        <div class="text-center text-color-secondary py-4">
          {{ searchQuery ? 'No matching items' : 'No items available' }}
        </div>
      </template>
    </DataTable>

    <template #footer>
      <Button
        label="Cancel"
        severity="secondary"
        @click="onCancel"
      />
      <Button
        label="Select"
        icon="pi pi-check"
        :disabled="!selectedRow"
        @click="onConfirm"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.lookup-picker-table :deep(.lookup-current-row) {
  background-color: var(--p-highlight-background) !important;
}
</style>
