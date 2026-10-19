<script setup lang="ts">
/**
 * EntityTimeline - what happened to one entity, across several actors (#4111)
 *
 * Usage:
 *   <EntityTimeline :events="order.events" :actors="ACTORS" />
 *   <EntityTimeline :source="{ entity: 'order_events', filters: { order_id: id } }" :actors="ACTORS"
 *     :gaps="[{ label: 'order → ready to ship', from: (e) => e.kind === 'imported', to: (e) => e.kind === 'ready' }]">
 *     <template #detail="{ event }"><PayloadViewer :body="event.payload" /></template>
 *   </EntityTimeline>
 *
 * One column, each event marked with its actor's colour and icon. Lanes side
 * by side read badly once the screen narrows or the timeline sits in a
 * dialog, and an actor filter answers "what did the carrier do" better.
 *
 * In `source` mode the events are read through the entity's manager, and
 * reread when the entity changes elsewhere (live entities): new events flash.
 */
import { computed, inject, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue'
import { routeLocationKey, routerKey, type RouteLocationNormalizedLoaded, type Router } from 'vue-router'
import QdButton from '../base/QdButton.vue'
import { useI18n } from '../../i18n/useI18n'
import { useLiveEntity } from '../../composables/useLiveEntity'

export interface TimelineActor {
  label?: string
  /** Any CSS colour. */
  color?: string
  /** A PrimeIcons class, e.g. `pi pi-truck`. */
  icon?: string
}

export interface TimelineItem {
  id?: string | number
  at: string | number | Date
  actor?: string | null
  title: string
  kind?: string | null
  severity?: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | null
}

export interface TimelineGap {
  label: string
  /** The event the duration starts from: the first one that matches. */
  from: (event: unknown) => boolean
  /** The event it ends at: the first matching one after `from`. */
  to: (event: unknown) => boolean
}

export interface TimelineSource {
  entity: string
  filters?: Record<string, unknown>
  /** How many events to read. Default 500. */
  limit?: number
}

interface Props {
  events?: unknown[] | null
  source?: TimelineSource | null
  /** Turn an app event into what the timeline shows. Default reads `at`/`created_at`, `actor`, `title`/`label`/`message`. */
  map?: ((event: unknown) => TimelineItem) | null
  actors?: Record<string, TimelineActor>
  order?: 'asc' | 'desc'
  /** `true`: time since the previous event. A list: named durations between two events. */
  gaps?: boolean | TimelineGap[]
  /** Keep the actor filter in the URL under this query key. */
  queryKey?: string | null
  /** Scroll inside the timeline; without it the page scrolls. */
  height?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  events: null,
  source: null,
  map: null,
  actors: () => ({}),
  order: 'asc',
  gaps: false,
  queryKey: null,
  height: null,
})

const { t, locale } = useI18n()
const slots = useSlots()
const orchestrator = inject<{ get: (name: string) => unknown } | null>('qdadmOrchestrator', null)
const router = inject<Router | null>(routerKey, null)
const route = inject<RouteLocationNormalizedLoaded | null>(routeLocationKey, null)

// --- Loading ---

