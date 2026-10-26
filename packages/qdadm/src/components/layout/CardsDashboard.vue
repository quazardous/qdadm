<script setup lang="ts">
/**
 * CardsDashboard — a zone's blocks as cards each user arranges (#4320):
 * reorder (drag or keyboard), hide, pin at the top. The arrangement is kept in
 * localStorage per dashboard and per user (useCardsArrangement).
 *
 * A card is any block with an id, so one block serves both a classic Zone and
 * this dashboard. Its optional `card` field adds the title and what the app
 * forces:
 *
 *   ctx.block(DASHBOARD_ZONES.WIDGETS, {
 *     id: 'sales', component: SalesCard, weight: 10,
 *     card: { title: 'Sales', required: true, span: 2 },
 *   })
 *
 *   <CardsDashboard />                       // the dashboard widgets zone
 *   <CardsDashboard zone="home-cards" id="home" min-card-width="16rem" />
 *
 * Edit mode ("Customise") shows a handle (arrows, Home/End, or drag with
 * mouse, touch or pen), pin and hide on each card, and the hidden cards'
 * tray with Reset. Outside it, only the cards show.
 */
import { computed, inject, nextTick, onBeforeUnmount, ref, watch, h, defineComponent, type Component, type VNode } from 'vue'
import QdButton from '../base/QdButton.vue'
import { DASHBOARD_ZONES } from '../../zones/zones'
import { useAuth } from '../../composables/useAuth'
import { useI18n } from '../../i18n/useI18n'
import { useCardsArrangement, moveCard, type CardDef, type CardsArrangement } from '../../composables/useCardsArrangement'
import type { ZoneRegistry, BlockConfig } from '../../zones/ZoneRegistry'

const props = withDefaults(
  defineProps<{
    /** The zone whose blocks are the cards */
    zone?: string
    /** The dashboard's name in the storage key (default: the zone's) */
    id?: string | null
    /** The narrowest a card gets before the grid drops a column */
    minCardWidth?: string
    /** Show the "Customise" button */
    editable?: boolean
    /** How the edit mode's tray shows hidden cards by default: whole, or as chips; the user's toggle wins */
    hiddenView?: 'cards' | 'compact'
  }>(),
  { zone: DASHBOARD_ZONES.WIDGETS, id: null, minCardWidth: '18rem', editable: true, hiddenView: 'cards' }
)

const registry = inject<ZoneRegistry | null>('qdadmZoneRegistry', null)
const version = registry?.getVersionRef?.()
const { user } = useAuth()
const { tOr } = useI18n()

const blocks = computed<BlockConfig[]>(() => {
  if (version) void version.value
  return registry?.getBlocks(props.zone) ?? []
})
const blockById = computed(() => new Map(blocks.value.filter((b) => b.id).map((b) => [b.id as string, b])))
// Any block with an id is a card: the same block serves a classic Zone and
// this dashboard. `card` only adds what arranging needs; without it the title
// comes from the block's `title` prop, else its id.
const cards = computed<CardDef[]>(() =>
  blocks.value.filter((b) => b.id).map((b) => {
    const fallback = typeof b.props?.title === 'string' ? (b.props.title as string) : (b.id as string)
    return { id: b.id as string, card: { ...b.card, title: b.card?.title ?? fallback } }
  })
)
// A block without an id has no key to save: shown after the cards, as declared
const plainBlocks = computed(() => blocks.value.filter((b) => !b.id))
if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV && plainBlocks.value.length) {
  console.warn(`[qdadm] CardsDashboard "${props.zone}": blocks without an id cannot be arranged`)
}

const userKey = computed(() => {
  const u = user.value as { id?: unknown; username?: unknown } | null
  return String(u?.id ?? u?.username ?? 'anonymous')
})
const storageKey = computed(() => `qdadm.dashboard.${props.id ?? props.zone}.${userKey.value}`)
const state = useCardsArrangement(storageKey, cards)

const editing = ref(false)

