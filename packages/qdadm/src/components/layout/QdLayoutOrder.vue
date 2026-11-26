<script setup lang="ts">
/**
 * QdLayoutOrder (#5526): a layout's shown items, in order, as a list: moved
 * by a handle (the pointer or the keyboard, the dashboards' useLayoutReorder),
 * hidden, removed when added, their parameters changed. `v-model` is the
 * layout; at most `max` are shown, the count said beside them.
 *
 * Runtime props (#5469): an app's JavaScript build compiles qdadm's .vue.
 */
import { computed, nextTick, ref, type PropType } from 'vue'
import CardParamsForm from './CardParamsForm.vue'
import { useI18n } from '../../i18n/useI18n'
import { useLayoutReorder } from '../../composables/useLayoutReorder'
import {
  effectiveCards,
  moveCard,
  removeInstance,
  setHidden,
  setParams,
  shownItems,
  type CardDef,
  type CardsArrangement,
} from '../../composables/useCardsArrangement'

const props = defineProps({
  modelValue: { type: Object as PropType<CardsArrangement>, required: true },
  /** The catalogue: the declared items, repeatable ones included */
  items: { type: Array as PropType<CardDef[]>, required: true },
  /** At most this many shown */
  max: { type: Number as PropType<number | null>, default: null },
  idPrefix: { type: String, default: 'qd-layout-order' },
})
const emit = defineEmits<{ (e: 'update:modelValue', layout: CardsArrangement): void }>()
const { tOr } = useI18n()

const root = ref<HTMLElement | null>(null)
const announcement = ref('')
const editing = ref<string | null>(null)
const all = computed(() => shownItems(props.modelValue, props.items))
const shown = computed(() => (props.max ? all.value.slice(0, props.max) : all.value))
const over = computed(() => (props.max ? all.value.slice(props.max) : []))
const byId = computed(() => new Map(effectiveCards(props.modelValue, props.items).map((c) => [c.id, c])))
const instanceOf = (id: string) => props.modelValue.instances.find((i) => i.id === id) ?? null
const templateOf = (id: string) => {
  const inst = instanceOf(id)
  return inst ? props.items.find((c) => c.id === inst.block) ?? null : null
}

/** An item's name; an added one's says its parameters: « Books of a genre · Sci-fi » */
function title(c: CardDef): string {
  const name = tOr(c.card.title, c.card.title)
  const inst = instanceOf(c.id)
  const props = templateOf(c.id)?.card.params?.properties
  if (!inst || inst.title || !props) return name
  const said = Object.entries(inst.params)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => {
      const labels = (props[k]?.enumLabels ?? {}) as Record<string, string>
      const label = labels[String(v)]
      return label ? tOr(label, label) : String(v)
    })
  return said.length ? `${name} · ${said.join(', ')}` : name
}

function update(next: CardsArrangement): boolean {
  if (next === props.modelValue) return false
  emit('update:modelValue', next)
  return true
}
function announce(text: string): void {
  announcement.value = ''
  void nextTick(() => (announcement.value = text))
}
/** An item's row: looked up by its data, any id as it is */
const rowOf = (id: string): HTMLElement | null => {
  const rows: HTMLElement[] = root.value ? Array.from(root.value.querySelectorAll<HTMLElement>('[data-layout-item]')) : []
  return rows.find((el) => el.dataset.layoutItem === id) ?? null
}
const handleOf = (id: string): HTMLElement | null => {
  const row = rowOf(id)
  return row ? (row.querySelector('.qd-layout-handle') as HTMLElement | null) : null
}

// The preview of a drag is local until it is dropped
let draft: CardsArrangement | null = null
const reorder = useLayoutReorder({
  group: () => all.value.map((c) => c.id),
  isFixed: (id) => !!byId.value.get(id)?.card.fixed,
  locate: rowOf,
  move: (id, to) => update(moveCard(props.modelValue, props.items, id, to)),
  preview: (id, to) => {
    draft = moveCard(draft ?? props.modelValue, props.items, id, to)
    emit('update:modelValue', draft)
  },
  snapshot: () => {
    const saved = props.modelValue
    draft = null
    return () => emit('update:modelValue', saved)
  },
  onMoved: (id) => {
    draft = null
    const c = byId.value.get(id)
    const position = all.value.findIndex((x) => x.id === id) + 1
    if (c) announce(tOr('core.cardsDashboard.moved', '{title}: card {position} of {total}', { title: title(c), position, total: all.value.length }))
    void nextTick(() => handleOf(id)?.focus())
  },
  onCancel: () => announce(tOr('core.cardsDashboard.dragCancelled', 'Move cancelled')),
})

