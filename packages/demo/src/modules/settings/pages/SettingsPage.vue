<script setup>
/**
 * SettingsPage - MemoryStorage Demo with Inline Edit
 *
 * Demonstrates:
 * - MemoryStorage (volatile - data lost on page refresh)
 * - Inline cell editing with PrimeVue DataTable
 * - Warning banner for volatility
 *
 * Uses editMode="cell" for inline editing.
 */
import { ref } from 'vue'
import { useOrchestrator, useSignalToast } from 'qdadm'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { InfoBanner } from 'qdadm/components'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

const { getManager } = useOrchestrator()
const settingsManager = getManager('settings')
const toast = useSignalToast('SettingsPage')

// ============ DATA ============
const items = ref([])
const loading = ref(false)

// ============ TYPE OPTIONS ============
const typeOptions = [
  { label: 'String', value: 'string' },
  { label: 'Number', value: 'number' },
  { label: 'Boolean', value: 'boolean' }
]

// ============ LOAD DATA ============
async function loadSettings() {
  loading.value = true
  try {
    const result = await settingsManager.list({ page_size: 100 })
    items.value = result.items
  } finally {
    loading.value = false
  }
}

loadSettings()

// ============ CELL EDIT ============
async function onCellEditComplete(event) {
  const { data, newValue, field } = event

  // Skip if value unchanged
  if (data[field] === newValue) return

  // Validate: key cannot be empty
  if (field === 'key' && (!newValue || !newValue.trim())) {
    toast.add({
      severity: 'error',
      summary: 'Validation Error',
      detail: 'Key cannot be empty',
      life: 3000
    })
    return
  }

  // Update the record
  try {
    const updated = { ...data, [field]: newValue }
    await settingsManager.update(data.id, updated)

    // Update local state
    const index = items.value.findIndex(item => item.id === data.id)
    if (index !== -1) {
      items.value[index] = updated
    }

    toast.add({
      severity: 'success',
      summary: 'Updated',
      detail: `Setting "${data.key}" updated`,
      life: 2000
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to update setting',
      life: 3000
    })
  }
}

// ============ ADD NEW SETTING ============
const newKey = ref('')
const newValue = ref('')
const newType = ref('string')
const addingNew = ref(false)

async function addNewSetting() {
  if (!newKey.value.trim()) {
    toast.add({
      severity: 'error',
      summary: 'Validation Error',
      detail: 'Key is required',
      life: 3000
    })
    return
  }

  // Check for duplicate key
  if (items.value.some(item => item.key === newKey.value.trim())) {
    toast.add({
      severity: 'error',
      summary: 'Validation Error',
      detail: 'Key already exists',
      life: 3000
    })
    return
  }

  addingNew.value = true
  try {
    const setting = await settingsManager.create({
      id: newKey.value.trim(),
      key: newKey.value.trim(),
      value: newValue.value,
      type: newType.value
    })

    items.value.push(setting)

    // Reset form
    newKey.value = ''
    newValue.value = ''
    newType.value = 'string'

    toast.add({
      severity: 'success',
      summary: 'Created',
      detail: `Setting "${setting.key}" created`,
      life: 2000
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to create setting',
      life: 3000
    })
  } finally {
    addingNew.value = false
  }
}

// ============ DELETE ============
async function deleteSetting(setting) {
  try {
    await settingsManager.delete(setting.id)
    items.value = items.value.filter(item => item.id !== setting.id)

    toast.add({
      severity: 'success',
      summary: 'Deleted',
      detail: `Setting "${setting.key}" deleted`,
      life: 2000
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to delete setting',
      life: 3000
    })
  }
}

// ============ HELPERS ============
function getTypeSeverity(type) {
  const map = {
    string: 'info',
    number: 'success',
    boolean: 'warn'
  }
  return map[type] || 'secondary'
}
</script>

<template>
  <div>
    <!-- Page Header -->
    <div class="flex align-items-center justify-content-between mb-4">
      <div>
        <h1 class="text-2xl font-semibold m-0">Settings</h1>
        <p class="text-color-secondary mt-1 mb-0">MemoryStorage demo - volatile key/value store</p>
      </div>
    </div>

    <!-- Warning Banner -->
    <InfoBanner severity="warn">
      <strong>Volatile Storage:</strong> Settings are stored in memory only and will be
      <strong>lost on page refresh</strong>. This demonstrates MemoryStorage behavior.
    </InfoBanner>

    <div class="card">
      <!-- Add New Setting Form -->
      <div class="flex gap-2 mb-4 align-items-end flex-wrap">
        <div class="flex flex-column gap-1">
          <label class="text-sm font-medium">Key</label>
          <InputText
            v-model="newKey"
            placeholder="setting.key"
            class="w-12rem"
          />
        </div>
        <div class="flex flex-column gap-1">
          <label class="text-sm font-medium">Value</label>
          <InputText
            v-model="newValue"
            placeholder="value"
            class="w-12rem"
          />
        </div>
        <div class="flex flex-column gap-1">
          <label class="text-sm font-medium">Type</label>
          <Select
            v-model="newType"
            :options="typeOptions"
            optionLabel="label"
            optionValue="value"
            class="w-8rem"
          />
        </div>
        <Button
          label="Add Setting"
          icon="pi pi-plus"
          @click="addNewSetting"
          :loading="addingNew"
        />
      </div>

      <!-- Settings Table with Inline Edit -->
      <DataTable
        :value="items"
        :loading="loading"
        dataKey="id"
        editMode="cell"
        @cell-edit-complete="onCellEditComplete"
        stripedRows
        tableStyle="min-width: 50rem"
      >
        <template #empty>
          <div class="text-center py-4 text-color-secondary">
            <i class="pi pi-inbox text-4xl mb-2"></i>
            <p>No settings configured. Add one above.</p>
          </div>
        </template>

        <Column field="key" header="Key" style="width: 25%">
          <template #body="{ data }">
            <code class="text-primary">{{ data.key }}</code>
          </template>
          <template #editor="{ data, field }">
            <InputText v-model="data[field]" autofocus class="w-full" />
          </template>
        </Column>

        <Column field="value" header="Value" style="width: 40%">
          <template #body="{ data }">
            {{ data.value }}
          </template>
          <template #editor="{ data, field }">
            <InputText v-model="data[field]" autofocus class="w-full" />
          </template>
        </Column>

        <Column field="type" header="Type" style="width: 15%">
          <template #body="{ data }">
            <Tag :value="data.type" :severity="getTypeSeverity(data.type)" />
          </template>
          <template #editor="{ data, field }">
            <Select
              v-model="data[field]"
              :options="typeOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
            />
          </template>
        </Column>

        <Column header="Actions" style="width: 100px">
          <template #body="{ data }">
            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              @click="deleteSetting(data)"
              v-tooltip.top="'Delete'"
            />
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<style scoped>
code {
  padding: 0.2rem 0.4rem;
  background: var(--p-surface-100);
  border-radius: 4px;
  font-size: 0.875rem;
}
</style>
