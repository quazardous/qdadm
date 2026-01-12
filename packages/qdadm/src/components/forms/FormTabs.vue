<script setup lang="ts">
/**
 * FormTabs - Normalized tab container for forms
 *
 * Provides consistent styling and behavior for form tabs.
 * Works with FormTab component for individual tabs.
 *
 * Usage:
 *   <FormTabs v-model="activeTab" @update:modelValue="onTabChange">
 *     <template #tabs>
 *       <FormTab value="general" label="General" icon="pi-cog" />
 *       <FormTab value="items" label="Items" icon="pi-list" :count="items.length" />
 *       <FormTab value="advanced" label="Advanced" :visible="isEdit" />
 *     </template>
 *     <template #panels>
 *       <TabPanel value="general">...</TabPanel>
 *       <TabPanel value="items">...</TabPanel>
 *       <TabPanel value="advanced">...</TabPanel>
 *     </template>
 *   </FormTabs>
 */

import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import TabPanels from 'primevue/tabpanels'

defineProps({
  /**
   * Active tab value (v-model)
   */
  modelValue: {
    type: String,
    required: true
  }
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onTabChange(value: string | number): void {
  emit('update:modelValue', String(value))
}
</script>

<template>
  <div class="form-tabs">
    <Tabs :value="modelValue" @update:value="onTabChange">
      <TabList class="form-tabs__list">
        <slot name="tabs" ></slot>
      </TabList>
      <TabPanels class="form-tabs__panels">
        <slot name="panels" ></slot>
      </TabPanels>
    </Tabs>
  </div>
</template>

<style scoped>
.form-tabs {
  margin-top: 1rem;
}

.form-tabs :deep(.form-tabs__list) {
  border-bottom: 1px solid var(--p-surface-200);
  gap: 0;
}

.form-tabs :deep(.form-tabs__panels) {
  padding: 1.5rem 0;
}

/* Tab styling */
.form-tabs :deep(.p-tab) {
  padding: 0.75rem 1.25rem;
  border-radius: 0;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.2s ease;
}

.form-tabs :deep(.p-tab:hover) {
  background: var(--p-surface-50);
}

.form-tabs :deep(.p-tab[data-p-active="true"]) {
  border-bottom-color: var(--p-primary-500);
  color: var(--p-primary-500);
}

/* Tab icon alignment */
.form-tabs :deep(.p-tab .pi) {
  margin-right: 0.5rem;
}

/* Tab badge/count styling */
.form-tabs :deep(.tab-badge) {
  margin-left: 0.5rem;
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  min-width: 1.25rem;
  text-align: center;
}

/* Disabled tab */
.form-tabs :deep(.p-tab[data-p-disabled="true"]) {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
