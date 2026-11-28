<script setup lang="ts">
/**
 * QdSchemaItems (#5587): one section, a list of objects: each item a card
 * (its title from `x-title`, its switch from `x-enabled`), its fields by the
 * items' schema; added, duplicated, reordered (drag, keyboard), removed.
 *
 * Runtime props (#5469): an app's JavaScript build compiles qdadm's .vue.
 */
import { computed, ref, shallowRef, type PropType } from 'vue'
import { useI18n } from '../../../../i18n/useI18n'
import { useLayoutReorder } from '../../../../composables/useLayoutReorder'
import { addKeyAt, duplicateItem, moveItem, removeAt, setAt } from '../rules/ruleDoc'
import QdSchemaFields from './QdSchemaFields.vue'
import { addListItem, newItem, type Section } from './schemaModel'
import { useSchemaBuilder } from './context'
import type { YamlPath } from '@quazardous/vanilla-yamleditor'

const props = defineProps({
  section: { type: Object as PropType<Section>, required: true },
  // Any shape: the YAML's list
  value: null,
})
const ctx = useSchemaBuilder()
const { tOr } = useI18n()
const t = (key: string, fallback: string, params?: Record<string, unknown>) => tOr(`core.schemaBuilder.${key}`, fallback, params as never)
const rt = (key: string, fallback: string, params?: Record<string, unknown>) => tOr(`core.ruleBuilder.${key}`, fallback, params as never)

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const items = computed<unknown[]>(() => (Array.isArray(props.value) ? props.value : []))
const titleKey = computed(() => (typeof props.section.items['x-title'] === 'string' ? (props.section.items['x-title'] as string) : null))
const enabledKey = computed(() => (typeof props.section.items['x-enabled'] === 'string' ? (props.section.items['x-enabled'] as string) : null))
const exclude = computed(() => [titleKey.value, enabledKey.value].filter((k): k is string => !!k))
const itemPath = (i: number): YamlPath => [...props.section.path, i]
const title = (item: unknown, i: number) => {
  const v = titleKey.value && isObj(item) ? item[titleKey.value] : undefined
  return typeof v === 'string' && v ? v : t('item', 'Item {n}', { n: i + 1 })
}
const enabled = (item: unknown) => !(enabledKey.value && isObj(item) && item[enabledKey.value] === false)

function setEnabled(i: number, on: boolean): void {
  const key = enabledKey.value
  const item = items.value[i]
  if (!key || !isObj(item)) return
  if (key in item) ctx.apply((text) => setAt(text, [...itemPath(i), key], on))
  else if (!on) ctx.apply((text) => addKeyAt(text, itemPath(i), key, false))
}
function add(): void {
  const item = newItem(props.section.items, ctx.root(), t('newItem', 'New item'), Object.keys(ctx.handlers()))
  ctx.apply((text) => addListItem(text, props.section.path, item))
}

// ── Order: drag and drop, the keyboard ──────────────────────────────────────
const root = ref<HTMLElement | null>(null)
const draft = shallowRef<number[] | null>(null)
const order = computed(() => draft.value ?? items.value.map((_, i) => i))
let keyboard = false
const reorder = useLayoutReorder({
  group: () => order.value.map(String),
  locate: (id) => root.value?.querySelector<HTMLElement>(`:scope > ol > [data-item="${id}"]`) ?? null,
  move: (id, to) => {
    const from = Number(id)
    if (from === to || to < 0 || to >= items.value.length) return false
    ctx.apply((text) => moveItem(text, props.section.path, from, to))
    return true
  },
  preview: (id, to) => {
    const list = [...order.value]
    list.splice(list.indexOf(Number(id)), 1)
    list.splice(to, 0, Number(id))
    draft.value = list
  },
  snapshot: () => () => (draft.value = null),
  onMoved: (id) => {
    const from = Number(id)
    const to = order.value.indexOf(from)
    draft.value = null
    if (!keyboard && to !== from && to !== -1) ctx.apply((text) => moveItem(text, props.section.path, from, to))
  },
})
function onHandleKey(e: KeyboardEvent, i: number): void {
  keyboard = true
  reorder.onHandleKey(e, String(i))
  keyboard = false
}
</script>

<template>
  <div ref="root" class="qd-schema-items" :data-section="section.key">
    <p v-if="!items.length" class="qd-rule-note">{{ t('empty', 'No item yet.') }}</p>
    <ol class="qd-rule-list">
      <li
        v-for="i in order"
        :key="i"
        class="qd-rule-card"
        :class="{ 'qd-rule-card--off': !enabled(items[i]), 'qd-rule-card--dragging': reorder.dragging.value === String(i) }"
        :data-item="i"
      >
        <div class="qd-rule-head">
          <button v-if="!ctx.readOnly()" type="button" class="qd-rule-handle" :aria-label="rt('move', 'Move {name}', { name: title(items[i], i) })" @keydown="onHandleKey($event, i)" @pointerdown="reorder.onPointerDown($event, String(i))">
            <i class="pi pi-bars" aria-hidden="true"></i>
          </button>
          <input
            v-if="titleKey"
            class="p-inputtext p-component qd-rule-name"
            :value="isObj(items[i]) && typeof (items[i] as Record<string, unknown>)[titleKey] === 'string' ? (items[i] as Record<string, unknown>)[titleKey] : ''"
            :placeholder="title(items[i], i)"
            :aria-label="rt('name', 'Name')"
            :disabled="ctx.readOnly()"
            data-item-title
            @change="ctx.apply((text) => setAt(text, [...itemPath(i), titleKey!], ($event.target as HTMLInputElement).value))"
          />
          <span v-else class="qd-schema-item-title">{{ title(items[i], i) }}</span>
          <label v-if="enabledKey" class="qd-rule-enabled">
            <input type="checkbox" :checked="enabled(items[i])" :disabled="ctx.readOnly()" data-item-enabled @change="setEnabled(i, ($event.target as HTMLInputElement).checked)" />
            {{ rt('enabled', 'Enabled') }}
          </label>
          <button v-if="!ctx.readOnly()" type="button" class="qd-rule-action" :aria-label="rt('duplicate', 'Duplicate {name}', { name: title(items[i], i) })" :title="rt('duplicate', 'Duplicate {name}', { name: title(items[i], i) })" data-item-duplicate @click="ctx.apply((text) => duplicateItem(text, section.path, i, rt('copySuffix', ' (copy)'), titleKey))">
            <i class="pi pi-copy" aria-hidden="true"></i>
          </button>
          <button v-if="!ctx.readOnly()" type="button" class="qd-rule-action" :aria-label="rt('remove', 'Remove {name}', { name: title(items[i], i) })" :title="rt('remove', 'Remove {name}', { name: title(items[i], i) })" data-item-remove @click="ctx.apply((text) => removeAt(text, itemPath(i)))">
            <i class="pi pi-trash" aria-hidden="true"></i>
          </button>
        </div>
        <QdSchemaFields v-if="isObj(items[i])" :value="items[i]" :schema="section.items" :path="itemPath(i)" :exclude="exclude" />
      </li>
    </ol>
    <button v-if="!ctx.readOnly()" type="button" class="qd-rule-link qd-rule-add-rule" data-item-add @click="add">
      <i class="pi pi-plus" aria-hidden="true"></i> {{ t('addItem', 'Add an item') }}
    </button>
  </div>
</template>