// The hidden tray's view (#4320): whole cards or chips, the user's choice kept beside the arrangement
const trayKey = computed(() => `${storageKey.value}.tray`)
function readTray(): 'cards' | 'compact' {
  try {
    const v = globalThis.localStorage?.getItem(trayKey.value)
    return v === 'cards' || v === 'compact' ? v : props.hiddenView
  } catch {
    return props.hiddenView
  }
}
const trayView = ref<'cards' | 'compact'>(readTray())
watch(trayKey, () => (trayView.value = readTray()))
function setTrayView(view: 'cards' | 'compact'): void {
  trayView.value = view
  try {
    globalThis.localStorage?.setItem(trayKey.value, view)
  } catch {
    // No storage: the choice lasts the page
  }
}
const announcement = ref('')
const root = ref<HTMLElement | null>(null)

/** The selector of a card's slot: ids are app strings, quoted safely */
const slotSelector = (id: string) => `[data-card-id="${id.replace(/["\\]/g, '\\$&')}"]`
const title = (c: CardDef) => tOr(c.card.title, c.card.title)
const span = (c: CardDef) => Math.max(1, Math.min(3, Math.round(c.card.span ?? 1)))
const isPinned = (c: CardDef) => state.arrangement.value.pinned.includes(c.id)
const visible = computed(() => [...state.groups.value.pinned, ...state.groups.value.rest])
const groupFor = (c: CardDef) => (isPinned(c) ? state.groups.value.pinned : state.groups.value.rest)

function announce(text: string): void {
  // Same text twice must still be read: clear, then set
  announcement.value = ''
  void nextTick(() => (announcement.value = text))
}

function announcePosition(c: CardDef): void {
  const group = groupFor(c)
  announce(tOr('core.cardsDashboard.moved', '{title}: card {position} of {total}', {
    title: title(c),
    position: group.findIndex((g) => g.id === c.id) + 1,
    total: group.length,
  }))
}

async function focusHandle(id: string): Promise<void> {
  await nextTick()
  root.value?.querySelector<HTMLElement>(`${slotSelector(id)} .qd-cards-handle`)?.focus()
}

function onHandleKey(event: KeyboardEvent, c: CardDef): void {
  const group = groupFor(c)
  const from = group.findIndex((g) => g.id === c.id)
  const to = { ArrowUp: from - 1, ArrowLeft: from - 1, ArrowDown: from + 1, ArrowRight: from + 1, Home: 0, End: group.length - 1 }[event.key]
  if (to === undefined) return
  event.preventDefault()
  if (state.move(c.id, to)) {
    announcePosition(c)
    void focusHandle(c.id)
  }
}

function togglePin(c: CardDef): void {
  const pinned = !isPinned(c)
  state.pin(c.id, pinned)
  announce(pinned ? tOr('core.cardsDashboard.pinnedOne', '{title} pinned at the top', { title: title(c) }) : tOr('core.cardsDashboard.unpinnedOne', '{title} unpinned', { title: title(c) }))
  void focusHandle(c.id)
}

function hide(c: CardDef): void {
  state.hide(c.id, true)
  announce(tOr('core.cardsDashboard.hiddenOne', '{title} hidden', { title: title(c) }))
}

function restore(c: CardDef): void {
  state.hide(c.id, false)
  announce(tOr('core.cardsDashboard.restoredOne', '{title} shown', { title: title(c) }))
  void focusHandle(c.id)
}

function reset(): void {
  state.reset()
  announce(tOr('core.cardsDashboard.resetDone', 'Default arrangement restored'))
}

// ── Drag with pointer events: mouse, touch and pen, no dependency ─────────
// Followed on window, not with pointer capture: the preview moves the slot in
// the DOM, which drops a capture and would lose the pointerup.
const dragging = ref<string | null>(null)
let snapshot: CardsArrangement | null = null
let dragged: CardDef | null = null

function onPointerDown(event: PointerEvent, c: CardDef): void {
  if (c.card.fixed || (event.pointerType === 'mouse' && event.button !== 0)) return
  event.preventDefault()
  // A plain copy: the arrangement's arrays are reactive proxies, which structuredClone refuses
  const { order, hidden, pinned } = state.arrangement.value
  snapshot = { v: 1, order: [...order], hidden: [...hidden], pinned: [...pinned] }
  dragging.value = c.id
  dragged = c
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  window.addEventListener('keydown', onDragKey)
}

