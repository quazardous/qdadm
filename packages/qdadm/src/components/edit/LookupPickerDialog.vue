<script setup lang="ts">
/**
 * LookupPickerDialog - Modal search dialog for entity lookup
 *
 * Opens a DataTable with search to select item(s) from a large dataset.
 * Supports single selection (click row) and multiple selection (checkboxes).
 *
 * Used internally by LookupField in 'picker' mode.
 */
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import QdButton from '../base/QdButton.vue'
import { useI18n } from '../../i18n/useI18n'

const { t } = useI18n()

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
  valueField?: string
  /** Current value(s) — single value or array for multiple mode */
  currentValue?: unknown
  width?: string
  /** Enable checkbox multi-selection */
  multiple?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Select item',
  loading: false,
  valueField: 'id',
  currentValue: undefined,
  width: '700px',
  multiple: false,
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  /** Single selection (multiple=false) */
  'select': [item: Record<string, unknown>]
  /** Multi selection (multiple=true) */
  'select-multiple': [items: Record<string, unknown>[]]
}>()

const searchQuery = ref('')
// Single mode
const selectedRow = ref<Record<string, unknown> | null>(null)
// Multi mode
const selectedRows = ref<Record<string, unknown>[]>([])

// Reset state + pre-select current values when dialog opens
watch(() => props.visible, (open) => {
  if (open) {
    searchQuery.value = ''
    selectedRow.value = null
    if (props.multiple && props.currentValue != null) {
      // Pre-select rows matching currentValue array
      const vals = Array.isArray(props.currentValue) ? props.currentValue : [props.currentValue]
      const valStrings = new Set(vals.map(String))
      selectedRows.value = props.items.filter((item) =>
        valStrings.has(String(item[props.valueField])),
      )
    } else {
      selectedRows.value = []
    }
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

// Highlight the row(s) matching currentValue (single mode only)
const rowClass = (data: Record<string, unknown>): string | undefined => {
  if (props.multiple) return undefined
  const val = data[props.valueField]
  if (val != null && props.currentValue != null && String(val) === String(props.currentValue)) {
    return 'lookup-current-row'
  }
  return undefined
}

function onRowSelect(event: { data: Record<string, unknown> }): void {
  if (!props.multiple) {
    selectedRow.value = event.data
  }
}

function onRowDblClick(event: { data: Record<string, unknown> }): void {
  if (!props.multiple) {
    emit('select', event.data)
    emit('update:visible', false)
  }
}

function onConfirm(): void {
  if (props.multiple) {
    emit('select-multiple', selectedRows.value)
  } else if (selectedRow.value) {
    emit('select', selectedRow.value)
  }
  emit('update:visible', false)
}

function onCancel(): void {
  emit('update:visible', false)
}

const confirmDisabled = computed(() => {
  if (props.multiple) return false // allow confirming empty selection (clear all)
  return !selectedRow.value
})

const confirmLabel = computed(() => {
  if (props.multiple && selectedRows.value.length > 0) {
    return `Select (${selectedRows.value.length})`
  }
  return 'Select'
})
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
          :placeholder="t('core.placeholders.search')"
          class="w-full"
          autofocus
        />
      </span>
    </div>

    <!-- Results table -->
    <DataTable
      :value="filteredItems"
      :loading="loading"
      v-model:selection="selectedRows"
      :selectionMode="multiple ? undefined : 'single'"
      @row-select="onRowSelect"
      @row-dblclick="onRowDblClick"
      :rowClass="rowClass"
      :paginator="filteredItems.length > 10"
      :rows="10"
      :dataKey="valueField"
      scrollable
      scrollHeight="400px"
      stripedRows
      class="lookup-picker-table"
    >
      <!-- Checkbox column for multi mode -->
      <Column v-if="multiple" selectionMode="multiple" headerStyle="width: 3rem" />
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
          {{ searchQuery ? t('core.messages.noMatching') : t('core.messages.empty') }}
        </div>
      </template>
    </DataTable>

    <template #footer>
      <QdButton
        :label="t('core.actions.cancel')"
        severity="secondary"
        @click="onCancel"
      />
      <QdButton
        :label="confirmLabel"
        icon="pi pi-check"
        :disabled="confirmDisabled"
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
