<script setup lang="ts">
/**
 * QdSchemaField (#5587): one property, edited by its schema: a value (text
 * with suggestions, number, switch, choice, threshold), a list, a key table,
 * a nested object, an all / any tree, or an app's handler (`x-widget`).
 * Anything else shows as YAML, with « Edit in the text ».
 *
 * Runtime props (#5469): an app's JavaScript build compiles qdadm's .vue.
 */
import { computed, type PropType } from 'vue'
import { stringify } from 'yaml'
import { useI18n } from '../../../../i18n/useI18n'
import QdRuleParam from '../rules/QdRuleParam.vue'
import QdRuleGroup from '../rules/QdRuleGroup.vue'
import QdSchemaFields from './QdSchemaFields.vue'
import QdSchemaKeyTable from './QdSchemaKeyTable.vue'
import QdSchemaValueList from './QdSchemaValueList.vue'
import { removeAt, setAt } from '../rules/ruleDoc'
import { fieldKind, fitsKind, resolverOf } from './schemaModel'
import { useSchemaBuilder } from './context'
import type { YamlPath } from '@quazardous/vanilla-yamleditor'

const props = defineProps({
  name: { type: String, required: true },
  label: { type: String, default: '' },
  /** The property's schema; none: a key the schema does not list */
  // Any shape: a JSON Schema node
  schema: null,
  // Any shape: the YAML's value
  value: null,
  path: { type: Array as PropType<YamlPath>, required: true },
  removable: { type: Boolean, default: true },
})
const ctx = useSchemaBuilder()
const { tOr } = useI18n()
const t = (key: string, fallback: string, params?: Record<string, unknown>) => tOr(`core.schemaBuilder.${key}`, fallback, params as never)

const kind = computed(() => (props.schema === undefined ? ({ kind: 'raw' } as const) : fieldKind(props.schema, ctx.root(), Object.keys(ctx.handlers()))))
const resolved = computed(() => resolverOf(ctx.root())(props.schema))
const drawn = computed(() => kind.value.kind !== 'param' ? fitsKind(kind.value, props.value) : true)
const description = computed(() => (typeof resolved.value.description === 'string' ? tOr(resolved.value.description, resolved.value.description) : ''))
const handler = computed(() => (kind.value.kind === 'handler' ? ctx.handlers()[kind.value.name] ?? null : null))
const yamlOf = (v: unknown) => stringify(v, { lineWidth: 0 }).trimEnd()
</script>

<template>
  <div class="qd-schema-field" :data-field="name" :data-kind="drawn ? kind.kind : 'raw'">
    <div class="qd-schema-field-head">
      <span class="qd-schema-field-label" :title="description || undefined">{{ label || name }}</span>
      <button v-if="removable && !ctx.readOnly()" type="button" class="qd-rule-action" :aria-label="t('removeField', 'Remove {name}', { name: label || name })" :title="t('removeField', 'Remove {name}', { name: label || name })" data-remove-field @click="ctx.apply((text) => removeAt(text, path))">
        <i class="pi pi-times" aria-hidden="true"></i>
      </button>
    </div>
    <div class="qd-schema-field-body">
      <template v-if="drawn && kind.kind === 'param'">
        <QdRuleParam :param="kind.param" :value="value" :path="path" :label="label || name" :read-only="ctx.readOnly()" @apply="ctx.apply" />
      </template>
      <QdSchemaFields v-else-if="drawn && kind.kind === 'object'" :value="value" :schema="resolved" :path="path" />
      <QdSchemaKeyTable v-else-if="drawn && kind.kind === 'keyTable'" :value="value" :spec="kind" :path="path" :label="label || name" />
      <QdSchemaValueList v-else-if="drawn && kind.kind === 'list'" :value="value" :item="kind.item" :path="path" :label="label || name" />
      <QdRuleGroup
        v-else-if="drawn && kind.kind === 'conditions'"
        :value="value"
        :path="path"
        :vocabulary="kind.vocabulary"
        :read-only="ctx.readOnly()"
        bare
        @apply="ctx.apply"
        @reveal="ctx.reveal"
      />
      <component
        :is="handler"
        v-else-if="handler"
        :value="value"
        :path="path"
        :schema="resolved"
        :read-only="ctx.readOnly()"
        @update="(v: unknown) => ctx.apply((text) => setAt(text, path, v))"
        @apply="ctx.apply"
      />
      <div v-else class="qd-rule-raw" data-rule-raw>
        <pre>{{ yamlOf(value) }}</pre>
        <button type="button" class="qd-rule-link" @click="ctx.reveal(path)">{{ tOr('core.ruleBuilder.editInText', 'Edit in the text') }}</button>
      </div>
    </div>
  </div>
</template>
