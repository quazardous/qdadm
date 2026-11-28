<script setup lang="ts">
/**
 * QdRuleParam (#5581): one condition's or action's value, edited by its type:
 * a text, a number, a switch, a choice, a threshold (`>= 20%`) or a keyed
 * threshold (`{ refused_ratio: ">= 20%" }`). Each change is a patch of the
 * YAML at `path`, given to the builder.
 *
 * Runtime props (#5469): an app's JavaScript build compiles qdadm's .vue.
 */
import { computed, type PropType } from 'vue'
import { useI18n } from '../../../../i18n/useI18n'
import { OPERATORS, formatThreshold, parseThreshold, type ParamSpec, type Operator } from './vocabulary'
import { renameKeyAt, setAt, type YamlPath } from './ruleDoc'

const props = defineProps({
  param: { type: Object as PropType<ParamSpec>, required: true },
  // Any shape: the YAML's value
  value: null,
  /** Where the value is in the YAML */
  path: { type: Array as PropType<YamlPath>, required: true },
  label: { type: String, default: '' },
  readOnly: { type: Boolean, default: false },
})
const emit = defineEmits<{ (e: 'apply', change: (text: string) => string): void }>()
const { tOr } = useI18n()

const set = (value: unknown) => emit('apply', (text) => setAt(text, props.path, value))

// A threshold: the operator, the number, a % when the unit or the value says so
const threshold = computed(() => parseThreshold(props.value) ?? { op: '>=' as Operator, value: 0, percent: props.param.type === 'threshold' && props.param.unit === '%' })
function setThreshold(part: { op?: Operator; value?: number }): void {
  const t = threshold.value
  set(formatThreshold({ op: part.op ?? t.op, value: part.value ?? t.value, percent: t.percent }))
}

// A keyed threshold: its one key, and that key's threshold
const keyed = computed(() => {
  if (props.param.type !== 'keyedThreshold' || !props.value || typeof props.value !== 'object') return null
  const [key, raw] = Object.entries(props.value as Record<string, unknown>)[0] ?? []
  if (!key) return null
  const spec = props.param.keys.find((k) => k.value === key)
  const t = parseThreshold(raw) ?? { op: '>=' as Operator, value: 0, percent: spec?.unit === '%' }
  return { key, t }
})
function setKey(next: string): void {
  const k = keyed.value
  if (!k || next === k.key) return
  const spec = props.param.type === 'keyedThreshold' ? props.param.keys.find((x) => x.value === next) : undefined
  const percent = spec?.unit === '%'
  // The key renamed in place (its comment kept), then the unit fitted to it
  emit('apply', (text) => {
    const renamed = renameKeyAt(text, props.path, k.key, next)
    return percent === k.t.percent ? renamed : setAt(renamed, [...props.path, next], formatThreshold({ ...k.t, percent }))
  })
}
function setKeyed(part: { op?: Operator; value?: number }): void {
  const k = keyed.value
  if (!k) return
  emit('apply', (text) => setAt(text, [...props.path, k.key], formatThreshold({ op: part.op ?? k.t.op, value: part.value ?? k.t.value, percent: k.t.percent })))
}
const num = (e: Event) => {
  const n = Number((e.target as HTMLInputElement).value)
  return Number.isFinite(n) ? n : 0
}
const opLabel = (op: Operator) => op
</script>

<template>
  <span class="qd-rule-param" :data-param="param.type">
    <template v-if="param.type === 'text'">
      <input class="p-inputtext p-component qd-rule-input" :value="value ?? ''" :aria-label="label" :placeholder="param.placeholder" :disabled="readOnly" @change="set(($event.target as HTMLInputElement).value)" />
    </template>
    <template v-else-if="param.type === 'number'">
      <input class="p-inputtext p-component qd-rule-input qd-rule-number" type="number" :value="value ?? 0" :aria-label="label" :disabled="readOnly" @change="set(num($event))" />
    </template>
    <template v-else-if="param.type === 'boolean'">
      <input type="checkbox" :checked="value === true" :aria-label="label" :disabled="readOnly" @change="set(($event.target as HTMLInputElement).checked)" />
    </template>
    <template v-else-if="param.type === 'enum'">
      <select class="p-inputtext p-component qd-rule-select" :aria-label="label" :disabled="readOnly" @change="set(param.options[($event.target as HTMLSelectElement).selectedIndex]!.value)">
        <option v-for="o in param.options" :key="String(o.value)" :selected="String(o.value) === String(value)">{{ o.label ? tOr(o.label, o.label) : String(o.value) }}</option>
      </select>
    </template>
    <template v-else-if="param.type === 'threshold'">
      <select class="p-inputtext p-component qd-rule-select qd-rule-op" :aria-label="tOr('core.ruleBuilder.operator', 'Operator')" :disabled="readOnly" @change="setThreshold({ op: ($event.target as HTMLSelectElement).value as Operator })">
        <option v-for="op in OPERATORS" :key="op" :value="op" :selected="op === threshold.op">{{ opLabel(op) }}</option>
      </select>
      <input class="p-inputtext p-component qd-rule-input qd-rule-number" type="number" :value="threshold.value" :aria-label="label" :disabled="readOnly" @change="setThreshold({ value: num($event) })" />
      <span v-if="threshold.percent" class="qd-rule-unit">%</span>
    </template>
    <template v-else-if="param.type === 'keyedThreshold' && keyed">
      <select class="p-inputtext p-component qd-rule-select" :aria-label="label" :disabled="readOnly" data-keyed-key @change="setKey(($event.target as HTMLSelectElement).value)">
        <option v-for="k in param.keys" :key="k.value" :value="k.value" :selected="k.value === keyed.key">{{ k.label ? tOr(k.label, k.label) : k.value }}</option>
      </select>
      <select class="p-inputtext p-component qd-rule-select qd-rule-op" :aria-label="tOr('core.ruleBuilder.operator', 'Operator')" :disabled="readOnly" @change="setKeyed({ op: ($event.target as HTMLSelectElement).value as Operator })">
        <option v-for="op in OPERATORS" :key="op" :value="op" :selected="op === keyed.t.op">{{ opLabel(op) }}</option>
      </select>
      <input class="p-inputtext p-component qd-rule-input qd-rule-number" type="number" :value="keyed.t.value" :aria-label="tOr('core.ruleBuilder.threshold', 'Threshold')" :disabled="readOnly" data-keyed-value @change="setKeyed({ value: num($event) })" />
      <span v-if="keyed.t.percent" class="qd-rule-unit">%</span>
    </template>
  </span>
</template>
