<script setup lang="ts">
/**
 * QdRuleGroup (#5581): a group of conditions, `all` or `any`, and its rows:
 * a condition (its type, then its value) or a nested group, up to `maxDepth`.
 * Deeper, or a shape the vocabulary does not know: the YAML, read-only, with
 * « Edit in the text ». Every change is a patch, given to the builder.
 *
 * Runtime props (#5469): an app's JavaScript build compiles qdadm's .vue.
 */
import { computed, type PropType } from 'vue'
import { stringify } from 'yaml'
import { useI18n } from '../../../../i18n/useI18n'
import QdRuleParam from './QdRuleParam.vue'
import { COMBINATORS, defaultParam, fitsParam, type Combinator, type RuleVocabulary } from './vocabulary'
import { addItemAt, removeAt, renameKeyAt, setAt, type YamlPath } from './ruleDoc'

const props = defineProps({
  /** The group: `{ all: [...] }` or `{ any: [...] }` */
  // Any shape: the YAML's value
  value: null,
  /** Where the group's map is in the YAML */
  path: { type: Array as PropType<YamlPath>, required: true },
  vocabulary: { type: Object as PropType<RuleVocabulary>, required: true },
  depth: { type: Number, default: 1 },
  maxDepth: { type: Number, default: 3 },
  readOnly: { type: Boolean, default: false },
  /** A bare condition (`when: { channel: … }`) taken as a group of one, wrapped in `all` when one is added (#5587) */
  bare: { type: Boolean, default: false },
})
const emit = defineEmits<{
  (e: 'apply', change: (text: string) => string): void
  (e: 'reveal', path: YamlPath): void
}>()
const { tOr } = useI18n()
const t = (key: string, fallback: string, params?: Record<string, unknown>) => tOr(`core.ruleBuilder.${key}`, fallback, params as never)

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const combinator = computed<Combinator | null>(() => {
  if (!isObj(props.value)) return null
  const keys = Object.keys(props.value)
  return keys.length === 1 && (COMBINATORS as readonly string[]).includes(keys[0]!) ? (keys[0] as Combinator) : null
})
const rows = computed<unknown[]>(() => {
  const c = combinator.value
  const list = c && isObj(props.value) ? props.value[c] : null
  return Array.isArray(list) ? list : []
})
// A bare condition: its type, when the vocabulary knows it and its value fits
const bareType = computed<string | null>(() => {
  if (!props.bare || combinator.value || !isObj(props.value)) return null
  const keys = Object.keys(props.value)
  if (keys.length !== 1) return null
  const spec = props.vocabulary.conditions[keys[0]!]
  return spec && fitsParam(spec.param, props.value[keys[0]!]) ? keys[0]! : null
})
const rowsPath = computed<YamlPath>(() => [...props.path, combinator.value ?? 'all'])

type Row =
  | { kind: 'condition'; type: string; value: unknown }
  | { kind: 'group'; value: unknown }
  | { kind: 'raw'; value: unknown }
function read(row: unknown): Row {
  if (!isObj(row)) return { kind: 'raw', value: row }
  const keys = Object.keys(row)
  if (keys.length !== 1) return { kind: 'raw', value: row }
  const key = keys[0]!
  if ((COMBINATORS as readonly string[]).includes(key)) return props.depth < props.maxDepth ? { kind: 'group', value: row } : { kind: 'raw', value: row }
  const spec = props.vocabulary.conditions[key]
  return spec && fitsParam(spec.param, row[key]) ? { kind: 'condition', type: key, value: row[key] } : { kind: 'raw', value: row }
}

const apply = (change: (text: string) => string) => emit('apply', change)
const types = computed(() => Object.entries(props.vocabulary.conditions))
const label = (key: string) => {
  const l = props.vocabulary.conditions[key]?.label ?? key
  return tOr(l, l)
}

function switchCombinator(next: Combinator): void {
  const c = combinator.value
  if (!c || c === next) return
  apply((text) => renameKeyAt(text, props.path, c, next))
}
function changeType(i: number, type: string): void {
  const spec = props.vocabulary.conditions[type]
  if (!spec) return
  apply((text) => setAt(text, [...rowsPath.value, i], { [type]: defaultParam(spec.param) }))
}
function addCondition(type: string): void {
  const spec = props.vocabulary.conditions[type]
  if (!spec) return
  apply((text) => addItemAt(text, rowsPath.value, { [type]: defaultParam(spec.param) }))
}
function addGroup(): void {
  apply((text) => addItemAt(text, rowsPath.value, { any: [] }))
}
function remove(i: number): void {
  apply((text) => removeAt(text, [...rowsPath.value, i]))
}
// A bare condition's edits: the condition replaced, or wrapped in a group
function bareChangeType(type: string): void {
  const spec = props.vocabulary.conditions[type]
  if (spec) apply((text) => setAt(text, props.path, { [type]: defaultParam(spec.param) }))
}
function bareWrap(c: Combinator, extra?: unknown): void {
  apply((text) => setAt(text, props.path, { [c]: extra === undefined ? [props.value] : [props.value, extra] }))
}
function bareAdd(type: string): void {
  const spec = props.vocabulary.conditions[type]
  if (spec) bareWrap('all', { [type]: defaultParam(spec.param) })
}
const yamlOf = (v: unknown) => stringify(v, { lineWidth: 0 }).trimEnd()
</script>

