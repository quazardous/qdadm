<script setup lang="ts">
/**
 * QdSchemaKeyTable (#5587): a map of keys to texts, `{ supplier: '{script}' }`:
 * keys from the schema's `propertyNames.enum` (or free ones), each with a free
 * text that keeps its suggestions. Keys added, renamed and removed in place.
 *
 * Runtime props (#5469): an app's JavaScript build compiles qdadm's .vue.
 */
import { computed, ref, useId, type PropType } from 'vue'
import { useI18n } from '../../../../i18n/useI18n'
import { addKeyAt, removeAt, renameKeyAt, setAt } from '../rules/ruleDoc'
import { useSchemaBuilder } from './context'
import type { FieldKind } from './schemaModel'
import type { YamlPath } from '@quazardous/vanilla-yamleditor'

type KeyTable = Extract<FieldKind, { kind: 'keyTable' }>
const props = defineProps({
  // Any shape: the YAML's map
  value: null,
  spec: { type: Object as PropType<KeyTable>, required: true },
  path: { type: Array as PropType<YamlPath>, required: true },
  label: { type: String, default: '' },
})
const ctx = useSchemaBuilder()
const { tOr } = useI18n()
const t = (key: string, fallback: string, params?: Record<string, unknown>) => tOr(`core.schemaBuilder.${key}`, fallback, params as never)
const listId = `qd-schema-suggest-${useId()}`

const entries = computed(() => (props.value && typeof props.value === 'object' && !Array.isArray(props.value) ? Object.entries(props.value as Record<string, unknown>) : []))
const used = computed(() => new Set(entries.value.map(([k]) => k)))
const free = computed(() => props.spec.keys.filter((k) => !used.value.has(k.value)))
const keyLabel = (k: { value: string; label?: string }) => (k.label ? tOr(k.label, k.label) : k.value)
const newKey = ref('')

function add(key: string): void {
  const k = key.trim()
  if (!k || used.value.has(k)) return
  ctx.apply((text) => addKeyAt(text, props.path, k, ''))
  newKey.value = ''
}
function rename(from: string, to: string): void {
  const k = to.trim()
  if (!k || k === from || used.value.has(k)) return
  ctx.apply((text) => renameKeyAt(text, props.path, from, k))
}
</script>

<template>
  <div class="qd-schema-keys" data-key-table>
    <ul class="qd-rule-rows">
      <li v-for="[key, v] in entries" :key="key" class="qd-rule-row" :data-key="key">
        <select v-if="!spec.free" class="p-inputtext p-component qd-rule-select" :aria-label="t('key', 'Key')" :disabled="ctx.readOnly()" data-key-name @change="rename(key, ($event.target as HTMLSelectElement).value)">
          <option v-for="k in spec.keys.filter((x) => x.value === key || !used.has(x.value))" :key="k.value" :value="k.value" :selected="k.value === key">{{ keyLabel(k) }}</option>
          <option v-if="!spec.keys.some((x) => x.value === key)" :value="key" selected>{{ key }}</option>
        </select>
        <input v-else class="p-inputtext p-component qd-rule-input qd-schema-key" :value="key" :aria-label="t('key', 'Key')" :disabled="ctx.readOnly()" data-key-name @change="rename(key, ($event.target as HTMLInputElement).value)" />
        <input
          class="p-inputtext p-component qd-rule-input"
          :value="v ?? ''"
          :aria-label="t('valueOf', 'Value of {key}', { key })"
          :disabled="ctx.readOnly()"
          :list="spec.suggestions.length ? listId : undefined"
          autocomplete="off"
          data-key-value
          @change="ctx.apply((text) => setAt(text, [...path, key], ($event.target as HTMLInputElement).value))"
        />
        <button v-if="!ctx.readOnly()" type="button" class="qd-rule-action" :aria-label="t('removeKey', 'Remove {key}', { key })" :title="t('removeKey', 'Remove {key}', { key })" data-remove-key @click="ctx.apply((text) => removeAt(text, [...path, key]))">
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </li>
    </ul>
    <datalist v-if="spec.suggestions.length" :id="listId">
      <option v-for="s in spec.suggestions" :key="s" :value="s"></option>
    </datalist>
    <div v-if="!ctx.readOnly()" class="qd-rule-add">
      <select v-if="!spec.free && free.length" class="p-inputtext p-component qd-rule-select" :aria-label="t('addKey', 'Add a key')" data-add-key @change="add(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).selectedIndex = 0">
        <option value="" selected disabled>{{ t('addKey', 'Add a key') }}</option>
        <option v-for="k in free" :key="k.value" :value="k.value">{{ keyLabel(k) }}</option>
      </select>
      <input v-else-if="spec.free" v-model="newKey" class="p-inputtext p-component qd-rule-input" :placeholder="t('addKey', 'Add a key')" :aria-label="t('addKey', 'Add a key')" data-add-key @keydown.enter.prevent="add(newKey)" @change="add(newKey)" />
    </div>
  </div>
</template>
