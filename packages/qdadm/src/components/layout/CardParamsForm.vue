<script setup lang="ts">
/**
 * CardParamsForm (#5348): the small form CardsDashboard's catalogue draws
 * from a repeatable card's `params` schema, to add it.
 *
 * One field per property: a choice for an `enum` (labels from `enumLabels`,
 * keyed by value), a number for `number` / `integer`, yes / no for
 * `boolean`, text otherwise. Each with its `title` (else its key) and its
 * `description`. The values are checked against the schema before `submit`.
 */
import { computed, reactive, ref } from 'vue'
import QdButton from '../base/QdButton.vue'
import { useI18n } from '../../i18n/useI18n'
import { validateCardData, type CardSchema } from '../../cards/validate'

const props = withDefaults(
  defineProps<{
    schema?: CardSchema | null
    /** The card's title, as the person may change it */
    title: string
    /** The sections to choose from; none: no choice */
    sections?: Array<{ id: string; title: string }>
    idPrefix: string
  }>(),
  { schema: null, sections: () => [] }
)

const emit = defineEmits<{
  (e: 'submit', value: { params: Record<string, unknown>; title: string; section: string | null }): void
  (e: 'cancel'): void
}>()

const { tOr } = useI18n()

type Kind = 'choice' | 'number' | 'boolean' | 'text'
interface Field {
  key: string
  kind: Kind
  label: string
  description?: string
  required: boolean
  options: Array<{ value: unknown; label: string }>
  integer: boolean
}

const fields = computed<Field[]>(() =>
  Object.entries(props.schema?.properties ?? {}).map(([key, p]) => {
    const types = Array.isArray(p.type) ? p.type : [p.type]
    const labels = (p.enumLabels ?? {}) as Record<string, string>
    const kind: Kind = Array.isArray(p.enum) ? 'choice' : types.includes('boolean') ? 'boolean' : types.some((t) => t === 'number' || t === 'integer') ? 'number' : 'text'
    return {
      key,
      kind,
      label: tOr(p.title ?? key, p.title ?? key),
      ...(p.description ? { description: tOr(p.description, p.description) } : {}),
      required: (props.schema?.required ?? []).includes(key),
      options: (p.enum ?? []).map((v) => ({ value: v, label: tOr(labels[String(v)] ?? String(v), labels[String(v)] ?? String(v)) })),
      integer: types.includes('integer'),
    }
  })
)

const values = reactive<Record<string, unknown>>(
  Object.fromEntries(Object.entries(props.schema?.properties ?? {}).map(([key, p]) => [key, p.default ?? (p.type === 'boolean' ? false : '')]))
)
const title = ref(props.title)
const section = ref<string | null>(props.sections[0]?.id ?? null)
const problems = ref<Record<string, string>>({})

/** The values as the schema wants them: numbers as numbers, empty as absent */
function collect(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields.value) {
    const v = values[f.key]
    if (v === '' || v === null || v === undefined) continue
    if (f.kind === 'number') {
      const n = Number(v)
      out[f.key] = Number.isNaN(n) ? v : n
    } else if (f.kind === 'choice') {
      // A select gives strings: back to the enum's own value
      out[f.key] = f.options.find((o) => String(o.value) === String(v))?.value ?? v
    } else out[f.key] = v
  }
  return out
}

function submit(): void {
  const params = collect()
  const found: Record<string, string> = {}
  if (props.schema) {
    for (const p of validateCardData(params, props.schema, 'params')) {
      const key = p.path.replace(/^params\.?/, '').split(/[.[]/)[0] || '_'
      found[key] ??= p.message === 'is required' ? tOr('core.cardsDashboard.paramRequired', 'Fill this in') : tOr('core.cardsDashboard.paramInvalid', 'Not a valid value: {problem}', { problem: p.message })
    }
  }
  problems.value = found
  if (Object.keys(found).length) {
    const first = fields.value.find((f) => found[f.key])
    if (first) document.getElementById(`${props.idPrefix}-${first.key}`)?.focus()
    return
  }
  emit('submit', { params, title: title.value.trim() || props.title, section: section.value })
}
</script>

<template>
  <form class="qd-card-params" novalidate @submit.prevent="submit">
    <div class="qd-card-params-field">
      <label :for="`${idPrefix}-title`">{{ tOr('core.cardsDashboard.cardTitle', 'Title') }}</label>
      <input :id="`${idPrefix}-title`" v-model="title" type="text" class="p-inputtext p-component" />
    </div>
    <div v-for="f in fields" :key="f.key" class="qd-card-params-field" :class="{ 'qd-card-params-check': f.kind === 'boolean' }">
      <template v-if="f.kind === 'boolean'">
        <input :id="`${idPrefix}-${f.key}`" v-model="values[f.key]" type="checkbox" :aria-describedby="f.description ? `${idPrefix}-${f.key}-help` : undefined" />
        <label :for="`${idPrefix}-${f.key}`">{{ f.label }}</label>
      </template>
      <template v-else>
        <label :for="`${idPrefix}-${f.key}`">{{ f.label }}<span v-if="f.required" aria-hidden="true"> *</span></label>
        <select
          v-if="f.kind === 'choice'"
          :id="`${idPrefix}-${f.key}`"
          v-model="values[f.key]"
          class="p-inputtext p-component"
          :required="f.required"
          :aria-invalid="problems[f.key] ? 'true' : undefined"
          :aria-describedby="[f.description ? `${idPrefix}-${f.key}-help` : '', problems[f.key] ? `${idPrefix}-${f.key}-error` : ''].filter(Boolean).join(' ') || undefined"
        >
          <option value="">{{ tOr('core.cardsDashboard.choose', 'Choose…') }}</option>
          <option v-for="o in f.options" :key="String(o.value)" :value="String(o.value)">{{ o.label }}</option>
        </select>
        <input
          v-else
          :id="`${idPrefix}-${f.key}`"
          v-model="values[f.key]"
          :type="f.kind === 'number' ? 'number' : 'text'"
          :step="f.integer ? 1 : 'any'"
          class="p-inputtext p-component"
          :required="f.required"
          :aria-invalid="problems[f.key] ? 'true' : undefined"
          :aria-describedby="[f.description ? `${idPrefix}-${f.key}-help` : '', problems[f.key] ? `${idPrefix}-${f.key}-error` : ''].filter(Boolean).join(' ') || undefined"
        />
      </template>
      <small v-if="f.description" :id="`${idPrefix}-${f.key}-help`" class="qd-card-params-help">{{ f.description }}</small>
      <small v-if="problems[f.key]" :id="`${idPrefix}-${f.key}-error`" class="qd-card-params-error">{{ problems[f.key] }}</small>
    </div>
    <div v-if="sections.length > 1" class="qd-card-params-field">
      <label :for="`${idPrefix}-section`">{{ tOr('core.cardsDashboard.inSection', 'In the section') }}</label>
      <select :id="`${idPrefix}-section`" v-model="section" class="p-inputtext p-component">
        <option v-for="s in sections" :key="s.id" :value="s.id">{{ s.title }}</option>
      </select>
    </div>
    <div class="qd-card-params-actions">
      <QdButton type="submit" size="small" icon="pi pi-plus" :label="tOr('core.cardsDashboard.add', 'Add')" />
      <QdButton type="button" size="small" text :label="tOr('core.actions.cancel', 'Cancel')" @click="emit('cancel')" />
    </div>
  </form>
</template>
