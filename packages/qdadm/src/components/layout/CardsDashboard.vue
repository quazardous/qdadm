<script setup lang="ts">
/**
 * CardsDashboard — a zone's blocks as cards each user arranges (#4320):
 * reorder (drag or keyboard), hide, pin at the top. The arrangement is kept
 * per dashboard and per user, in localStorage or in the storage the app
 * provides (`storage` prop or configureDashboards, #4338), saved once when an
 * edit ends (Done, Reset).
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
 *
 * Since #5348: "Add a card" opens a catalogue (the hidden cards, and the
 * repeatable blocks, each added with its parameters as many times as wanted),
 * each card has the size its person picks, and cards go in named sections.
 */
import QdCardBlockScope from '../../cards/QdCardBlockScope.vue'
import { computed, inject, nextTick, onBeforeUnmount, ref, watch, h, defineComponent, type Component, type VNode } from 'vue'
import QdButton from '../base/QdButton.vue'
import QdCardSizePicker from './QdCardSizePicker.vue'
import QdLayoutCatalogue from './QdLayoutCatalogue.vue'
import { useLayoutReorder } from '../../composables/useLayoutReorder'
import QdCardView from '../../cards/QdCardView.vue'
import { getCard } from '../../cards/registry'
import { DASHBOARD_ZONES } from '../../zones/zones'
import { useAuth } from '../../composables/useAuth'
import { useI18n } from '../../i18n/useI18n'
import {
  useCardsArrangement,
  moveCard,
  cardGroup,
  cardSizes,
  cardSpan,
  cardRows,
  cardSize,
  cardBounds,
  boundCardSizes,
  sectionOfCard,
  type CardSizeBounds,
  localArrangementStorage,
  type CardDef,
  type CardsArrangement,
  type CardsArrangementStorage,
} from '../../composables/useCardsArrangement'
import { getDashboardsConfig } from '../../dashboard/dashboardConfig'
import type { ZoneRegistry, BlockConfig } from '../../zones/ZoneRegistry'

const props = withDefaults(
  defineProps<{
    /** The zone whose blocks are the cards */
    zone?: string
    /** The dashboard's name in the storage key (default: the zone's) */
    id?: string | null
    /** The narrowest a card gets before the grid drops a column; default the `--qd-card-min` token (18rem) */
    minCardWidth?: string | null
    /** The smallest and largest card size (#5513), `'WxH'`; default configureDashboards's, else 1x1 to 3x2 */
    cardSizes?: CardSizeBounds | null
    /** Show the "Customise" button */
    editable?: boolean
    /** How the edit mode's tray shows hidden cards by default: whole, or as chips; the user's toggle wins */
    hiddenView?: 'cards' | 'compact'
    /** Where the arrangement is kept (default: configureDashboards's, else localStorage) */
    storage?: CardsArrangementStorage | null
    /** Ms an async load may take before the default order shows (default 150) */
    loadGrace?: number | null
  }>(),
  { zone: DASHBOARD_ZONES.WIDGETS, id: null, minCardWidth: null, cardSizes: null, editable: true, hiddenView: 'cards', storage: null, loadGrace: null }
)

const registry = inject<ZoneRegistry | null>('qdadmZoneRegistry', null)
const version = registry?.getVersionRef?.()
const { user } = useAuth()
const { tOr } = useI18n()
const orchestrator = inject<{ toast: { error: (summary: string, detail?: string, source?: string) => void } } | null>('qdadmOrchestrator', null)

