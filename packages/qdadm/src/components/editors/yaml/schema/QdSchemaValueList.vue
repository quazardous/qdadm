<script setup lang="ts">
/**
 * QdSchemaValueList (#5587): a list of plain values, `show: [id_product]`,
 * each edited by the items' schema; added and removed in place.
 *
 * Runtime props (#5469): an app's JavaScript build compiles qdadm's .vue.
 */
import { computed, type PropType } from 'vue'
import { useI18n } from '../../../../i18n/useI18n'
import QdRuleParam from '../rules/QdRuleParam.vue'
import { addItemAt, removeAt } from '../rules/ruleDoc'
import { defaultParam, type ParamSpec } from '../rules/vocabulary'
import { useSchemaBuilder } from './context'
import type { YamlPath } from '@quazardous/vanilla-yamleditor'

const props = defineProps({
  // Any shape: the YAML's list
  value: null,
  item: { type: Object as PropType<ParamSpec>, required: true },
  path: { type: Array as PropType<YamlPath>, required: true },
  label: { type: String, default: '' },
})
const ctx = useSchemaBuilder()
const { tOr } = useI18n()
const t = (key: string, fallback: string, params?: Record<string, unknown>) => tOr(`core.schemaBuilder.${key}`, fallback, params as never)
const items = computed<unknown[]>(() => (Array.isArray(props.value) ? props.value : []))
</script>

<template>
  <div class="qd-schema-values" data-value-list>
    <ul class="qd-rule-rows">
      <li v-for="(v, i) in items" :key="i" class="qd-rule-row" :data-entry="i">
        <QdRuleParam :param="item" :value="v" :path="[...path, i]" :label="`${label} ${i + 1}`" :read-only="ctx.readOnly()" @apply="ctx.apply" />
        <button v-if="!ctx.readOnly()" type="button" class="qd-rule-action" :aria-label="t('removeEntry', 'Remove this value')" :title="t('removeEntry', 'Remove this value')" data-remove-entry @click="ctx.apply((text) => removeAt(text, [...path, i]))">
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </li>
    </ul>
    <button v-if="!ctx.readOnly()" type="button" class="qd-rule-link" data-add-entry @click="ctx.apply((text) => addItemAt(text, path, defaultParam(item)))">{{ t('addEntry', 'Add a value') }}</button>
  </div>
</template>
