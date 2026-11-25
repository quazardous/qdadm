<script setup lang="ts">
/**
 * QdEdgePanel (#5506): a thin bar on an edge of the window, its chevron and
 * its tabs hooked onto it, and a panel laid over the content, full height.
 * The layout draws it from `features.edgeBar` (QdEdgeBar); a layout of the
 * app's own may draw it too.
 *
 * - A tab opens the panel on it; the tab open closes it. The chevron, a
 *   click outside and Escape close it too.
 * - The tabs stay while it is closed: their badges say what waits.
 * - The focus goes into the panel when it opens, back to the tab (or the
 *   chevron) that opened it when it closes.
 * - Under `narrowAt`, the panel takes the screen's width.
 * - One drawer (#5509): the tabs and the panel side by side, sliding as one
 *   block; closed, only the tabs show past the edge. The tabs, one joined
 *   strip, at the top or the bottom (`tabsAt`).
 * - Pinned (#5511): beside the page rather than over it (the layout makes
 *   room), and closed only on purpose (the chevron, the open tab): a click
 *   outside and Escape leave it. No pin on a narrow screen.
 * - Resizable (#5519): a handle on its inner edge, dragged or moved with the
 *   arrows, within `minWidth` and `maxWidth`; a double click goes back to
 *   `width`. No handle on a narrow screen.
 *
 * Runtime props (#5469): an app's JavaScript build compiles qdadm's .vue.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { badgeColor } from '../lists/filters/contract'
import { badgeCount, type EdgePanelDef } from '../../edge/edgeBar'

const props = defineProps({
  panels: { type: Array as PropType<EdgePanelDef[]>, required: true },
  open: { type: Boolean, default: false },
  tab: { type: String as PropType<string | null>, default: null },
  side: { type: String as PropType<'right' | 'left'>, default: 'right' },
  tabsAt: { type: String as PropType<'top' | 'bottom'>, default: 'top' },
  width: { type: String, default: '26rem' },
  narrowAt: { type: Number, default: 900 },
  pinned: { type: Boolean, default: false },
  pinnable: { type: Boolean, default: true },
  resizable: { type: Boolean, default: true },
  minWidth: { type: String, default: '18rem' },
  maxWidth: { type: String, default: '60vw' },
  /** The width dragged to, in px; null: `width` */
  size: { type: Number as PropType<number | null>, default: null },
})
const emit = defineEmits<{
  (e: 'update:open', open: boolean): void
  (e: 'update:tab', tab: string): void
  (e: 'open', tab: string): void
  (e: 'close'): void
  (e: 'update:pinned', pinned: boolean): void
  /** The screen became narrow, or wide again: no pin while narrow */
  (e: 'narrow', narrow: boolean): void
  /** The width dragged to (px), or null back to `width`; `done` at the end of a gesture */
  (e: 'update:size', px: number | null, done: boolean): void
}>()
const { tOr } = useI18n()

const uid = `qd-edge-${Math.random().toString(36).slice(2, 8)}`
const current = computed(() => props.panels.find((p) => p.key === props.tab) ?? null)
const label = (p: EdgePanelDef) => tOr(p.label, p.label)
const count = (p: EdgePanelDef) => badgeCount(p.badge)
const tabName = (p: EdgePanelDef) => {
  const n = count(p)
  return n ? tOr('core.edgeBar.unread', '{label}, {count} unread', { label: label(p), count: n }) : label(p)
}
const toneStyle = (p: EdgePanelDef) => {
  const c = badgeColor(p.tone)
  return c ? { '--qd-edge-tab-color': c } : undefined
}

const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const chevron = ref<HTMLButtonElement | null>(null)
/** What opened it, for the focus to go back to */
let opener: HTMLElement | null = null

function show(key: string, from: HTMLElement | null): void {
  opener = from
  if (key !== props.tab) emit('update:tab', key)
  if (!props.open) {
    emit('update:open', true)
    emit('open', key)
  }
}
function hide(refocus = true): void {
  if (!props.open) return
  emit('update:open', false)
  emit('close')
  if (refocus) {
    const back = opener && opener.isConnected ? opener : chevron.value
    void nextTick(() => back?.focus())
  }
  opener = null
}
function onTab(p: EdgePanelDef, e: Event): void {
  if (props.open && props.tab === p.key) hide()
  else show(p.key, e.currentTarget as HTMLElement)
}
function onChevron(e: Event): void {
  if (props.open) hide()
  else {
    const key = props.tab && props.panels.some((p) => p.key === props.tab) ? props.tab : props.panels[0]?.key
    if (key) show(key, e.currentTarget as HTMLElement)
  }
}
/** The tabs: the arrows move between them */
function onTabKey(e: KeyboardEvent, i: number): void {
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key as 'ArrowDown']
  if (step === undefined) return
  e.preventDefault()
  const tabs = root.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  if (!tabs?.length) return
  tabs[(i + step + tabs.length) % tabs.length]!.focus()
}

