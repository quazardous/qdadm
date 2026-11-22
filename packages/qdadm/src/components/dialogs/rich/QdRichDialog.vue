<script setup lang="ts">
/**
 * QdRichDialog - a generic rich dialog (#5445)
 *
 * A modal with a title, a scrolling area of stacked blocks (each drawn by the
 * content handler its `kind` names), and an action area: declared controls
 * on the left (toggle, checkbox, or the app's own), declared buttons on the
 * right, or the app's whole footer (`#footer`) or buttons (`#actions`).
 * `readToEnd` keeps the `requiresRead` buttons disabled until the content was
 * scrolled to its end; a required control keeps them disabled while empty.
 * No business meaning: what's new, a licence or a charter are uses of it.
 *
 *   <QdRichDialog v-model:visible="open" title="Terms" read-to-end :dismissable="false"
 *     :blocks="[{ kind: 'markdown', source }]"
 *     :actions="[{ key: 'decline', label: 'Decline' }, { key: 'accept', label: 'I accept', requiresRead: true }]"
 *     @action="onChoice" />
 */
import { computed, nextTick, onBeforeUnmount, provide, reactive, ref, useId, watch } from 'vue'
import Dialog from 'primevue/dialog'
import QdButton from '../../base/QdButton.vue'
import { useI18n } from '../../../i18n/useI18n'
import { getDialogContent, getDialogControl } from './registry'
import { RICH_PENDING } from './context'
import type { RichDialogAction, RichDialogBlock, RichDialogControl, RichDialogFooterProps, RichDialogResult } from './types'

const props = withDefaults(
  defineProps<{
    visible?: boolean
    title: string
    icon?: string
    width?: string
    maxHeight?: string
    blocks?: RichDialogBlock[]
    actions?: RichDialogAction[]
    controls?: RichDialogControl[]
    readToEnd?: boolean
    dismissable?: boolean
  }>(),
  { visible: false, width: '40rem', maxHeight: '60vh', blocks: () => [], actions: () => [], controls: () => [], readToEnd: false, dismissable: true }
)
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  /** A button chosen, or `resolve()` from the app's footer */
  (e: 'action', r: RichDialogResult): void
  /** Dismissed: Escape, ×, or `close()` */
  (e: 'close', r: RichDialogResult): void
}>()
defineSlots<{
  footer?: (p: RichDialogFooterProps) => unknown
  actions?: (p: RichDialogFooterProps) => unknown
}>()

const { tOr } = useI18n()
const uid = useId()
const titleId = `qd-rich-title-${uid}`
const hintId = `qd-rich-hint-${uid}`
const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true

// ── Blocks: each by its handler; an unknown kind is said in dev and skipped ──
const warned = new Set<string>()
const drawn = computed(() =>
  props.blocks.flatMap((block, i) => {
    const component = getDialogContent(block.kind)
    if (!component) {
      if (isDev && !warned.has(block.kind)) {
        warned.add(block.kind)
        console.warn(`[qdadm] QdRichDialog: no content handler for the kind '${block.kind}'; the block is skipped. Register one with registerDialogContent('${block.kind}', Component).`)
      }
      return []
    }
    return [{ block, component, key: `${i}-${block.kind}` }]
  })
)
const shownControls = computed(() =>
  props.controls.flatMap((control) => {
    const kind = control.kind ?? 'toggle'
    const component = getDialogControl(kind)
    if (!component) {
      if (isDev && !warned.has(`control:${kind}`)) {
        warned.add(`control:${kind}`)
        console.warn(`[qdadm] QdRichDialog: no control handler for the kind '${kind}'; the control is skipped. Register one with registerDialogControl('${kind}', Component).`)
      }
      return []
    }
    return [{ control, component }]
  })
)

// ── Values: the controls' starting values, again at each opening ─────────────
const values = reactive<Record<string, unknown>>({})
function resetValues(): void {
  for (const k of Object.keys(values)) delete values[k]
  for (const c of props.controls) values[c.key] = c.value
}
const empty = (v: unknown) => v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && v.length === 0)
const filled = computed(() => props.controls.every((c) => !c.required || !empty(values[c.key])))

