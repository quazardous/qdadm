<script setup lang="ts">
/**
 * QdSchemaFields (#5587): an object's properties, each edited by its schema,
 * in the schema's order; keys the schema does not list show as YAML. An
 * optional property not there is offered by « Add a field ».
 *
 * Runtime props (#5469): an app's JavaScript build compiles qdadm's .vue.
 */
import { computed, type PropType } from 'vue'
import { addKeyAt } from '../rules/ruleDoc'
import { useI18n } from '../../../../i18n/useI18n'
import QdSchemaField from './QdSchemaField.vue'
import { defaultFor, resolverOf, type JsonSchema } from './schemaModel'
import { useSchemaBuilder } from './context'
import type { YamlPath } from '@quazardous/vanilla-yamleditor'

const props = defineProps({
  // Any shape: the YAML's object
  value: null,
  schema: { type: Object as PropType<JsonSchema>, required: true },
  path: { type: Array as PropType<YamlPath>, required: true },
  /** Keys drawn elsewhere (an item's title and switch) */
  exclude: { type: Array as PropType<string[]>, default: () => [] },
})
const ctx = useSchemaBuilder()
const { tOr } = useI18n()
const t = (key: string, fallback: string, params?: Record<string, unknown>) => tOr(`core.schemaBuilder.${key}`, fallback, params as never)

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const obj = computed(() => (isObj(props.value) ? props.value : {}))
const declared = computed(() => (isObj(props.schema.properties) ? (props.schema.properties as Record<string, unknown>) : {}))
const required = computed(() => (Array.isArray(props.schema.required) ? (props.schema.required as string[]) : []))
const resolve = computed(() => resolverOf(ctx.root()))

const shown = computed(() => {
  const keys = Object.keys(declared.value).filter((k) => k in obj.value && !props.exclude.includes(k))
  const extra = Object.keys(obj.value).filter((k) => !(k in declared.value) && !props.exclude.includes(k))
  return [...keys.map((key) => ({ key, schema: declared.value[key] as unknown })), ...extra.map((key) => ({ key, schema: undefined as unknown }))]
})
const missing = computed(() => Object.keys(declared.value).filter((k) => !(k in obj.value) && !props.exclude.includes(k)))
const labelOf = (key: string) => {
  const title = resolve.value(declared.value[key]).title
  return typeof title === 'string' ? tOr(title, title) : key
}
function addField(key: string): void {
  const handlerNames = Object.keys(ctx.handlers())
  const v = defaultFor(declared.value[key], ctx.root(), handlerNames)
  ctx.apply((text) => addKeyAt(text, props.path, key, v))
}
</script>

<template>
  <div class="qd-schema-fields">
    <QdSchemaField
      v-for="f in shown"
      :key="f.key"
      :name="f.key"
      :label="f.schema === undefined ? f.key : labelOf(f.key)"
      :schema="f.schema"
      :value="obj[f.key]"
      :path="[...path, f.key]"
      :removable="!required.includes(f.key)"
    />
    <select
      v-if="!ctx.readOnly() && missing.length"
      class="p-inputtext p-component qd-rule-select qd-schema-add-field"
      :aria-label="t('addField', 'Add a field')"
      data-add-field
      @change="addField(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).selectedIndex = 0"
    >
      <option value="" selected disabled>{{ t('addField', 'Add a field') }}</option>
      <option v-for="k in missing" :key="k" :value="k">{{ labelOf(k) }}</option>
    </select>
  </div>
</template>
