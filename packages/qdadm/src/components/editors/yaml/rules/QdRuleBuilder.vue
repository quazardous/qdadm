<script setup lang="ts">
/**
 * QdRuleBuilder (#5581): a list of rules, each `name`, `enabled`, `when`
 * (all / any, nested) and `then` (actions), built by clicking. It edits the
 * YAML document itself: every change is a patch, so a rule's comments, key
 * order and layout survive. Text, tree, form and builder stay in step on one
 * document.
 *
 * <QdRuleBuilder :document="editor.document" :vocabulary="vocabulary" />   on a vanilla-yamleditor document
 * <QdRuleBuilder v-model="yaml" :vocabulary="vocabulary" />               on a text
 *
 * Runtime props (#5469): an app's JavaScript build compiles qdadm's .vue.
 */
import { computed, onBeforeUnmount, ref, shallowRef, watch, type PropType } from 'vue'
import { parse } from 'yaml'
import type { YamlDocument } from '@quazardous/vanilla-yamleditor'
import { useI18n } from '../../../../i18n/useI18n'
import { useLayoutReorder } from '../../../../composables/useLayoutReorder'
import QdRuleGroup from './QdRuleGroup.vue'
import QdRuleParam from './QdRuleParam.vue'
import { defaultParam, fitsParam, type RuleVocabulary } from './vocabulary'
import { addKeyAt, addRule, duplicateItem, moveItem, removeAt, setAt, setEnabled, type YamlPath } from './ruleDoc'

const props = defineProps({
  /** A vanilla-yamleditor document to edit (YamlConfigEditor's); else `modelValue` */
  document: { type: Object as PropType<YamlDocument | null>, default: null },
  /** The YAML text, without a document */
  modelValue: { type: String, default: '' },
  /** Where the rule list is in the document (default the root) */
  path: { type: Array as PropType<YamlPath>, default: () => [] },
  vocabulary: { type: Object as PropType<RuleVocabulary>, required: true },
  /** Groups nested deeper show as YAML, read-only */
  maxDepth: { type: Number, default: 3 },
  readOnly: { type: Boolean, default: false },
})
const emit = defineEmits<{
  (e: 'update:modelValue', text: string): void
  /** « Edit in the text »: the path to show in the text view */
  (e: 'reveal', path: YamlPath): void
}>()
const { tOr } = useI18n()
const t = (key: string, fallback: string, params?: Record<string, unknown>) => tOr(`core.ruleBuilder.${key}`, fallback, params as never)

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

const failure = ref<string | null>(null)
const value = computed<unknown>(() => {
  try {
    return parse(text.value || '') ?? null
  } catch {
    return undefined
  }
})
const listValue = computed<unknown>(() => {
  let v = value.value
  for (const k of props.path) v = v && typeof v === 'object' ? (v as Record<string | number, unknown>)[k as never] : undefined
  return v
})
const rules = computed<Array<Record<string, unknown>>>(() => (Array.isArray(listValue.value) ? (listValue.value as Array<Record<string, unknown>>) : []))
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** A patch of the text: through the document (every view follows), or the v-model */
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
  if (props.document) props.document.edit(() => next, 'qd-rule-builder')
  else emit('update:modelValue', next)
}

const rulePath = (i: number): YamlPath => [...props.path, i]
const name = (r: Record<string, unknown>, i: number) => (typeof r.name === 'string' && r.name ? r.name : t('unnamed', 'Rule {n}', { n: i + 1 }))
const enabled = (r: Record<string, unknown>) => r.enabled !== false

function addNew(): void {
  const template = props.vocabulary.template ?? { name: t('newRule', 'New rule'), when: { all: [] }, then: {} }
  apply((text) => addRule(text, props.path, template, listValue.value))
}

