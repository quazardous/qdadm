<script setup lang="ts">
/**
 * QdCardSizePicker (#5503): a card's size, width × height, picked on a small
 * grid as a word processor picks a table's: hover or drag from the top-left
 * lights the rectangle, a click or a release picks it. The sizes the card
 * does not accept are greyed out.
 *
 * Keyboard: the button opens it on the current size; the arrows move,
 * Enter or Space picks, Escape closes, the focus back on the button.
 *
 * Runtime props (#5469): an app's JavaScript build compiles qdadm's .vue.
 */
import { computed, nextTick, onBeforeUnmount, ref, type PropType } from 'vue'
import { useI18n } from '../../i18n/useI18n'

const props = defineProps({
  /** The current size, `'WxH'` */
  modelValue: { type: String, required: true },
  /** The sizes the card accepts, `'WxH'` */
  allowed: { type: Array as PropType<string[]>, required: true },
  /** Whose size it is, for the labels: the card's title */
  title: { type: String, default: '' },
  cols: { type: Number, default: 3 },
  rows: { type: Number, default: 2 },
})
const emit = defineEmits<{ (e: 'update:modelValue', size: string): void }>()
const { tOr } = useI18n()

const parts = (size: string) => {
  const [w, h] = size.split('x').map(Number)
  return { w: w || 1, h: h || 1 }
}
const current = computed(() => parts(props.modelValue))
const name = (w: number, h: number) => `${w}x${h}`
const accepts = (w: number, h: number) => props.allowed.includes(name(w, h))
const valueText = (w: number, h: number) => tOr('core.cardsDashboard.sizeValue', '{w} × {h}', { w, h })
const cellLabel = (w: number, h: number) =>
  tOr('core.cardsDashboard.sizeCell', '{w} wide, {h} high', { w, h }) +
  (accepts(w, h) ? '' : ` (${tOr('core.cardsDashboard.sizeUnavailable', 'not for this card')})`)

const open = ref(false)
/** The cell under the pointer or the keyboard focus: the rectangle lit */
const at = ref<{ w: number; h: number } | null>(null)
const lit = (w: number, h: number) => {
  const r = at.value ?? current.value
  return w <= r.w && h <= r.h
}

const button = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const cellEl = (w: number, h: number) => panel.value?.querySelector<HTMLButtonElement>(`[data-size="${name(w, h)}"]`) ?? null

async function show(): Promise<void> {
  open.value = true
  at.value = { ...current.value }
  document.addEventListener('pointerdown', onOutside, true)
  await nextTick()
  cellEl(current.value.w, current.value.h)?.focus()
}
function close(refocus = true): void {
  if (!open.value) return
  open.value = false
  at.value = null
  dragging = false
  document.removeEventListener('pointerdown', onOutside, true)
  if (refocus) void nextTick(() => button.value?.focus())
}
function toggle(): void {
  if (open.value) close()
  else void show()
}
function pick(w: number, h: number): void {
  // A release picks, then its click comes: once is enough
  if (!open.value || !accepts(w, h)) return
  if (name(w, h) !== props.modelValue) emit('update:modelValue', name(w, h))
  close()
}
function onOutside(e: PointerEvent): void {
  const t = e.target as Node | null
  if (t && (panel.value?.contains(t) || button.value?.contains(t))) return
  close(false)
}
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside, true))

// Drag: press on a cell, move across, release on the size wanted
let dragging = false
function cellAt(e: PointerEvent): { w: number; h: number } | null {
  const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-size]')
  if (!el || !panel.value?.contains(el)) return null
  return parts(el.dataset.size!)
}
function onDown(e: PointerEvent, w: number, h: number): void {
  dragging = true
  at.value = { w, h }
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
}
function onMove(e: PointerEvent): void {
  const c = cellAt(e)
  if (c) at.value = c
}
function onUp(e: PointerEvent): void {
  if (!dragging) return
  dragging = false
  const c = cellAt(e)
  if (c) pick(c.w, c.h)
}

function onKey(e: KeyboardEvent, w: number, h: number): void {
  const moves: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }
  const m = moves[e.key]
  if (m) {
    e.preventDefault()
    const nw = Math.min(props.cols, Math.max(1, w + m[0]))
    const nh = Math.min(props.rows, Math.max(1, h + m[1]))
    at.value = { w: nw, h: nh }
    cellEl(nw, nh)?.focus()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    close()
  } else if (e.key === 'Tab') {
    close(false)
  }
}
</script>

<template>
  <span class="qd-size-picker">
    <button
      ref="button"
      type="button"
      class="qd-size-picker-button"
      aria-haspopup="true"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-label="tOr('core.cardsDashboard.size', 'Size of {title}', { title }) + ': ' + valueText(current.w, current.h)"
      :title="tOr('core.cardsDashboard.size', 'Size of {title}', { title })"
      data-size-picker
      @click="toggle"
    >
      <span class="qd-size-picker-icon" aria-hidden="true" :style="{ '--cols': cols, '--rows': rows }">
        <span v-for="i in cols * rows" :key="i" :class="{ on: ((i - 1) % cols) + 1 <= current.w && Math.ceil(i / cols) <= current.h }"></span>
      </span>
      <span>{{ valueText(current.w, current.h) }}</span>
    </button>
    <div
      v-if="open"
      ref="panel"
      class="qd-size-picker-panel"
      role="group"
      :aria-label="tOr('core.cardsDashboard.size', 'Size of {title}', { title })"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointerleave="at = dragging ? at : null"
    >
      <div class="qd-size-picker-grid" :style="{ '--cols': cols, '--rows': rows }">
        <template v-for="h in rows" :key="h">
          <button
            v-for="w in cols"
            :key="`${w}x${h}`"
            type="button"
            class="qd-size-picker-cell"
            :class="{ lit: lit(w, h), off: !accepts(w, h), current: w === current.w && h === current.h }"
            :data-size="`${w}x${h}`"
            :aria-label="cellLabel(w, h)"
            :aria-pressed="w === current.w && h === current.h ? 'true' : 'false'"
            :aria-disabled="accepts(w, h) ? undefined : 'true'"
            :tabindex="(at ?? current).w === w && (at ?? current).h === h ? 0 : -1"
            @pointerdown="onDown($event, w, h)"
            @pointerenter="at = { w, h }"
            @click="pick(w, h)"
            @keydown="onKey($event, w, h)"
            @focus="at = { w, h }"
          ></button>
        </template>
      </div>
      <div class="qd-size-picker-value" aria-live="polite">
        {{ at ? valueText(at.w, at.h) : valueText(current.w, current.h) }}
        <span v-if="at && !accepts(at.w, at.h)" class="qd-size-picker-no">{{ tOr('core.cardsDashboard.sizeUnavailable', 'not for this card') }}</span>
      </div>
    </div>
  </span>
</template>