// ── Read to the end: scrolled to the bottom, or nothing to scroll ───────────
// Live, not latched: content that arrives later (a markdown block renders
// once its library loads) and makes the area scroll takes "read" back
const body = ref<HTMLElement | null>(null)
const fits = ref(false)
const reachedEnd = ref(false)
// Blocks still rendering: the content does not count as read for fitting yet
const pending = ref(0)
provide(RICH_PENDING, pending)
const read = computed(() => (fits.value && pending.value === 0) || reachedEnd.value)
watch(pending, () => void nextTick(measure))
function measure(): void {
  const el = body.value
  if (!el) return
  fits.value = el.scrollHeight <= el.clientHeight + 2
  if (!fits.value && el.scrollHeight - el.scrollTop - el.clientHeight <= 2) reachedEnd.value = true
}
let observer: ResizeObserver | null = null
function watchBody(el: HTMLElement | null): void {
  observer?.disconnect()
  observer = null
  if (!el) return
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => measure())
    observer.observe(el)
    for (const child of Array.from(el.children)) observer.observe(child)
  }
  void nextTick(measure)
}
watch(body, watchBody)
onBeforeUnmount(() => observer?.disconnect())

const ready = computed(() => (!props.readToEnd || read.value) && filled.value)
const waiting = computed(() => props.actions.some((a) => a.requiresRead) && !ready.value)
const hint = computed(() =>
  props.readToEnd && !read.value
    ? tOr('core.richDialog.readToEnd', 'Scroll to the end to continue')
    : tOr('core.richDialog.required', 'Fill in what is required to continue')
)

// ── Settling: once per opening ───────────────────────────────────────────────
let settled = false
let opener: HTMLElement | null = null
/** The focus goes back where it was, once the dialog is gone */
function giveFocusBack(): void {
  const el = opener
  opener = null
  if (!el) return
  setTimeout(() => {
    const active = document.activeElement
    if (el.isConnected && (!active || active === document.body || active.closest('.qd-rich-dialog'))) el.focus()
  }, 0)
}
watch(
  () => props.visible,
  (v) => {
    if (!v) return
    settled = false
    fits.value = false
    reachedEnd.value = false
    // Where the focus was, to give it back on close (not from inside another rich dialog)
    const active = document.activeElement as HTMLElement | null
    opener = active && active !== document.body && !active.closest('.qd-rich-dialog') ? active : opener
    resetValues()
    void nextTick(() => watchBody(body.value))
  },
  { immediate: true }
)
const snapshot = (extra?: Record<string, unknown>) => ({ ...values, ...(extra ?? {}) })
function resolve(action: string, extra?: Record<string, unknown>, closes = true): void {
  if (settled) return
  if (closes) settled = true
  emit('action', { action, values: snapshot(extra) })
  if (closes) {
    emit('update:visible', false)
    giveFocusBack()
  }
}
function close(): void {
  if (settled) return
  settled = true
  emit('close', { action: null, values: snapshot() })
  emit('update:visible', false)
  giveFocusBack()
}
function onButton(a: RichDialogAction): void {
  if (a.requiresRead && !ready.value) return
  resolve(a.key, undefined, a.closes !== false)
}
// Escape or ×: the dialog asks to hide
function onVisible(v: boolean): void {
  if (!v) close()
}