// ── Order: drag and drop, the keyboard (the layouts' reorder) ───────────────
const root = ref<HTMLElement | null>(null)
/** While dragging: the order shown, the document untouched until the drop */
const draft = shallowRef<number[] | null>(null)
const order = computed(() => draft.value ?? rules.value.map((_, i) => i))
const cardOf = (id: string) => root.value?.querySelector<HTMLElement>(`[data-rule="${id}"]`) ?? null
let dragFrom: number | null = null
const reorder = useLayoutReorder({
  group: () => order.value.map(String),
  locate: cardOf,
  move: (id, to) => {
    const from = Number(id)
    if (from === to || to < 0 || to >= rules.value.length) return false
    apply((text) => moveItem(text, props.path, from, to))
    return true
  },
  preview: (id, to) => {
    const list = [...order.value]
    const at = list.indexOf(Number(id))
    list.splice(at, 1)
    list.splice(to, 0, Number(id))
    draft.value = list
  },
  snapshot: () => {
    dragFrom = null
    return () => (draft.value = null)
  },
  onMoved: (id) => {
    const from = Number(id)
    const to = order.value.indexOf(from)
    draft.value = null
    if (dragFrom === null && to !== from && to !== -1) apply((text) => moveItem(text, props.path, from, to))
  },
})
function onHandleKey(e: KeyboardEvent, i: number): void {
  // The keyboard moves at once: no drag in progress
  dragFrom = i
  reorder.onHandleKey(e, String(i))
  dragFrom = null
}

// ── Actions ──────────────────────────────────────────────────────────────────
const actionKeys = computed(() => Object.keys(props.vocabulary.actions))
const actionLabel = (key: string) => {
  const l = props.vocabulary.actions[key]?.label ?? key
  return tOr(l, l)
}
function actionsOf(r: Record<string, unknown>): Array<{ key: string; value: unknown; known: boolean }> {
  return isObj(r.then) ? Object.entries(r.then).map(([key, v]) => ({ key, value: v, known: !!props.vocabulary.actions[key] && fitsParam(props.vocabulary.actions[key]!.param, v) })) : []
}
function addAction(i: number, r: Record<string, unknown>, key: string): void {
  const spec = props.vocabulary.actions[key]
  if (!spec) return
  const v = defaultParam(spec.param)
  apply((text) => (isObj(r.then) ? addKeyAt(text, [...rulePath(i), 'then'], key, v) : r.then === undefined ? addKeyAt(text, rulePath(i), 'then', { [key]: v }) : setAt(text, [...rulePath(i), 'then'], { [key]: v })))
}
function addWhen(i: number): void {
  apply((text) => addKeyAt(text, rulePath(i), 'when', { all: [] }))
}
</script>