const blocks = computed<BlockConfig[]>(() => {
  if (version) void version.value
  return registry?.getBlocks(props.zone) ?? []
})
const blockById = computed(() => new Map(blocks.value.filter((b) => b.id).map((b) => [b.id as string, b])))
// Any block with an id is a card: the same block serves a classic Zone and
// this dashboard. `card` only adds what arranging needs; without it the title
// comes from the block's `title` prop, else its id.
// The sizes the app allows here (#5513): a card's own within them
const bounds = computed(() => props.cardSizes ?? getDashboardsConfig().cardSizes ?? null)
const gridMax = computed(() => cardBounds(bounds.value).max)
const cards = computed<CardDef[]>(() =>
  blocks.value.filter((b) => b.id).map((b) => {
    const fallback = typeof b.props?.title === 'string' ? (b.props.title as string) : (b.id as string)
    return { id: b.id as string, card: { ...b.card, title: b.card?.title ?? fallback, sizes: boundCardSizes(b.card?.sizes, bounds.value) } }
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
const state = useCardsArrangement(storageKey, cards, {
  storage: () => props.storage ?? getDashboardsConfig().storage ?? localArrangementStorage,
  autoSave: false,
  loadGrace: props.loadGrace ?? getDashboardsConfig().loadGrace,
})

const editing = ref(false)
const arrangement = computed(() => state.arrangement.value)

function saveFailed(): void {
  const text = tOr('core.cardsDashboard.saveFailed', 'Could not save the arrangement')
  announce(text)
  orchestrator?.toast.error(text, tOr('core.cardsDashboard.saveFailedDetail', 'It stays as shown; try again.'), 'CardsDashboard')
}

/** Done: one save for the whole edit; on failure the edit stays open to try again */
async function finish(): Promise<void> {
  if (state.dirty.value && !(await state.commit())) return saveFailed()
  editing.value = false
}

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
const span = (c: CardDef) => cardSpan(arrangement.value, c)
const rows = (c: CardDef) => cardRows(arrangement.value, c)
const isPinned = (c: CardDef) => arrangement.value.pinned.includes(c.id)
const groupFor = (c: CardDef) => cardGroup(arrangement.value, cards.value, c.id)
/** An added card is drawn by its block, its parameters merged into the block's props */
const blockOf = (c: CardDef) => blockById.value.get(c.block ?? c.id)!
const propsOf = (c: CardDef) => ({ ...(blockOf(c).props ?? {}), ...(c.params ?? {}) })

// What the grid draws: the pinned cards then the one group, as before; with
// sections, the pinned cards above them, then one grid per section (#5348)
const grids = computed(() => {
  const g = state.groups.value
  if (!arrangement.value.sections.length) return [{ key: 'all', section: null, cards: [...g.pinned, ...g.rest] }]
  return [
    ...(g.pinned.length ? [{ key: 'pinned', section: null, cards: g.pinned }] : []),
    ...g.sections.map((s) => ({ key: s.section!.id, section: s.section, cards: s.cards })),
  ]
})

// ── Size and section (#5348) ──────────────────────────────────────────────
// Width × height, picked on a grid (#5503)
const sizeLabel = (size: string) => {
  const [w, hh] = size.split('x')
  return tOr('core.cardsDashboard.sizeValue', '{w} × {h}', { w: w ?? '1', h: hh ?? '1' })
}
const currentSize = (c: CardDef): string => cardSize(arrangement.value, c)

function onSize(c: CardDef, size: string): void {
  if (state.resize(c.id, size as never)) announce(tOr('core.cardsDashboard.resized', '{title}: {size}', { title: title(c), size: sizeLabel(size) }))
}

const sectionTitle = (id: string | null) => arrangement.value.sections.find((s) => s.id === id)?.title ?? ''

function onSection(c: CardDef, section: string): void {
  if (state.moveToSection(c.id, section)) {
    announce(tOr('core.cardsDashboard.movedToSection', '{title} moved to {section}', { title: title(c), section: sectionTitle(section) }))
    void focusHandle(c.id)
  }
}

async function addSection(): Promise<void> {
  const name = tOr('core.cardsDashboard.newSection', 'New section')
  const id = state.addSection(arrangement.value.sections.length ? name : tOr('core.cardsDashboard.firstSection', 'Main'))
  // The first section takes every card; a second one is the one to name
  const target = arrangement.value.sections.length === 1 ? state.addSection(name) : id
  announce(tOr('core.cardsDashboard.sectionAdded', 'Section {title} added', { title: sectionTitle(target) }))
  await nextTick()
  root.value?.querySelector<HTMLInputElement>(`[data-section-input="${target}"]`)?.select()
}

function renameSection(id: string, value: string): void {
  const text = value.trim()
  if (text) state.renameSection(id, text)
}

function removeSection(id: string): void {
  const name = sectionTitle(id)
  state.removeSection(id)
  announce(tOr('core.cardsDashboard.sectionRemoved', 'Section {title} removed, its cards moved to the first one', { title: name }))
}

// ── The catalogue (#5348) ─────────────────────────────────────────────────
const catalogueOpen = ref(false)
const templates = computed(() => cards.value.filter((c) => c.card.repeatable))
/** What a card type answers, when the block draws a registered card */
function question(c: CardDef): string | null {
  const block = blockById.value.get(c.id)
  const type = block?.component === QdCardView ? (block.props?.type as string | undefined) : undefined
  const q = type ? getCard(type)?.meta.question : undefined
  return q ?? null
}

async function openCatalogue(): Promise<void> {
  catalogueOpen.value = !catalogueOpen.value
  if (catalogueOpen.value) {
    await nextTick()
    root.value?.querySelector<HTMLElement>('.qd-cards-catalogue h2')?.focus()
  }
}

function addInstance(c: CardDef, value: { params: Record<string, unknown>; title: string; section: string | null }): void {
  const id = state.add(c.id, value.params, { title: value.title === title(c) ? undefined : value.title, section: value.section })
  if (!id) return
  catalogueOpen.value = false
  announce(tOr('core.cardsDashboard.added', '{title} added', { title: value.title }))
  void focusHandle(id)
}

function removeCard(c: CardDef): void {
  state.remove(c.id)
  announce(tOr('core.cardsDashboard.removed', '{title} removed', { title: title(c) }))
}

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

async function reset(): Promise<void> {
  if (!(await state.reset())) return saveFailed()
  announce(tOr('core.cardsDashboard.resetDone', 'Default arrangement restored'))
}

// ── Moving cards (#5526): the layouts' shared reorder, by handle, pointer and keyboard
const reorder = useLayoutReorder({
  group: (id) => groupOf(id),
  isFixed: (id) => !!cardById(id)?.card.fixed,
  locate: (id) => root.value?.querySelector<HTMLElement>(slotSelector(id)) ?? null,
  move: (id, to) => state.move(id, to),
  preview: (id, to) => state.preview(moveCard(state.arrangement.value, cards.value, id, to)),
  snapshot: () => {
    // A plain copy: the arrangement's arrays are reactive proxies, which structuredClone refuses
    const saved = JSON.parse(JSON.stringify(state.arrangement.value)) as CardsArrangement
    return () => state.preview(saved)
  },
  onMoved: (id) => {
    const c = cardById(id)
    if (!c) return
    announcePosition(c)
    void focusHandle(id)
  },
  onCancel: () => announce(tOr('core.cardsDashboard.dragCancelled', 'Move cancelled')),
})
const dragging = reorder.dragging
const cardById = (id: string) => state.allCards.value.find((c) => c.id === id)
const groupOf = (id: string) => {
  const c = cardById(id)
  return c ? groupFor(c).map((g) => g.id) : []
}
const onHandleKey = (event: KeyboardEvent, c: CardDef) => reorder.onHandleKey(event, c.id)
const onPointerDown = (event: PointerEvent, c: CardDef) => reorder.onPointerDown(event, c.id)

onBeforeUnmount(() => {
  reorder.stop()
  // Left in the middle of an edit: keep what was arranged
  if (editing.value && state.dirty.value) void state.commit()
})

// A block with wrappers renders through them, as in Zone
function render(block: BlockConfig, props?: Record<string, unknown>): Component {
  if (!block.wrappers?.length) return block.component
  return defineComponent({
    name: 'WrappedCard',
    render(): VNode {
      let current: VNode = h(block.component, props ?? block.props ?? {})
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
  <div ref="root" class="qd-cards-dashboard" :class="{ 'qd-cards-editing': editing }" :data-zone="zone" :data-dashboard="id ?? zone">
    <div v-if="editable && cards.length" class="qd-cards-toolbar">
      <template v-if="editing">
        <QdButton
          type="button"
          size="small"
          outlined
          icon="pi pi-plus"
          class="qd-cards-add"
          :label="tOr('core.cardsDashboard.addCard', 'Add a card')"
          :aria-expanded="catalogueOpen"
          aria-controls="qd-cards-catalogue"
          @click="openCatalogue"
        />
        <QdButton
          type="button"
          size="small"
          text
          icon="pi pi-folder-plus"
          class="qd-cards-add-section"
          :label="tOr('core.cardsDashboard.addSection', 'Add a section')"
          @click="addSection"
        />
        <QdButton
          type="button"
          size="small"
          text
          icon="pi pi-undo"
          :label="tOr('core.cardsDashboard.reset', 'Reset')"
          :disabled="state.saving.value"
          @click="reset"
        />
        <QdButton
          type="button"
          size="small"
          icon="pi pi-check"
          :label="tOr('core.cardsDashboard.done', 'Done')"
          :loading="state.saving.value"
          @click="finish"
        />
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

    <!-- The catalogue (#5348): the hidden cards, and the cards to add with their parameters -->
    <section v-if="editing && catalogueOpen" id="qd-cards-catalogue" class="qd-cards-catalogue" aria-labelledby="qd-cards-catalogue-title">
      <h2 id="qd-cards-catalogue-title" tabindex="-1">{{ tOr('core.cardsDashboard.catalogue', 'Add a card') }}</h2>
      <QdLayoutCatalogue
        :templates="templates"
        :hidden="state.groups.value.hidden"
        :sections="arrangement.sections"
        :id-prefix="`qd-cards-param-${zone}`"
        :describe="question"
        @add="addInstance"
        @restore="restore"
      />
    </section>

    <div v-for="(grid, gi) in grids" :key="grid.key" class="qd-cards-group" :data-section-id="grid.section?.id">
      <div v-if="grid.section" class="qd-cards-section-head">
        <input
          v-if="editing"
          :data-section-input="grid.section.id"
          class="qd-cards-section-input p-inputtext p-component"
          :value="grid.section.title"
          :aria-label="tOr('core.cardsDashboard.sectionName', 'Name of the section')"
          @change="renameSection(grid.section.id, ($event.target as HTMLInputElement).value)"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
        <h2 v-else class="qd-cards-section-title">{{ grid.section.title }}</h2>
        <QdButton
          v-if="editing"
          type="button"
          size="small"
          text
          icon="pi pi-trash"
          :aria-label="tOr('core.cardsDashboard.removeSection', 'Remove the section {title}', { title: grid.section.title })"
          :title="tOr('core.cardsDashboard.removeSection', 'Remove the section {title}', { title: grid.section.title })"
          @click="removeSection(grid.section.id)"
        />
      </div>
      <div class="qd-cards-grid" :class="{ 'qd-cards-loading': state.loading.value }" :aria-busy="state.loading.value || undefined" :style="minCardWidth ? { '--qd-card-min': minCardWidth } : undefined">
        <div
          v-for="c in grid.cards"
          :key="c.id"
          class="qd-cards-slot"
          :class="{ 'qd-cards-pinned': isPinned(c), 'qd-cards-dragging': dragging === c.id }"
          :style="{ '--qd-card-span': span(c), '--qd-card-rows': rows(c) }"
          :data-card-id="c.id"
          :data-zone-block="c.block ?? c.id"
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
            <QdCardSizePicker
              v-if="cardSizes(c).length > 1"
              class="qd-cards-size"
              :model-value="currentSize(c)"
              :allowed="cardSizes(c)"
              :title="title(c)"
              :cols="gridMax.w"
              :rows="gridMax.h"
              @update:model-value="onSize(c, $event)"
            />
            <select
              v-if="arrangement.sections.length > 1 && !isPinned(c) && !c.card.fixed"
              class="qd-cards-section"
              :value="sectionOfCard(arrangement, c.id)"
              :aria-label="tOr('core.cardsDashboard.section', 'Section of {title}', { title: title(c) })"
              :title="tOr('core.cardsDashboard.section', 'Section of {title}', { title: title(c) })"
              @change="onSection(c, ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="sec in arrangement.sections" :key="sec.id" :value="sec.id">{{ sec.title }}</option>
            </select>
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
            <button
              v-if="c.block"
              type="button"
              class="qd-cards-action qd-cards-remove"
              :aria-label="tOr('core.cardsDashboard.remove', 'Remove {title}', { title: title(c) })"
              :title="tOr('core.cardsDashboard.remove', 'Remove {title}', { title: title(c) })"
              @click="removeCard(c)"
            >
              <i class="pi pi-trash" aria-hidden="true"></i>
            </button>
          </div>
          <QdCardBlockScope :links="c.card.links" :blocks="c.card.blocks" :size="currentSize(c)">
            <component :is="render(blockOf(c), propsOf(c))" v-bind="propsOf(c)" />
          </QdCardBlockScope>
        </div>
        <template v-if="gi === grids.length - 1">
          <div v-for="(b, i) in plainBlocks" :key="`plain-${i}`" class="qd-cards-slot">
            <component :is="render(b)" v-bind="b.props ?? {}" />
          </div>
        </template>
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
      <div v-if="trayView === 'cards' && state.groups.value.hidden.length" class="qd-cards-grid" :style="minCardWidth ? { '--qd-card-min': minCardWidth } : undefined">
        <div
          v-for="c in state.groups.value.hidden"
          :key="c.id"
          class="qd-cards-slot qd-cards-hidden"
          :style="{ '--qd-card-span': span(c), '--qd-card-rows': rows(c) }"
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
            <component :is="render(blockOf(c), propsOf(c))" v-bind="propsOf(c)" />
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