const footerProps = computed<RichDialogFooterProps>(() => ({ read: read.value, ready: ready.value, values, resolve: (a, extra) => resolve(a, extra), close }))
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :closable="dismissable"
    :close-on-escape="dismissable"
    :draggable="false"
    :style="{ width, maxWidth: 'calc(100vw - 2rem)' }"
    class="qd-rich-dialog"
    :pt="{ root: { 'aria-labelledby': titleId } }"
    @update:visible="onVisible"
  >
    <template #header>
      <span :id="titleId" class="qd-rich-dialog-title">
        <i v-if="icon" :class="icon" aria-hidden="true"></i>
        {{ title }}
      </span>
    </template>

    <!-- The scrolling area: the keyboard can reach it, to scroll it to its end -->
    <div ref="body" class="qd-rich-dialog-body" :style="{ maxHeight }" tabindex="0" role="region" :aria-label="title" data-rich-body @scroll="measure">
      <section v-for="d in drawn" :key="d.key" class="qd-rich-block" :data-rich-block="d.block.kind">
        <header v-if="d.block.title || d.block.meta" class="qd-rich-block-head">
          <h3 v-if="d.block.title" class="qd-rich-block-title">{{ d.block.title }}</h3>
          <span v-if="d.block.meta" class="qd-rich-block-meta">{{ d.block.meta }}</span>
        </header>
        <component :is="d.component" :block="d.block" />
      </section>
    </div>

    <template #footer>
      <slot name="footer" v-bind="footerProps">
        <div class="qd-rich-dialog-footer">
          <div v-if="shownControls.length" class="qd-rich-dialog-controls">
            <component
              :is="c.component"
              v-for="c in shownControls"
              :key="c.control.key"
              :control="c.control"
              :model-value="values[c.control.key]"
              :read="read"
              :data-rich-control="c.control.key"
              @update:model-value="values[c.control.key] = $event"
            />
          </div>
          <div class="qd-rich-dialog-actions">
            <span v-if="waiting" :id="hintId" class="qd-rich-dialog-hint" aria-live="polite" data-rich-hint>{{ hint }}</span>
            <slot name="actions" v-bind="footerProps">
              <QdButton
                v-for="a in actions"
                :key="a.key"
                :label="a.label"
                :icon="a.icon"
                :severity="a.severity"
                :disabled="!!a.requiresRead && !ready"
                :aria-describedby="a.requiresRead && waiting ? hintId : undefined"
                :data-rich-action="a.key"
                @click="onButton(a)"
              />
            </slot>
          </div>
        </div>
      </slot>
    </template>
  </Dialog>
</template>

<style>
.qd-rich-dialog-title {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 1.125rem;
}
.qd-rich-dialog-body {
  overflow-y: auto;
  padding-right: 0.25rem;
  overscroll-behavior: contain;
}
.qd-rich-dialog-body:focus-visible {
  outline: 2px solid var(--p-primary-color, #3b82f6);
  outline-offset: 2px;
  border-radius: 4px;
}
.qd-rich-block + .qd-rich-block {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--p-content-border-color, #e2e8f0);
}
.qd-rich-block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.5rem;
}
.qd-rich-block-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}
.qd-rich-block-meta {
  color: var(--p-text-muted-color, #64748b);
  font-size: 0.8125rem;
  white-space: nowrap;
}
.qd-rich-text p,
.qd-rich-prose p {
  margin: 0 0 0.75rem;
  line-height: 1.55;
}
.qd-rich-prose :is(h1, h2, h3, h4) {
  margin: 1rem 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
}
.qd-rich-prose :is(ul, ol) {
  margin: 0 0 0.75rem;
  padding-left: 1.4rem;
}
.qd-rich-prose code {
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  background: var(--p-content-hover-background, #f1f5f9);
  font-size: 0.875em;
}
.qd-rich-prose pre {
  overflow-x: auto;
  padding: 0.75rem;
  border-radius: 6px;
  background: var(--p-content-hover-background, #f1f5f9);
}
.qd-rich-prose pre code {
  padding: 0;
  background: none;
}
.qd-rich-prose img {
  max-width: 100%;
  height: auto;
}
.qd-rich-prose table {
  border-collapse: collapse;
  margin: 0 0 0.75rem;
}
.qd-rich-prose :is(th, td) {
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--p-content-border-color, #e2e8f0);
}
.qd-rich-dialog-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1.5rem;
  width: 100%;
}
.qd-rich-dialog-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.25rem;
}
.qd-rich-dialog-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-left: auto;
}
.qd-rich-dialog-hint {
  color: var(--p-text-muted-color, #64748b);
  font-size: 0.8125rem;
}
.qd-rich-control {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.qd-rich-control label {
  cursor: pointer;
}
</style>