function stopDrag(): void {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
  window.removeEventListener('keydown', onDragKey)
  dragging.value = null
  dragged = null
  snapshot = null
}

function onPointerMove(event: PointerEvent): void {
  const c = dragged
  if (!c) return
  // The card of the same group under the pointer is the drop place
  const group = groupFor(c)
  for (let i = 0; i < group.length; i++) {
    if (group[i]!.id === c.id || group[i]!.card.fixed) continue
    const r = root.value?.querySelector<HTMLElement>(slotSelector(group[i]!.id))?.getBoundingClientRect()
    if (r && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) {
      state.preview(moveCard(state.arrangement.value, cards.value, c.id, i))
      return
    }
  }
}

function onPointerUp(): void {
  const c = dragged
  if (!c) return
  stopDrag()
  state.commit()
  announcePosition(c)
}

function cancelDrag(): void {
  if (snapshot) state.preview(snapshot)
  stopDrag()
  announce(tOr('core.cardsDashboard.dragCancelled', 'Move cancelled'))
}

function onPointerCancel(): void {
  if (dragged) cancelDrag()
}

function onDragKey(event: KeyboardEvent): void {
  if (event.key === 'Escape' && dragged) cancelDrag()
}

onBeforeUnmount(stopDrag)

// A block with wrappers renders through them, as in Zone
function render(block: BlockConfig): Component {
  if (!block.wrappers?.length) return block.component
  return defineComponent({
    name: 'WrappedCard',
    render(): VNode {
      let current: VNode = h(block.component, block.props ?? {})
      for (const wrapper of [...block.wrappers!].reverse()) {
        const inner = current
        current = h(wrapper.component, wrapper.props || {}, { default: () => inner })
      }
      return current
    },
  })
}
</script>

