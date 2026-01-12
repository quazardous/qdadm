<script setup lang="ts">
/**
 * LanguageEditor - Reusable component for editing language capabilities
 *
 * Props:
 * - modelValue: Array of {code, fluency, primary} objects
 * - label: Field label
 * - help: Help text
 */

import { ref, computed } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Slider from 'primevue/slider'
import Checkbox from 'primevue/checkbox'

interface LanguageItem {
  code: string
  fluency: number
  primary: boolean
}

interface Props {
  modelValue?: LanguageItem[]
  label?: string
  help?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  label: 'Languages',
  help: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: LanguageItem[]]
}>()

const languages = computed<LanguageItem[]>({
  get: () => props.modelValue || [],
  set: (value: LanguageItem[]) => emit('update:modelValue', value)
})

const newLanguage = ref<LanguageItem>({ code: '', fluency: 0.8, primary: false })

function addLanguage(): void {
  if (!newLanguage.value.code) return
  let updated = [...languages.value]

  // If this is the first language, make it primary
  if (updated.length === 0) {
    newLanguage.value.primary = true
  }

  // If new language is primary, remove primary from others
  if (newLanguage.value.primary) {
    updated = updated.map(l => ({ ...l, primary: false }))
  }

  updated.push({ ...newLanguage.value })
  emit('update:modelValue', updated)
  newLanguage.value = { code: '', fluency: 0.8, primary: false }
}

function removeLanguage(index: number): void {
  const updated = [...languages.value]
  const item = updated[index]
  const wasPrimary = item?.primary ?? false
  updated.splice(index, 1)
  // If we removed the primary, make the first one primary
  if (wasPrimary && updated.length > 0 && updated[0]) {
    updated[0].primary = true
  }
  emit('update:modelValue', updated)
}

function setPrimaryLanguage(index: number): void {
  const updated = languages.value.map((l, i) => ({
    ...l,
    primary: i === index
  }))
  emit('update:modelValue', updated)
}

function updateFluency(index: number, fluency: number | number[]): void {
  const updated = [...languages.value]
  const item = updated[index]
  if (item) {
    const fluencyValue = Array.isArray(fluency) ? (fluency[0] ?? 0) : fluency
    updated[index] = { code: item.code, fluency: fluencyValue, primary: item.primary }
    emit('update:modelValue', updated)
  }
}
</script>

<template>
  <div class="form-field">
    <label>{{ label }}</label>
    <div class="lang-list">
      <div v-if="languages.length === 0" class="lang-empty">
        No languages added yet
      </div>
      <div v-for="(lang, index) in languages" :key="index" class="lang-item">
        <span class="lang-code">{{ lang.code.toUpperCase() }}</span>
        <div class="lang-fluency-container">
          <span class="lang-fluency">{{ (lang.fluency * 100).toFixed(0) }}%</span>
          <Slider
            :modelValue="lang.fluency"
            @update:modelValue="(v) => updateFluency(index, v)"
            :min="0.1"
            :max="1"
            :step="0.1"
            style="width: 100px"
          />
        </div>
        <Button
          v-if="lang.primary"
          icon="pi pi-star-fill"
          severity="warning"
          text
          rounded
          size="small"
          v-tooltip.top="'Primary language'"
        />
        <Button
          v-else
          icon="pi pi-star"
          severity="secondary"
          text
          rounded
          size="small"
          @click="setPrimaryLanguage(index)"
          v-tooltip.top="'Set as primary'"
        />
        <Button
          icon="pi pi-times"
          severity="danger"
          text
          rounded
          size="small"
          @click="removeLanguage(index)"
        />
      </div>
    </div>
    <div class="lang-add">
      <Button
        icon="pi pi-plus"
        @click="addLanguage"
        :disabled="!newLanguage.code"
        v-tooltip.top="'Add language'"
      />
      <InputText
        v-model="newLanguage.code"
        placeholder="Code (e.g., en, fr)"
        class="lang-add-input"
        @keyup.enter="addLanguage"
      />
      <div class="lang-slider">
        <span>{{ (newLanguage.fluency * 100).toFixed(0) }}%</span>
        <Slider v-model="newLanguage.fluency" :min="0.1" :max="1" :step="0.1" style="width: 80px" />
      </div>
      <div class="lang-primary-toggle">
        <Checkbox v-model="newLanguage.primary" :binary="true" inputId="newLangPrimary" />
        <label for="newLangPrimary" class="lang-primary-label">Primary</label>
      </div>
    </div>
    <small v-if="help" class="form-field-help">{{ help }}</small>
  </div>
</template>

<style scoped>
.lang-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.lang-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--p-surface-50);
  border-radius: 0.25rem;
}

.lang-code {
  font-weight: 600;
  min-width: 40px;
  padding: 0.25rem 0.5rem;
  background: var(--p-primary-100);
  color: var(--p-primary-700);
  border-radius: 0.25rem;
  text-align: center;
}

.lang-fluency-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.lang-fluency {
  min-width: 40px;
  text-align: right;
  font-family: monospace;
  color: var(--p-text-secondary);
}

.lang-add {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.lang-add-input {
  flex: 1;
  max-width: 150px;
}

.lang-slider {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.lang-slider span {
  min-width: 40px;
  text-align: right;
  font-family: monospace;
}

.lang-empty {
  padding: 0.75rem;
  color: var(--p-text-secondary);
  font-style: italic;
  background: var(--p-surface-50);
  border-radius: 0.25rem;
  text-align: center;
}

.lang-primary-toggle {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.lang-primary-label {
  font-size: 0.875rem;
  color: var(--p-text-secondary);
  cursor: pointer;
}
</style>