<template>
  <div ref="root" class="qd-rule-builder">
    <p v-if="value === undefined" class="qd-rule-note" data-rule-unparsable>{{ t('unparsable', 'The YAML has syntax errors: fix them in the text first.') }}</p>
    <template v-else>
      <p v-if="failure" class="qd-rule-note qd-rule-note--error" role="alert">{{ t('failed', 'That change could not be made: {error}', { error: failure }) }}</p>
      <p v-if="!rules.length" class="qd-rule-note">{{ t('empty', 'No rule yet.') }}</p>
      <ol class="qd-rule-list">
        <li
          v-for="i in order"
          :key="i"
          class="qd-rule-card"
          :class="{ 'qd-rule-card--off': !enabled(rules[i]!), 'qd-rule-card--dragging': reorder.dragging.value === String(i) }"
          :data-rule="i"
        >
          <div class="qd-rule-head">
            <button
              v-if="!readOnly"
              type="button"
              class="qd-rule-handle"
              :aria-label="t('move', 'Move {name}', { name: name(rules[i]!, i) })"
              @keydown="onHandleKey($event, i)"
              @pointerdown="reorder.onPointerDown($event, String(i))"
            >
              <i class="pi pi-bars" aria-hidden="true"></i>
            </button>
            <input
              class="p-inputtext p-component qd-rule-name"
              :value="typeof rules[i]!.name === 'string' ? rules[i]!.name : ''"
              :placeholder="name(rules[i]!, i)"
              :aria-label="t('name', 'Name')"
              :disabled="readOnly"
              data-rule-name
              @change="apply((text) => setAt(text, [...rulePath(i), 'name'], ($event.target as HTMLInputElement).value))"
            />
            <label class="qd-rule-enabled">
              <input type="checkbox" :checked="enabled(rules[i]!)" :disabled="readOnly" data-rule-enabled @change="apply((text) => setEnabled(text, rulePath(i), rules[i]!, ($event.target as HTMLInputElement).checked))" />
              {{ t('enabled', 'Enabled') }}
            </label>
            <button v-if="!readOnly" type="button" class="qd-rule-action" :aria-label="t('duplicate', 'Duplicate {name}', { name: name(rules[i]!, i) })" :title="t('duplicate', 'Duplicate {name}', { name: name(rules[i]!, i) })" data-rule-duplicate @click="apply((text) => duplicateItem(text, path, i, t('copySuffix', ' (copy)')))">
              <i class="pi pi-copy" aria-hidden="true"></i>
            </button>
            <button v-if="!readOnly" type="button" class="qd-rule-action" :aria-label="t('remove', 'Remove {name}', { name: name(rules[i]!, i) })" :title="t('remove', 'Remove {name}', { name: name(rules[i]!, i) })" data-rule-remove @click="apply((text) => removeAt(text, rulePath(i)))">
              <i class="pi pi-trash" aria-hidden="true"></i>
            </button>
          </div>

          <section class="qd-rule-when">
            <h4>{{ t('when', 'When') }}</h4>
            <QdRuleGroup
              v-if="rules[i]!.when !== undefined"
              :value="rules[i]!.when"
              :path="[...rulePath(i), 'when']"
              :vocabulary="vocabulary"
              :max-depth="maxDepth"
              :read-only="readOnly"
              @apply="apply"
              @reveal="emit('reveal', $event)"
            />
            <button v-else-if="!readOnly" type="button" class="qd-rule-link" @click="addWhen(i)">{{ t('addConditions', 'Add conditions') }}</button>
          </section>

          <section class="qd-rule-then">
            <h4>{{ t('then', 'Then') }}</h4>
            <ul class="qd-rule-rows">
              <li v-for="a in actionsOf(rules[i]!)" :key="a.key" class="qd-rule-row" :data-action="a.key">
                <template v-if="a.known">
                  <span class="qd-rule-action-label">{{ actionLabel(a.key) }}</span>
                  <QdRuleParam :param="vocabulary.actions[a.key]!.param" :value="a.value" :path="[...rulePath(i), 'then', a.key]" :label="actionLabel(a.key)" :read-only="readOnly" @apply="apply" />
                </template>
                <div v-else class="qd-rule-raw" data-rule-raw>
                  <pre>{{ a.key }}: {{ typeof a.value === 'object' ? JSON.stringify(a.value) : a.value }}</pre>
                  <button type="button" class="qd-rule-link" @click="emit('reveal', [...rulePath(i), 'then', a.key])">{{ t('editInText', 'Edit in the text') }}</button>
                </div>
                <button v-if="!readOnly" type="button" class="qd-rule-action" :aria-label="t('removeAction', 'Remove this action')" :title="t('removeAction', 'Remove this action')" @click="apply((text) => removeAt(text, [...rulePath(i), 'then', a.key]))">
                  <i class="pi pi-times" aria-hidden="true"></i>
                </button>
              </li>
            </ul>
            <select
              v-if="!readOnly && actionKeys.some((k) => !actionsOf(rules[i]!).some((a) => a.key === k))"
              class="p-inputtext p-component qd-rule-select"
              :aria-label="t('addAction', 'Add an action')"
              data-add-action
              @change="addAction(i, rules[i]!, ($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).selectedIndex = 0"
            >
              <option value="" selected disabled>{{ t('addAction', 'Add an action') }}</option>
              <option v-for="k in actionKeys.filter((k) => !actionsOf(rules[i]!).some((a) => a.key === k))" :key="k" :value="k">{{ actionLabel(k) }}</option>
            </select>
          </section>
        </li>
      </ol>
      <button v-if="!readOnly" type="button" class="qd-rule-link qd-rule-add-rule" data-rule-add @click="addNew">
        <i class="pi pi-plus" aria-hidden="true"></i> {{ t('addRule', 'Add a rule') }}
      </button>
    </template>
  </div>
</template>