function hide(c: CardDef): void {
  if (update(setHidden(props.modelValue, props.items, c.id, true))) announce(tOr('core.cardsDashboard.hiddenOne', '{title} hidden', { title: title(c) }))
}
function remove(c: CardDef): void {
  if (update(removeInstance(props.modelValue, c.id))) announce(tOr('core.cardsDashboard.removed', '{title} removed', { title: title(c) }))
}
function applyParams(c: CardDef, value: { params: Record<string, unknown>; title: string }): void {
  const t = templateOf(c.id)
  update(setParams(props.modelValue, props.items, c.id, value.params, t && value.title !== tOr(t.card.title, t.card.title) ? value.title : ''))
  editing.value = null
}
</script>

<template>
  <div ref="root" class="qd-layout-order">
    <p class="qd-layout-count" :class="{ 'qd-layout-count--over': over.length }">
      {{ max ? tOr('core.layout.countOf', '{count} of {max} shown', { count: shown.length, max }) : tOr('core.layout.count', '{count} shown', { count: shown.length }) }}
    </p>
    <ol class="qd-layout-list">
      <li
        v-for="c in all"
        :key="c.id"
        class="qd-layout-item"
        :class="{ 'qd-layout-item--over': over.includes(c), 'qd-layout-item--dragging': reorder.dragging.value === c.id }"
        :data-layout-item="c.id"
      >
        <div class="qd-layout-row">
          <button
            v-if="!c.card.fixed"
            type="button"
            class="qd-layout-handle"
            :aria-label="tOr('core.cardsDashboard.move', 'Move {title}', { title: title(c) })"
            @keydown="reorder.onHandleKey($event, c.id)"
            @pointerdown="reorder.onPointerDown($event, c.id)"
          >
            <i class="pi pi-bars" aria-hidden="true"></i>
          </button>
          <span class="qd-layout-title">{{ title(c) }}</span>
          <span v-if="over.includes(c)" class="qd-layout-over">{{ tOr('core.layout.overMax', 'beyond the maximum: not shown') }}</span>
          <button
            v-if="instanceOf(c.id) && templateOf(c.id)?.card.params"
            type="button"
            class="qd-layout-action"
            :aria-expanded="editing === c.id ? 'true' : 'false'"
            :aria-label="tOr('core.layout.params', 'Parameters of {title}', { title: title(c) })"
            :title="tOr('core.layout.params', 'Parameters of {title}', { title: title(c) })"
            data-layout-params
            @click="editing = editing === c.id ? null : c.id"
          >
            <i class="pi pi-sliders-h" aria-hidden="true"></i>
          </button>
          <button
            v-if="instanceOf(c.id)"
            type="button"
            class="qd-layout-action"
            :aria-label="tOr('core.cardsDashboard.remove', 'Remove {title}', { title: title(c) })"
            :title="tOr('core.cardsDashboard.remove', 'Remove {title}', { title: title(c) })"
            data-layout-remove
            @click="remove(c)"
          >
            <i class="pi pi-trash" aria-hidden="true"></i>
          </button>
          <button
            v-else-if="!c.card.required"
            type="button"
            class="qd-layout-action"
            :aria-label="tOr('core.cardsDashboard.hide', 'Hide {title}', { title: title(c) })"
            :title="tOr('core.cardsDashboard.hide', 'Hide {title}', { title: title(c) })"
            data-layout-hide
            @click="hide(c)"
          >
            <i class="pi pi-eye-slash" aria-hidden="true"></i>
          </button>
        </div>
        <CardParamsForm
          v-if="editing === c.id && templateOf(c.id)"
          :schema="templateOf(c.id)!.card.params ?? null"
          :title="title(c)"
          :initial="instanceOf(c.id)!.params"
          :submit-label="tOr('core.layout.apply', 'Apply')"
          :id-prefix="`${idPrefix}-${c.id}`"
          @submit="applyParams(c, $event)"
          @cancel="editing = null"
        />
      </li>
    </ol>
    <span class="qd-sr-only" aria-live="polite">{{ announcement }}</span>
  </div>
</template>