const loaded = ref<unknown[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const freshIds = ref(new Set<string>())
let seenIds: Set<string> | null = null
let loads = 0
const now = ref(Date.now())
let flashTimer: ReturnType<typeof setTimeout> | null = null

function managerOf(): { list: (p: Record<string, unknown>) => Promise<{ items: unknown[] }> } | null {
  if (!props.source || !orchestrator) return null
  return orchestrator.get(props.source.entity) as { list: (p: Record<string, unknown>) => Promise<{ items: unknown[] }> }
}

async function load(): Promise<void> {
  const manager = managerOf()
  if (!manager || !props.source) return
  loading.value = true
  try {
    const { items } = await manager.list({ filters: props.source.filters ?? {}, page_size: props.source.limit ?? 500 })
    loads++
    loaded.value = items
    loadError.value = null
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

if (props.source) {
  void load()
  useLiveEntity(props.source.entity, managerOf(), load)
  watch(() => [props.source?.entity, JSON.stringify(props.source?.filters ?? {})], () => {
    seenIds = null
    void load()
  })
}

// --- Normalising ---

function defaultMap(raw: unknown): TimelineItem {
  const e = (raw ?? {}) as Record<string, unknown>
  return {
    id: e.id as string | number | undefined,
    at: (e.at ?? e.created_at ?? e.timestamp ?? e.date) as string,
    actor: (e.actor as string) ?? null,
    title: String(e.title ?? e.label ?? e.message ?? e.kind ?? ''),
    kind: (e.kind as string) ?? null,
    severity: (e.severity as TimelineItem['severity']) ?? null,
  }
}

interface Entry {
  key: string
  raw: unknown
  item: TimelineItem
  time: number
}

/** Chronological, whatever the display order. */
const chronological = computed<Entry[]>(() => {
  const mapper = props.map ?? defaultMap
  const list = props.source ? loaded.value : props.events ?? []
  return list
    .map((raw, i) => {
      const item = mapper(raw)
      const time = new Date(item.at).getTime()
      return { key: item.id !== undefined ? String(item.id) : `${time}:${i}`, raw, item, time }
    })
    .filter((e) => !Number.isNaN(e.time))
    .sort((a, b) => a.time - b.time)
})

// New events since the last read flash for a moment; the first read does not.
watch(chronological, (entries) => {
  now.value = Date.now()
  const keys = new Set(entries.map((e) => e.key))
  // In source mode the list starts empty: the first read is not news either.
  if (seenIds && (!props.source || loads > 1)) {
    const fresh = entries.filter((e) => !seenIds!.has(e.key)).map((e) => e.key)
    if (fresh.length) {
      freshIds.value = new Set(fresh)
      if (flashTimer) clearTimeout(flashTimer)
      flashTimer = setTimeout(() => (freshIds.value = new Set()), 2500)
      noteNewEvents(fresh.length)
    }
  }
  seenIds = keys
}, { immediate: true })

// --- Actor filter ---

const actorKeys = computed(() => {
  const seen = new Set<string>()
  for (const e of chronological.value) if (e.item.actor) seen.add(e.item.actor)
  return [...seen]
})

function readQuery(): Set<string> {
  if (!props.queryKey || !route) return new Set()
  const v = route.query[props.queryKey]
  const s = Array.isArray(v) ? v.join(',') : v ?? ''
  return new Set(String(s).split(',').filter(Boolean))
}

const hiddenActors = ref<Set<string>>(readQuery())

function toggleActor(actor: string): void {
  const next = new Set(hiddenActors.value)
  if (next.has(actor)) next.delete(actor)
  else next.add(actor)
  hiddenActors.value = next
  if (props.queryKey && router && route) {
    const query = { ...route.query }
    if (next.size) query[props.queryKey] = [...next].join(',')
    else delete query[props.queryKey]
    void router.replace({ query })
  }
}

const currentOrder = ref(props.order)
watch(() => props.order, (o) => (currentOrder.value = o))

const actorOf = (key: string | null | undefined): TimelineActor => (key ? props.actors[key] ?? {} : {})
const actorLabel = (key: string) => actorOf(key).label ?? key

// --- Gaps ---

const DAY = 86_400_000

/** "17 h", "2 h 5 min", "45 s": the largest unit, and the next one when it is not zero. */
function duration(ms: number): string {
  const units: Array<[number, string]> = [[DAY, 'd'], [3_600_000, 'h'], [60_000, 'min'], [1000, 's']]
  const abs = Math.abs(ms)
  const i = units.findIndex(([size]) => abs >= size)
  if (i === -1) return '0 s'
  const [size, unit] = units[i]!
  const first = Math.floor(abs / size)
  const next = units[i + 1]
  const second = next ? Math.floor((abs - first * size) / next[0]) : 0
  return second > 0 && next ? `${first} ${unit} ${second} ${next[1]}` : `${first} ${unit}`
}

const namedGaps = computed(() => {
  if (!Array.isArray(props.gaps)) return []
  return props.gaps.map((gap) => {
    const start = chronological.value.find((e) => gap.from(e.raw))
    const end = start && chronological.value.find((e) => e.time >= start.time && e !== start && gap.to(e.raw))
    return { label: gap.label, value: start && end ? duration(end.time - start.time) : null }
  })
})

// --- Rows ---

interface Row {
  type: 'day' | 'event'
  key: string
  day?: string
  entry?: Entry
  /** Time since the previous visible event, chronologically. */
  since?: string | null
}

const dayFormat = computed(() => new Intl.DateTimeFormat(locale.value, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))
const timeFormat = computed(() => new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
const fullFormat = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'full', timeStyle: 'medium' }))

const rows = computed<Row[]>(() => {
  const visible = chronological.value.filter((e) => !e.item.actor || !hiddenActors.value.has(e.item.actor))
  const withSince = visible.map((entry, i) => ({
    entry,
    since: props.gaps === true && i > 0 ? duration(entry.time - visible[i - 1]!.time) : null,
  }))
  const ordered = currentOrder.value === 'desc' ? [...withSince].reverse() : withSince
  const out: Row[] = []
  let lastDay = ''
  for (const { entry, since } of ordered) {
    const day = dayFormat.value.format(entry.time)
    if (day !== lastDay) {
      out.push({ type: 'day', key: `day:${day}`, day })
      lastDay = day
    }
    out.push({ type: 'event', key: entry.key, entry, since })
  }
  return out
})

// --- Relative time ---

let ticker: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  ticker = setInterval(() => (now.value = Date.now()), 30_000)
})