<template>
  <div class="qd-rule-group" :data-depth="depth">
    <template v-if="bareType">
      <div class="qd-rule-group-head">
        <select class="p-inputtext p-component qd-rule-select qd-rule-combinator" :aria-label="t('combinator', 'Match')" :disabled="readOnly" data-combinator @change="bareWrap(($event.target as HTMLSelectElement).value as Combinator)">
          <option value="" selected disabled>{{ t('single', 'This condition') }}</option>
          <option value="all">{{ t('all', 'All of') }}</option>
          <option value="any">{{ t('any', 'Any of') }}</option>
        </select>
      </div>
      <ul class="qd-rule-rows">
        <li class="qd-rule-row" data-row="0" data-bare>
          <select class="p-inputtext p-component qd-rule-select qd-rule-type" :aria-label="t('conditionType', 'Condition')" :disabled="readOnly" @change="bareChangeType(($event.target as HTMLSelectElement).value)">
            <option v-for="[key] in types" :key="key" :value="key" :selected="key === bareType">{{ label(key) }}</option>
          </select>
          <QdRuleParam :param="vocabulary.conditions[bareType]!.param" :value="(value as Record<string, unknown>)[bareType]" :path="[...path, bareType]" :label="label(bareType)" :read-only="readOnly" @apply="apply" />
        </li>
      </ul>
      <div v-if="!readOnly" class="qd-rule-add">
        <select class="p-inputtext p-component qd-rule-select" :aria-label="t('addCondition', 'Add a condition')" data-add-condition @change="bareAdd(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).selectedIndex = 0">
          <option value="" selected disabled>{{ t('addCondition', 'Add a condition') }}</option>
          <option v-for="[key] in types" :key="key" :value="key">{{ label(key) }}</option>
        </select>
        <button v-if="depth < maxDepth" type="button" class="qd-rule-link" data-add-group @click="bareWrap('all', { any: [] })">{{ t('addGroup', 'Add a group') }}</button>
      </div>
    </template>
    <template v-else-if="combinator">
      <div class="qd-rule-group-head">
        <select class="p-inputtext p-component qd-rule-select qd-rule-combinator" :aria-label="t('combinator', 'Match')" :disabled="readOnly" data-combinator @change="switchCombinator(($event.target as HTMLSelectElement).value as Combinator)">
          <option value="all" :selected="combinator === 'all'">{{ t('all', 'All of') }}</option>
          <option value="any" :selected="combinator === 'any'">{{ t('any', 'Any of') }}</option>
        </select>
      </div>
      <ul class="qd-rule-rows">
        <li v-for="(row, i) in rows" :key="i" class="qd-rule-row" :data-row="i">
          <template v-if="read(row).kind === 'condition'">
            <select class="p-inputtext p-component qd-rule-select qd-rule-type" :aria-label="t('conditionType', 'Condition')" :disabled="readOnly" @change="changeType(i, ($event.target as HTMLSelectElement).value)">
              <option v-for="[key] in types" :key="key" :value="key" :selected="key === (read(row) as { type: string }).type">{{ label(key) }}</option>
            </select>
            <QdRuleParam
              :param="vocabulary.conditions[(read(row) as { type: string }).type]!.param"
              :value="(read(row) as { value: unknown }).value"
              :path="[...rowsPath, i, (read(row) as { type: string }).type]"
              :label="label((read(row) as { type: string }).type)"
              :read-only="readOnly"
              @apply="apply"
            />
          </template>
          <QdRuleGroup
            v-else-if="read(row).kind === 'group'"
            :value="row"
            :path="[...rowsPath, i]"
            :vocabulary="vocabulary"
            :depth="depth + 1"
            :max-depth="maxDepth"
            :read-only="readOnly"
            @apply="apply"
            @reveal="emit('reveal', $event)"
          />
          <div v-else class="qd-rule-raw" data-rule-raw>
            <pre>{{ yamlOf(row) }}</pre>
            <button type="button" class="qd-rule-link" @click="emit('reveal', [...rowsPath, i])">{{ t('editInText', 'Edit in the text') }}</button>
          </div>
          <button v-if="!readOnly" type="button" class="qd-rule-action" :aria-label="t('removeCondition', 'Remove this condition')" :title="t('removeCondition', 'Remove this condition')" data-remove-row @click="remove(i)">
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        </li>
      </ul>
      <div v-if="!readOnly" class="qd-rule-add">
        <select class="p-inputtext p-component qd-rule-select" :aria-label="t('addCondition', 'Add a condition')" data-add-condition @change="addCondition(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).selectedIndex = 0">
          <option value="" selected disabled>{{ t('addCondition', 'Add a condition') }}</option>
          <option v-for="[key] in types" :key="key" :value="key">{{ label(key) }}</option>
        </select>
        <button v-if="depth < maxDepth" type="button" class="qd-rule-link" data-add-group @click="addGroup">{{ t('addGroup', 'Add a group') }}</button>
      </div>
    </template>
    <div v-else class="qd-rule-raw" data-rule-raw>
      <pre>{{ yamlOf(value) }}</pre>
      <button type="button" class="qd-rule-link" @click="emit('reveal', path)">{{ t('editInText', 'Edit in the text') }}</button>
    </div>
  </div>
</template>