<template>
  <div ref="root" class="qd-cards-dashboard" :class="{ 'qd-cards-editing': editing }" :data-zone="zone">
    <div v-if="editable && cards.length" class="qd-cards-toolbar">
      <template v-if="editing">
        <QdButton
          type="button"
          size="small"
          text
          icon="pi pi-undo"
          :label="tOr('core.cardsDashboard.reset', 'Reset')"
          @click="reset"
        />
        <QdButton type="button" size="small" icon="pi pi-check" :label="tOr('core.cardsDashboard.done', 'Done')" @click="editing = false" />
      </template>
      <QdButton
        v-else
        type="button"
        size="small"
        outlined
        icon="pi pi-th-large"
        :label="tOr('core.cardsDashboard.customise', 'Customise')"
        @click="editing = true"
      />
    </div>

    <div class="qd-cards-grid" :style="{ '--qd-card-min': minCardWidth }">
      <div
        v-for="c in visible"
        :key="c.id"
        class="qd-cards-slot"
        :class="{ 'qd-cards-pinned': isPinned(c), 'qd-cards-dragging': dragging === c.id }"
        :style="{ '--qd-card-span': span(c) }"
        :data-card-id="c.id"
        :data-zone-block="c.id"
      >
        <div v-if="editing" class="qd-cards-bar">
          <button
            v-if="!c.card.fixed"
            type="button"
            class="qd-cards-handle"
            :aria-label="tOr('core.cardsDashboard.move', 'Move {title}', { title: title(c) })"
            :aria-describedby="`qd-cards-help-${zone}`"
            @keydown="onHandleKey($event, c)"
            @pointerdown="onPointerDown($event, c)"
          >
            <i class="pi pi-arrows-alt" aria-hidden="true"></i>
          </button>
          <span class="qd-cards-title">{{ title(c) }}</span>
          <button
            v-if="!c.card.fixed"
            type="button"
            class="qd-cards-action"
            :aria-pressed="isPinned(c)"
            :aria-label="isPinned(c) ? tOr('core.cardsDashboard.unpin', 'Unpin {title}', { title: title(c) }) : tOr('core.cardsDashboard.pin', 'Pin {title} at the top', { title: title(c) })"
            :title="isPinned(c) ? tOr('core.cardsDashboard.unpin', 'Unpin {title}', { title: title(c) }) : tOr('core.cardsDashboard.pin', 'Pin {title} at the top', { title: title(c) })"
            @click="togglePin(c)"
          >
            <i :class="isPinned(c) ? 'pi pi-thumbtack qd-cards-on' : 'pi pi-thumbtack'" aria-hidden="true"></i>
          </button>
          <button
            v-if="!c.card.required"
            type="button"
            class="qd-cards-action"
            :aria-label="tOr('core.cardsDashboard.hide', 'Hide {title}', { title: title(c) })"
            :title="tOr('core.cardsDashboard.hide', 'Hide {title}', { title: title(c) })"
            @click="hide(c)"
          >
            <i class="pi pi-eye-slash" aria-hidden="true"></i>
          </button>
        </div>
        <component :is="render(blockById.get(c.id)!)" v-bind="blockById.get(c.id)!.props ?? {}" />
      </div>
      <div v-for="(b, i) in plainBlocks" :key="`plain-${i}`" class="qd-cards-slot">
        <component :is="render(b)" v-bind="b.props ?? {}" />
      </div>
    </div>

    <div v-if="editing" class="qd-cards-tray" :class="`qd-cards-tray-${trayView}`">
      <div class="qd-cards-tray-head">
        <span class="qd-cards-tray-label">{{ tOr('core.cardsDashboard.hidden', 'Hidden cards') }}</span>
        <span v-if="!state.groups.value.hidden.length" class="qd-cards-tray-empty">{{ tOr('core.cardsDashboard.noneHidden', 'None') }}</span>
        <div class="qd-cards-tray-view" role="group" :aria-label="tOr('core.cardsDashboard.trayView', 'Show hidden cards as')">
          <button
            v-for="view in (['cards', 'compact'] as const)"
            :key="view"
            type="button"
            class="qd-cards-tray-view-option"
            :aria-pressed="trayView === view"
            @click="setTrayView(view)"
          >
            {{ view === 'cards' ? tOr('core.cardsDashboard.viewCards', 'Cards') : tOr('core.cardsDashboard.viewCompact', 'Compact') }}
          </button>
        </div>
      </div>
      <!-- Whole cards: the same grid, dimmed and inert; only "Show" acts -->
      <div v-if="trayView === 'cards' && state.groups.value.hidden.length" class="qd-cards-grid" :style="{ '--qd-card-min': minCardWidth }">
        <div
          v-for="c in state.groups.value.hidden"
          :key="c.id"
          class="qd-cards-slot qd-cards-hidden"
          :style="{ '--qd-card-span': span(c) }"
          :data-hidden-card-id="c.id"
        >
          <div class="qd-cards-bar">
            <span class="qd-cards-title">{{ title(c) }}</span>
            <QdButton
              type="button"
              size="small"
              text
              icon="pi pi-eye"
              class="qd-cards-restore"
              :label="tOr('core.cardsDashboard.show', 'Show')"
              :aria-label="tOr('core.cardsDashboard.restore', 'Show {title}', { title: title(c) })"
              @click="restore(c)"
            />
          </div>
          <div class="qd-cards-hidden-body" inert>
            <component :is="render(blockById.get(c.id)!)" v-bind="blockById.get(c.id)!.props ?? {}" />
          </div>
        </div>
      </div>
      <div v-else-if="trayView === 'compact'" class="qd-cards-chips">
        <QdButton
          v-for="c in state.groups.value.hidden"
          :key="c.id"
          type="button"
          size="small"
          outlined
          rounded
          icon="pi pi-eye"
          class="qd-cards-restore"
          :label="title(c)"
          :aria-label="tOr('core.cardsDashboard.restore', 'Show {title}', { title: title(c) })"
          @click="restore(c)"
        />
      </div>
    </div>

    <span :id="`qd-cards-help-${zone}`" class="qd-cards-sr">{{ tOr('core.cardsDashboard.help', 'Arrow keys move the card, Home and End to the start or the end') }}</span>
    <span class="qd-cards-sr" role="status" aria-live="polite">{{ announcement }}</span>
  </div>
</template>