function relative(time: number): string {
  const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
  // A clock a little behind the event's (server time, or `now` not ticked
  // yet) must not read "in 2 seconds".
  const diff = Math.min(0, time - now.value) || 0
  const abs = Math.abs(diff)
  if (abs < 60_000) return rtf.format(Math.round(diff / 1000), 'second')
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute')
  if (abs < DAY) return rtf.format(Math.round(diff / 3_600_000), 'hour')
  return rtf.format(Math.round(diff / DAY), 'day')
}

// --- Expand ---

const expandable = computed(() => !!slots.detail)
const expanded = ref(new Set<string>())
function toggle(key: string): void {
  if (!expandable.value) return
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}

// --- New events while scrolled away ---

const scroller = ref<HTMLElement | null>(null)
const unseen = ref(0)

/** Is the end where new events land (top in desc, bottom in asc) in view? */
function newestInView(): boolean {
  const el = scroller.value
  if (!el || !props.height) return true
  return currentOrder.value === 'desc' ? el.scrollTop < 40 : el.scrollTop + el.clientHeight >= el.scrollHeight - 40
}

function noteNewEvents(count: number): void {
  if (!newestInView()) unseen.value += count
  else if (currentOrder.value === 'asc') queueMicrotask(() => requestAnimationFrame(goToNewest))
}

function goToNewest(): void {
  const el = scroller.value
  unseen.value = 0
  if (!el) return
  el.scrollTop = currentOrder.value === 'desc' ? 0 : el.scrollHeight
}

function onScroll(): void {
  if (newestInView()) unseen.value = 0
}

onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker)
  if (flashTimer) clearTimeout(flashTimer)
})

defineExpose({ reload: load })
</script>

