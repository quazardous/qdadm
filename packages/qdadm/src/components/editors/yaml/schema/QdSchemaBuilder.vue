<script setup lang="ts">
/**
 * QdSchemaBuilder (#5587): a YAML document built by clicking, its structure
 * read from its JSON Schema. Each root list of objects is a section; each
 * item a card whose fields follow the schema; `x-…` annotations name the
 * title, the switch and the widgets, and the app's handlers draw the rest.
 * qdadm knows no business key. Every change is a patch of the text, so
 * comments, key order and layout survive; text, tree, form and builder stay
 * in step on one document.
 *
 * <QdSchemaBuilder :document="editor.document" :schema="schema" :handlers="{ regex: RegexField }" />
 * <QdSchemaBuilder v-model="yaml" :schema="schema" />
 *
 * Runtime props (#5469): an app's JavaScript build compiles qdadm's .vue.
 */
import { computed, onBeforeUnmount, ref, watch, type PropType } from 'vue'
import { parse } from 'yaml'
import type { YamlDocument, YamlPath } from '@quazardous/vanilla-yamleditor'
import { useI18n } from '../../../../i18n/useI18n'
import QdSchemaItems from './QdSchemaItems.vue'
import { sectionsOf } from './schemaModel'
import { provideSchemaBuilder, type SchemaHandlers } from './context'

const props = defineProps({
  /** A vanilla-yamleditor document to edit (YamlConfigEditor's); else `modelValue` */
  document: { type: Object as PropType<YamlDocument | null>, default: null },
  /** The YAML text, without a document */
  modelValue: { type: String, default: '' },
  /** The document's JSON Schema, its `x-…` annotations read */
  // Any shape: a JSON Schema
  schema: { type: Object as PropType<Record<string, unknown> | null>, default: null },
  /** The app's widgets, by their `x-widget` name: props value, path, schema, readOnly; emit update(value) or apply(patch) */
  handlers: { type: Object as PropType<SchemaHandlers>, default: () => ({}) },
  readOnly: { type: Boolean, default: false },
})
const emit = defineEmits<{
  (e: 'update:modelValue', text: string): void
  /** « Edit in the text »: the path to show in the text view */
  (e: 'reveal', path: YamlPath): void
}>()
const { tOr } = useI18n()
const t = (key: string, fallback: string, params?: Record<string, unknown>) => tOr(`core.schemaBuilder.${key}`, fallback, params as never)
const rt = (key: string, fallback: string, params?: Record<string, unknown>) => tOr(`core.ruleBuilder.${key}`, fallback, params as never)

// The text: the document's, followed; or the v-model
const docText = ref(props.document?.get() ?? '')
let stop: (() => void) | null = null
watch(
  () => props.document,
  (doc) => {
    stop?.()
    stop = null
    if (!doc) return
    docText.value = doc.get()
    stop = doc.subscribe(() => (docText.value = doc.get()))
  },
  { immediate: true }
)
onBeforeUnmount(() => stop?.())
const text = computed(() => (props.document ? docText.value : props.modelValue))
const value = computed<unknown>(() => {
  try {
    return parse(text.value || '') ?? null
  } catch {
    return undefined
  }
})

const failure = ref<string | null>(null)
function apply(change: (text: string) => string): void {
  failure.value = null
  let next: string
  try {
    next = change(text.value)
  } catch (err) {
    failure.value = err instanceof Error ? err.message : String(err)
    return
  }
  if (next === text.value) return
  if (props.document) props.document.edit(() => next, 'qd-schema-builder')
  else emit('update:modelValue', next)
}
provideSchemaBuilder({
  apply,
  root: () => props.schema,
  handlers: () => props.handlers,
  readOnly: () => props.readOnly,
  reveal: (path) => emit('reveal', path),
})

const sections = computed(() => sectionsOf(props.schema))
const current = ref('')
const active = computed(() => sections.value.find((s) => s.key === current.value) ?? sections.value[0] ?? null)
const listAt = (path: YamlPath): unknown => {
  let v = value.value
  for (const k of path) v = v && typeof v === 'object' ? (v as Record<string | number, unknown>)[k as never] : undefined
  return v
}
const count = (path: YamlPath) => {
  const v = listAt(path)
  return Array.isArray(v) ? v.length : 0
}
const label = (l: string) => (l ? tOr(l, l) : '')
</script>

<template>
  <div class="qd-rule-builder qd-schema-builder">
    <p v-if="value === undefined" class="qd-rule-note" data-rule-unparsable>{{ rt('unparsable', 'The YAML has syntax errors: fix them in the text first.') }}</p>
    <p v-else-if="!sections.length" class="qd-rule-note" data-schema-empty>{{ t('noSections', 'The schema has no list to build.') }}</p>
    <template v-else>
      <p v-if="failure" class="qd-rule-note qd-rule-note--error" role="alert">{{ rt('failed', 'That change could not be made: {error}', { error: failure }) }}</p>
      <div v-if="sections.length > 1" class="qd-schema-sections" role="tablist">
        <button
          v-for="s in sections"
          :key="s.key"
          type="button"
          role="tab"
          class="qd-schema-section-tab"
          :class="{ 'qd-schema-section-tab--active': s === active }"
          :aria-selected="s === active"
          :data-section-tab="s.key"
          @click="current = s.key"
        >
          {{ label(s.label) }} <span class="qd-schema-section-count">{{ count(s.path) }}</span>
        </button>
      </div>
      <QdSchemaItems v-if="active" :key="active.key" :section="active" :value="listAt(active.path)" />
    </template>
  </div>
</template>