// The panel's content stays drawn until the drawer has slid shut
const drawn = ref(props.open)
let undraw: ReturnType<typeof setTimeout> | null = null
// The focus into the panel when it opens
watch(
  () => props.open,
  async (open) => {
    if (undraw) clearTimeout(undraw)
    if (!open) {
      undraw = setTimeout(() => (drawn.value = false), 360)
      return
    }
    drawn.value = true
    await nextTick()
    panel.value?.focus({ preventScroll: true })
  }
)

// ── Resizing (#5519) ─────────────────────────────────────────────────────────
/** A CSS length in px, as the browser reads it */
function toPx(length: string): number {
  if (typeof document === 'undefined') return 0
  const probe = document.createElement('div')
  probe.style.cssText = `position:absolute;visibility:hidden;width:${length}`
  document.body.appendChild(probe)
  const px = probe.getBoundingClientRect().width
  probe.remove()
  return px
}
const bounds = () => {
  const max = Math.min(toPx(props.maxWidth), window.innerWidth * 0.92)
  return { min: Math.min(toPx(props.minWidth), max), max }
}
const clamp = (px: number) => {
  const b = bounds()
  return Math.round(Math.max(b.min, Math.min(b.max, px)))
}
const canResize = computed(() => props.resizable && !narrow.value)
const resizing = ref(false)
/** The current width, in px, for the handle's value */
const nowPx = computed(() => (props.size ?? 0) || Math.round(toPx(props.width)))
const handleBounds = ref({ min: 0, max: 0 })
function onHandleDown(e: PointerEvent): void {
  if (!canResize.value) return
  e.preventDefault()
  resizing.value = true
  document.documentElement.classList.add('qd-edge-resizing')
  const edge = panel.value!.getBoundingClientRect()
  let last = nowPx.value
  const move = (ev: PointerEvent) => {
    last = clamp(props.side === 'right' ? edge.right - ev.clientX : ev.clientX - edge.left)
    emit('update:size', last, false)
  }
  const up = (ev: PointerEvent) => {
    move(ev)
    resizing.value = false
    document.documentElement.classList.remove('qd-edge-resizing')
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    emit('update:size', last, true)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}
function onHandleKey(e: KeyboardEvent): void {
  if (!canResize.value) return
  const step = e.shiftKey ? 64 : 16
  // The arrow towards the page widens it
  const wider = props.side === 'right' ? 'ArrowLeft' : 'ArrowRight'
  const narrower = props.side === 'right' ? 'ArrowRight' : 'ArrowLeft'
  let px: number | null = null
  if (e.key === wider) px = nowPx.value + step
  else if (e.key === narrower) px = nowPx.value - step
  else if (e.key === 'Home') px = bounds().min
  else if (e.key === 'End') px = bounds().max
  if (px === null) return
  e.preventDefault()
  emit('update:size', clamp(px), true)
}
const refreshBounds = () => {
  if (typeof window === 'undefined') return
  const b = bounds()
  handleBounds.value = { min: Math.round(b.min), max: Math.round(b.max) }
}

/** Pinned, with room to share: it stays beside the page */
const docked = computed(() => props.pinned && props.pinnable && !narrow.value)

// A click outside, Escape: closed, unless pinned
function onDocDown(e: PointerEvent): void {
  if (!props.open || docked.value) return
  const t = e.target as Node | null
  if (t && root.value?.contains(t)) return
  hide(false)
}
function onDocKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.open && !docked.value) {
    e.preventDefault()
    hide()
  }
}

// Narrow: the panel takes the screen's width
const narrow = ref(false)
let media: MediaQueryList | null = null
const onMedia = (): void => {
  narrow.value = !!media?.matches
  emit('narrow', narrow.value)
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocDown, true)
  document.addEventListener('keydown', onDocKey)
  refreshBounds()
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    media = window.matchMedia(`(max-width: ${props.narrowAt - 1}px)`)
    onMedia()
    media.addEventListener?.('change', onMedia)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocDown, true)
  document.removeEventListener('keydown', onDocKey)
  media?.removeEventListener?.('change', onMedia)
  if (undraw) clearTimeout(undraw)
})
</script>

