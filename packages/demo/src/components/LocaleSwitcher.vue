<script setup>
/**
 * LocaleSwitcher - Demo locale toggle.
 *
 * Emits `locale:change` on the kernel signal bus; the qdadm I18n subsystem
 * picks it up, loads any new bundles via providers, and broadcasts
 * `locale:changed` once the switch is complete.
 */
import { inject, computed } from 'vue'
import Select from 'primevue/select'
import { SidebarBox } from '@quazardous/qdadm/components'

const i18n = inject('qdadmI18n', null)
const signals = inject('qdadmSignals', null)

const options = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
]

const current = computed({
  get: () => i18n?.locale.value ?? 'en',
  set: (value) => {
    if (signals) {
      signals.emit('locale:change', value)
    } else if (i18n) {
      void i18n.changeLocale(value)
    }
  },
})
</script>

<template>
  <SidebarBox v-if="i18n">
    <template #full>
      <span class="sidebar-box-full-label">Language</span>
      <Select
        v-model="current"
        :options="options"
        option-label="label"
        option-value="value"
        size="small"
        class="sidebar-box-full-input"
        appendTo="self"
        :pt="{ root: { 'aria-label': 'Locale' } }"
      />
    </template>
  </SidebarBox>
</template>