<template>
  <div class="qd-timeline">
    <div class="qd-timeline-toolbar">
      <div v-if="actorKeys.length > 1" class="qd-timeline-actors" role="group" :aria-label="t('core.timeline.actors')">
        <button v-for="key in actorKeys" :key="key" type="button" class="qd-timeline-chip"
          :class="{ 'qd-timeline-chip--off': hiddenActors.has(key) }" :aria-pressed="!hiddenActors.has(key)"
          :style="{ '--qd-actor': actorOf(key).color ?? 'var(--p-primary-color)' }" @click="toggleActor(key)">
          <i :class="actorOf(key).icon ?? 'pi pi-circle-fill'" />
          {{ actorLabel(key) }}
        </button>
      </div>
      <QdButton class="qd-timeline-order" size="small" text rounded
        :icon="currentOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'"
        :aria-label="currentOrder === 'asc' ? t('core.timeline.oldestFirst') : t('core.timeline.newestFirst')"
        v-tooltip.top="currentOrder === 'asc' ? t('core.timeline.oldestFirst') : t('core.timeline.newestFirst')"
        @click="currentOrder = currentOrder === 'asc' ? 'desc' : 'asc'" />
      <div v-if="namedGaps.length" class="qd-timeline-gaps">
        <span v-for="gap in namedGaps" :key="gap.label" class="qd-timeline-gap-chip">
          <i class="pi pi-clock" /> {{ gap.label }}: <strong>{{ gap.value ?? '—' }}</strong>
        </span>
      </div>
    </div>

    <div v-if="loadError" class="qd-timeline-error">{{ loadError }}</div>

    <div ref="scroller" class="qd-timeline-body" :style="height ? { maxHeight: height, overflow: 'auto' } : undefined" @scroll="onScroll">
      <div v-if="!rows.length" class="qd-timeline-empty">
        {{ loading ? t('core.timeline.loading') : t('core.timeline.empty') }}
      </div>
      <ol v-else class="qd-timeline-list">
        <template v-for="row in rows" :key="row.key">
          <li v-if="row.type === 'day'" class="qd-timeline-day">{{ row.day }}</li>
          <li v-else class="qd-timeline-event" :class="[
              row.entry!.item.severity ? `qd-timeline-event--${row.entry!.item.severity}` : '',
              { 'qd-timeline-event--fresh': freshIds.has(row.key), 'qd-timeline-event--open': expanded.has(row.key) },
            ]" :style="{ '--qd-actor': actorOf(row.entry!.item.actor).color ?? 'var(--p-surface-400)' }"
            :data-actor="row.entry!.item.actor ?? undefined">
            <span v-if="row.since" class="qd-timeline-since">+{{ row.since }}</span>
            <span class="qd-timeline-marker"><i :class="actorOf(row.entry!.item.actor).icon ?? 'pi pi-circle-fill'" /></span>
            <div class="qd-timeline-content">
              <component :is="expandable ? 'button' : 'div'" :type="expandable ? 'button' : undefined" class="qd-timeline-head"
                :aria-expanded="expandable ? expanded.has(row.key) : undefined" @click="toggle(row.key)">
                <span class="qd-timeline-title">{{ row.entry!.item.title }}</span>
                <span v-if="row.entry!.item.actor" class="qd-timeline-actor">{{ actorLabel(row.entry!.item.actor) }}</span>
                <time class="qd-timeline-time" :datetime="new Date(row.entry!.time).toISOString()" :title="fullFormat.format(row.entry!.time)">
                  {{ timeFormat.format(row.entry!.time) }} · {{ relative(row.entry!.time) }}
                </time>
                <i v-if="expandable" class="qd-timeline-chevron pi" :class="expanded.has(row.key) ? 'pi-chevron-up' : 'pi-chevron-down'" />
              </component>
              <div v-if="expandable && expanded.has(row.key)" class="qd-timeline-detail">
                <div class="qd-timeline-absolute">{{ fullFormat.format(row.entry!.time) }}</div>
                <slot name="detail" :event="row.entry!.raw" :item="row.entry!.item" />
              </div>
            </div>
          </li>
        </template>
      </ol>
    </div>

    <QdButton v-if="unseen > 0" class="qd-timeline-new" size="small" rounded :icon="currentOrder === 'desc' ? 'pi pi-arrow-up' : 'pi pi-arrow-down'"
      :label="t('core.timeline.newEvents', { count: unseen })" @click="goToNewest" />
  </div>
</template>