<template>
  <div
    ref="root"
    class="qd-edge"
    :class="[`qd-edge--${side}`, `qd-edge--tabs-${tabsAt}`, { 'qd-edge--open': open, 'qd-edge--narrow': narrow, 'qd-edge--pinned': docked, 'qd-edge--resizing': resizing }]"
    :style="{ '--qd-edge-panel-width': size ? `${size}px` : width }"
    data-edge-bar
  >
    <div class="qd-edge-bar"></div>
    <!-- One drawer: the tabs and the panel, sliding as one block (#5509) -->
    <div class="qd-edge-drawer">
      <div class="qd-edge-hooks" :data-tabs-at="tabsAt">
        <button
          v-if="tabsAt === 'top'"
          ref="chevron"
          type="button"
          class="qd-edge-handle qd-edge-chevron"
          :aria-expanded="open ? 'true' : 'false'"
          :aria-controls="`${uid}-panel`"
          :aria-label="open ? tOr('core.edgeBar.close', 'Close the panel') : tOr('core.edgeBar.open', 'Open the panel')"
          :title="open ? tOr('core.edgeBar.close', 'Close the panel') : tOr('core.edgeBar.open', 'Open the panel')"
          data-edge-chevron
          @click="onChevron"
        >
          <i class="pi" :class="(side === 'right') === open ? 'pi-chevron-right' : 'pi-chevron-left'" aria-hidden="true"></i>
        </button>
        <div class="qd-edge-tabs" role="tablist" aria-orientation="vertical" :aria-label="tOr('core.edgeBar.panels', 'Side panels')">
          <button
            v-for="(p, i) in panels"
            :id="`${uid}-tab-${p.key}`"
            :key="p.key"
            type="button"
            role="tab"
            class="qd-edge-handle qd-edge-tab"
            :class="{ 'qd-edge-tab--active': open && tab === p.key }"
            :style="toneStyle(p)"
            :aria-selected="open && tab === p.key ? 'true' : 'false'"
            :aria-controls="`${uid}-panel`"
            :aria-label="tabName(p)"
            :title="tabName(p)"
            :tabindex="(tab ?? panels[0]?.key) === p.key ? 0 : -1"
            :data-edge-tab="p.key"
            @click="onTab(p, $event)"
            @keydown="onTabKey($event, i)"
          >
            <i :class="p.icon || 'pi pi-circle'" aria-hidden="true"></i>
            <span v-if="count(p)" class="qd-edge-badge" aria-hidden="true">{{ count(p)! > 99 ? '99+' : count(p) }}</span>
          </button>
        </div>
        <button
          v-if="tabsAt === 'bottom'"
          ref="chevron"
          type="button"
          class="qd-edge-handle qd-edge-chevron"
          :aria-expanded="open ? 'true' : 'false'"
          :aria-controls="`${uid}-panel`"
          :aria-label="open ? tOr('core.edgeBar.close', 'Close the panel') : tOr('core.edgeBar.open', 'Open the panel')"
          :title="open ? tOr('core.edgeBar.close', 'Close the panel') : tOr('core.edgeBar.open', 'Open the panel')"
          data-edge-chevron
          @click="onChevron"
        >
          <i class="pi" :class="(side === 'right') === open ? 'pi-chevron-right' : 'pi-chevron-left'" aria-hidden="true"></i>
        </button>
      </div>
      <section
        :id="`${uid}-panel`"
        ref="panel"
        class="qd-edge-panel"
        role="tabpanel"
        tabindex="-1"
        :inert="open ? undefined : true"
        :aria-hidden="open ? undefined : 'true'"
        :aria-labelledby="current ? `${uid}-tab-${current.key}` : undefined"
        data-edge-panel
      >
        <div
          v-if="canResize"
          class="qd-edge-resize"
          role="separator"
          aria-orientation="vertical"
          tabindex="0"
          :aria-label="tOr('core.edgeBar.resize', 'Resize the panel')"
          :title="tOr('core.edgeBar.resizeHint', 'Drag to resize; double click for the default width')"
          :aria-valuenow="nowPx"
          :aria-valuemin="handleBounds.min"
          :aria-valuemax="handleBounds.max"
          data-edge-resize
          @pointerdown="onHandleDown"
          @keydown="onHandleKey"
          @focus="refreshBounds"
          @dblclick="emit('update:size', null, true)"
        ></div>
        <header v-if="current" class="qd-edge-panel-head" :style="toneStyle(current)">
          <i v-if="current.icon" :class="current.icon" aria-hidden="true"></i>
          <h2 class="qd-edge-panel-title">{{ label(current) }}</h2>
          <button
            v-if="pinnable && !narrow"
            type="button"
            class="qd-edge-pin"
            :aria-pressed="pinned ? 'true' : 'false'"
            :aria-label="pinned ? tOr('core.edgeBar.unpin', 'Unpin the panel') : tOr('core.edgeBar.pin', 'Pin the panel')"
            :title="pinned ? tOr('core.edgeBar.unpin', 'Unpin the panel') : tOr('core.edgeBar.pin', 'Pin the panel')"
            data-edge-pin
            @click="emit('update:pinned', !pinned)"
          >
            <i class="pi pi-thumbtack" aria-hidden="true"></i>
          </button>
        </header>
        <div v-if="drawn && current" class="qd-edge-panel-body">
          <slot :name="`tab-${current.key}`" :panel="current">
            <slot :panel="current">
              <component :is="current.component" v-if="current.component" v-bind="current.props ?? {}" />
            </slot>
          </slot>
        </div>
      </section>
    </div>
  </div>
</template>
