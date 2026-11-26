<script setup lang="ts">
/**
 * QdDomainBar (#5389): the bar on top of every page of a domain. Its title,
 * its navigation (the current entry marked, a badge on each entry that names
 * an indicator) and its indicators: mini cards, each read from its own source
 * and drawn as a pill whose count is a badge.
 *
 * Its look (#5400): a toolbox, one low line glued to the top edge of the
 * content in the side menu's style (the default), or a card above the page:
 * the domain's `look`, else the app's `features.domainBar.look`. Both are
 * drawn from CSS custom properties (`--qd-domain-bar-*`, `--qd-toolbox-*`),
 * to change in the app's own CSS.
 *
 * Full (#5424): the bar extends downward, its indicators a row of mini cards
 * under the title and the navigation: the title, the value large, the
 * sparkline across. Compact: one line of icons and pills, on its own once the
 * page scrolls, or by the person's choice, kept per account; a pill keeps its
 * sparkline while the line has room, its title in the tooltip.
 *
 * Each indicator knows the bar's mode (#5422): `data-mode` on it, the mode
 * passed to its card's pill form and to the app's own component, with
 * `compact` overrides.
 */
import { computed, inject, provide, markRaw, nextTick, onBeforeUnmount, onMounted, onUpdated, ref, toRaw, watch, type Component, type Ref } from 'vue'
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { useI18n } from '../i18n/useI18n'
import { useAuth } from '../composables/useAuth'
import { useAsyncRead } from '../composables/useAsyncRead'
import { getCard, checkCardInput, resolveCardOptions } from '../cards/registry'
import type { CardPillMode, CardStatus } from '../cards/types'
import type { CardBlock } from '../cards/blocks/types'
import QdCardBlocks from '../cards/blocks/QdCardBlocks.vue'
import { CHART_MODE } from '../cards/blocks/charts'
import { normalizeSeries } from '../cards/blocks/viz'
import QdBadge from './QdBadge.vue'
import { acquireSource, type SourceRead, type SourceSignals } from './sources'
import { badgeTone, type DomainDefinition, type DomainIndicator, type DomainIndicatorProps, type DomainLook, type DomainNavEntry } from './registry'
import { domainBarIndicators } from './layout'

const props = defineProps<{
  domain: DomainDefinition
  /**
   * The app's layout (#5526): which indicators, in which order, with which
   * parameters; null or none: the declared ones. Read once: a new layout is a
   * new bar (the zone keys it)
   */
  layout?: unknown
}>()

// The look (#5400): the domain's, else the app's, else the toolbox
const features = inject<{ domainBar?: { look?: DomainLook; maxCards?: number } } | null>('qdadmFeatures', null)
let warned = false
const look = computed<'toolbox' | 'card'>(() => {
  const asked = props.domain.look ?? features?.domainBar?.look ?? 'toolbox'
  if (asked === 'card') return 'card'
  if (asked === 'ribbon' && !warned && (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true) {
    warned = true
    console.warn(`[qdadm] domain('${props.domain.name}'): the 'ribbon' look is withdrawn; it draws the default toolbox. Leave look out, or say 'card'.`)
  }
  return 'toolbox'
})

const { locale, tOr } = useI18n()
const route = useRoute()
const router = useRouter()

// ── Compact ───────────────────────────────────────────────────────────────────
const { user } = useAuth()
const key = computed(() => {
  const u = user.value as { id?: unknown; username?: unknown } | null
  return `qdadm.domainBar.${props.domain.name}.${String(u?.id ?? u?.username ?? 'anonymous')}.compact`
})
function readChoice(): boolean {
  try {
    return globalThis.localStorage?.getItem(key.value) === '1'
  } catch {
    return false
  }
}
const chosen = ref(readChoice())
watch(key, () => (chosen.value = readChoice()))
function toggle(): void {
  chosen.value = !chosen.value
  try {
    if (chosen.value) globalThis.localStorage?.setItem(key.value, '1')
    else globalThis.localStorage?.removeItem(key.value)
  } catch {
    // Blocked storage: the choice lasts the page
  }
}

// Scrolled past the top: compact on its own, the person's choice untouched
const sentinel = ref<HTMLElement | null>(null)
const scrolled = ref(false)
// The height the bar lost going compact on the scroll, kept by a spacer under
// it (#5442): the page keeps its height, so nothing moves (no scroll clamped
// back to the top, no scroll anchoring) and the bar does not flip in a loop
// The spacer comes in the same render as the compact bar, and goes with it:
// a spacer a render late lets the browser's scroll anchoring move the page
const reserve = ref(0)
let fullHeight = 0
let compactHeight = 0
let observer: IntersectionObserver | null = null
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !sentinel.value) return
  observer = new IntersectionObserver(([e]) => {
    const past = !!e && !e.isIntersecting
    if (past === scrolled.value) return
    if (past && !chosen.value) {
      // Its full height, read just before it goes compact; its compact height
      // as last drawn (the first time, none yet: corrected once drawn)
      fullHeight = bar.value?.offsetHeight ?? 0
      reserve.value = Math.max(0, fullHeight - compactHeight)
    } else if (!past) {
      reserve.value = 0
      fullHeight = 0
    }
    scrolled.value = past
  })
  observer.observe(sentinel.value)
})
onBeforeUnmount(() => observer?.disconnect())
const compact = computed(() => chosen.value || scrolled.value)
// Once drawn compact: its compact height read, the spacer made exact; a
// compact the person chose keeps no spacer
watch(
  [scrolled, chosen],
  () => {
    if (scrolled.value && !chosen.value && fullHeight && bar.value) {
      compactHeight = bar.value.offsetHeight
      reserve.value = Math.max(0, fullHeight - compactHeight)
    } else {
      reserve.value = 0
    }
  },
  { flush: 'post' }
)
/** The mode each indicator is drawn in (#5422) */
const mode = computed<CardPillMode>(() =>
  compact.value ? { mode: 'compact', reason: chosen.value ? 'chosen' : 'scrolled' } : { mode: 'full', reason: null }
)
// The app's charts in the bar are told its mode (#5441)
provide(CHART_MODE, mode)

// ── The indicators: each its own read, its own state ──────────────────────────
interface IndicatorView {
  def: DomainIndicator
  /** The value says more than the badge: a unit, a target, no count, or a zero the badge hides */
  showValue: boolean
  state: 'loading' | 'unreachable' | 'invalid' | 'ready'
  value: string
  count: number | null
  status: CardStatus | null
  reason: string | null
  /** The pill's blocks after the badge (a metric's sparkline) */
  blocks: CardBlock[]
  /** The app's own drawing, in this mode, and what it receives */
  component: Component | null
  props: DomainIndicatorProps
  /** Title, icon and link, as given or read from the data (#5438) */
  title: string
  icon: string | null
  to: RouteLocationRaw | null
  /** Left out: its data is read and `visible` says no (#5438) */
  hidden: boolean
}

/** The fields a card's schema declares, when it declares them (#5438) */
function ownFields(schema: { type?: unknown; properties?: Record<string, unknown> } | undefined, data: unknown): unknown {
  if (!schema?.properties || !data || typeof data !== 'object' || Array.isArray(data)) return data
  const keys = Object.keys(schema.properties)
  return Object.fromEntries(Object.entries(data as Record<string, unknown>).filter(([k]) => keys.includes(k)))
}

// The domain's sources (#5461): one read each, shared by the indicators naming it
const signals = inject<SourceSignals | null>('qdadmSignals', null)
const releases: Array<() => void> = []
onBeforeUnmount(() => releases.splice(0).forEach((r) => r()))
function sourceRead(name: string): SourceRead | null {
  const def = props.domain.sources?.[name]
  if (!def) return null
  const { read, release } = acquireSource(`${props.domain.name}:${name}`, def, signals)
  releases.push(release)
  return read
}

function watchIndicator(def: DomainIndicator): Ref<IndicatorView> {
  const shared = def.source !== undefined ? sourceRead(def.source) : null
  // Its own read, as before sources: only without one
  const own = def.source === undefined && def.load ? useAsyncRead(() => def.load!()) : null
  const read: Pick<SourceRead, 'data' | 'error' | 'ready'> | null = shared ?? own
  const missing = def.source !== undefined && !shared
  let timer: ReturnType<typeof setInterval> | null = null
  if (own && def.refresh && def.refresh > 0) {
    onMounted(() => (timer = setInterval(() => void own.load(), def.refresh! * 1000)))
    onBeforeUnmount(() => timer && clearInterval(timer))
  }
  return computed<IndicatorView>(() => {
    const m = mode.value
    const small = m.mode === 'compact' ? def.compact : undefined
    const options = small?.options ? { ...def.options, ...small.options } : def.options ?? {}
    const found = small?.component ?? def.component
    // A component as is, never a reactive copy of it
    const component = found ? markRaw(toRaw(found)) : null
    // Its part of a source's answer (#5461)
    let failed: string | null = null
    let data = read ? (read.ready.value ? read.data.value : undefined) : def.data
    if (shared && def.value && read!.ready.value) {
      try {
        data = def.value(data)
      } catch (err) {
        failed = err instanceof Error ? err.message : String(err)
      }
    }
    const status = (): CardStatus | null => (typeof def.status === 'function' ? def.status(data) ?? null : def.status ?? null)
    // Title, icon and link: fixed, or read from the data at each read (#5438)
    const of = <V,>(v: V | ((d: unknown) => V | undefined) | undefined): V | undefined => {
      if (typeof v !== 'function') return v
      try {
        return (v as (d: unknown) => V | undefined)(data)
      } catch {
        return undefined
      }
    }
    const title = of(def.title) ?? ''
    const icon = of(def.icon) ?? null
    const to = of(def.to) ?? null
    const view = (state: IndicatorView['state'], more: Partial<IndicatorView> = {}): IndicatorView => {
      const read = state !== 'loading' && state !== 'unreachable'
      const hidden = read && !!def.visible && !def.visible(data)
      const v: IndicatorView = { def, value: '', count: null, status: null, reason: null, showValue: false, blocks: [], component, title, icon, to, hidden, ...more, state, props: null as never }
      v.props = { data, options, status: v.status, mode: m, title, icon, state, value: v.value, count: v.count }
      return v
    }
    if (missing) return view('invalid', { reason: `no source '${def.source}' in the domain` })
    if (failed !== null) return view('invalid', { reason: failed })
    if (read && !read.ready.value) return read.error.value ? view('unreachable', { reason: read.error.value }) : view('loading')
    // The app's component alone: the data is its own
    if (!def.card) return component ? view('ready', { status: status() }) : view('invalid', { reason: 'no card and no component' })
    const card = getCard(def.card)
    if (!card?.pill) return view('invalid', { reason: `no card type '${def.card}' with a pill` })
    // The card reads its own fields; the rest of the data is for title, icon, to, visible, status (#5438)
    const cardData = ownFields(card.schema, data)
    const problems = checkCardInput(card, cardData, options)
    if (problems.length) return view('invalid', { reason: problems.map((p) => `${p.path}: ${p.message}`).join('; ') })
    const pill = card.pill(cardData, resolveCardOptions(card.meta, options), locale.value, m)
    const plain = pill.count !== null && pill.count > 0 && pill.value === new Intl.NumberFormat(locale.value).format(pill.count)
    return view('ready', { value: pill.value, count: pill.count, status: status(), showValue: !plain, blocks: pill.blocks ?? [] })
  })
}

// The app's layout (#5526): every declared indicator is read (its count feeds
// the nav badges), the added ones too; the layout says which are drawn
const laid = domainBarIndicators(props.domain, props.layout, features?.domainBar?.maxCards ?? null)
const indicators = laid.indicators.map(watchIndicator)
const byId = computed(() => new Map(indicators.map((i) => [i.value.def.id, i.value])))
/** The ones drawn: the layout's, in its order; a slot whose data says so is left out (#5438) */
const shown = computed(() => {
  const inLayout = laid.shown ? laid.shown.map((id) => indicators.find((i) => i.value.def.id === id)).filter((i): i is (typeof indicators)[number] => !!i) : indicators
  return inLayout.filter((i) => !i.value.hidden)
})

// ── The navigation ────────────────────────────────────────────────────────────
function targetOf(entry: DomainNavEntry): RouteLocationRaw | null {
  if (entry.to) return entry.to
  if (entry.route && router.hasRoute(entry.route)) return { name: entry.route }
  return null
}
const nav = computed(() =>
  (props.domain.nav ?? [])
    .map((entry) => ({ entry, to: targetOf(entry), badge: entry.badge ? byId.value.get(entry.badge) ?? null : null }))
    .filter((n) => n.to !== null)
)
/** The current entry: the one whose route is the deepest matched one */
const current = computed(() => {
  const matched = route.matched.map((r) => r.path)
  let best = -1
  let bestLen = -1
  nav.value.forEach((n, i) => {
    let path: string
    try {
      path = router.resolve(n.to!).matched.at(-1)?.path ?? ''
    } catch {
      return
    }
    if (!path) return
    const hit = matched.some((m) => m === path || m.startsWith(path.endsWith('/') ? path : path + '/'))
    if (hit && path.length > bestLen) {
      best = i
      bestLen = path.length
    }
  })
  return best
})

// ── Compact: the sparklines while the line has room (#5424) ──────────────────
// Short of room (the bar or its navigation overflows), the pills drop their
// sparklines; they come back once the bar is as wide as it was when they went.
const bar = ref<HTMLElement | null>(null)
const tight = ref(false)
let need = 0
function measure(): void {
  const el = bar.value
  if (!el || !compact.value) return
  const nav = el.querySelector<HTMLElement>('.qd-domain-bar-nav')
  const deficit = Math.max(0, el.scrollWidth - el.clientWidth) + (nav ? Math.max(0, nav.scrollWidth - nav.clientWidth) : 0)
  if (!tight.value && deficit > 1) {
    need = el.clientWidth + deficit
    tight.value = true
  } else if (tight.value && el.clientWidth >= need) {
    tight.value = false
  }
}
let resize: ResizeObserver | null = null
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !bar.value) return
  resize = new ResizeObserver(() => measure())
  resize.observe(bar.value)
})
onBeforeUnmount(() => resize?.disconnect())
onUpdated(() => void nextTick(measure))
watch(compact, () => {
  tight.value = false
  need = 0
})

const label = computed(() => tOr('core.domainBar.label', '{domain}: its pages and indicators', { domain: props.domain.label }))
function pillTitle(i: IndicatorView): string {
  const title = i.title
  if (i.state === 'unreachable') return tOr('core.domainBar.unreachable', '{title}: unreachable ({error})', { title, error: i.reason ?? '' })
  if (i.state === 'invalid') return tOr('core.domainBar.invalid', '{title}: data that does not fit', { title }) + (i.reason ? ` (${i.reason})` : '')
  if (i.state === 'loading') return tOr('core.domainBar.loading', '{title}: loading', { title })
  const head = i.value ? `${title}: ${i.value}` : title
  // A chart of several named series: each one's last value (#5441)
  const named: string[] = []
  for (const b of i.blocks) {
    if (b.kind !== 'viz') continue
    for (const s of normalizeSeries(b.series)) {
      const last = s.points.at(-1)
      if (s.label && last) named.push(`${s.label} ${new Intl.NumberFormat(locale.value).format(last.v)}`)
    }
  }
  return named.length ? `${head} (${named.join(', ')})` : head
}
</script>

<template>
  <div ref="sentinel" class="qd-domain-bar-sentinel" aria-hidden="true"></div>
  <section
    ref="bar"
    class="qd-domain-bar"
    :class="[`qd-domain-bar--${look}`, { 'qd-domain-bar--compact': compact }]"
    :aria-label="label"
    :data-domain="domain.name"
    :data-look="look"
    :data-compact="compact ? (chosen ? 'chosen' : 'scrolled') : undefined"
    :data-fit="compact && tight ? 'tight' : undefined"
  >
    <component :is="domain.to ? RouterLink : 'span'" :to="domain.to" class="qd-domain-bar-title">
      <i v-if="domain.icon" :class="domain.icon" aria-hidden="true"></i>
      <span class="qd-domain-bar-name">{{ domain.label }}</span>
    </component>

    <nav v-if="nav.length" class="qd-domain-bar-nav" :aria-label="tOr('core.domainBar.nav', '{domain} pages', { domain: domain.label })">
      <RouterLink
        v-for="(n, i) in nav"
        :key="n.entry.label"
        :to="n.to!"
        class="qd-domain-bar-entry"
        :class="{ 'qd-domain-bar-entry--current': i === current }"
        :aria-current="i === current ? 'page' : undefined"
        :title="compact ? n.entry.label : undefined"
        data-domain-nav
      >
        <i v-if="n.entry.icon" :class="n.entry.icon" aria-hidden="true"></i>
        <span class="qd-domain-bar-entry-label" :class="{ 'qd-card-sr': compact && n.entry.icon }">{{ n.entry.label }}</span>
        <QdBadge v-if="n.badge && n.badge.state === 'ready' && !n.badge.hidden" :count="n.badge.count" :title="n.badge.title" :tone="badgeTone(n.badge.status)" />
      </RouterLink>
    </nav>

    <ul v-if="shown.length" class="qd-domain-bar-indicators" :aria-label="tOr('core.domainBar.indicators', '{domain} indicators', { domain: domain.label })">
      <li
        v-for="ind in shown"
        :key="ind.value.def.id"
        class="qd-domain-pill"
        :data-indicator="ind.value.def.id"
        :data-state="ind.value.state"
        :data-status="ind.value.status || undefined"
        :data-mode="mode.mode"
        :title="pillTitle(ind.value)"
      >
        <component :is="ind.value.to ? RouterLink : 'span'" :to="ind.value.to ?? undefined" class="qd-domain-pill-body">
          <!-- The app's own drawing (#5422), told the bar's mode -->
          <component :is="ind.value.component" v-if="ind.value.component" v-bind="ind.value.props" />
          <!-- Full (#5424): a mini card, the title on top, the value large, the sparkline across -->
          <template v-else-if="!compact">
            <span class="qd-domain-card-head">
              <i v-if="ind.value.icon" :class="ind.value.icon" aria-hidden="true"></i>
              <span class="qd-domain-pill-title">{{ ind.value.title }}</span>
            </span>
            <template v-if="ind.value.state === 'ready'">
              <span class="qd-domain-card-value" :class="{ 'qd-domain-pill-value--zero': ind.value.count === 0 }" data-card-value>{{ ind.value.value }}</span>
              <span v-if="ind.value.blocks.length" class="qd-domain-pill-viz qd-domain-card-viz" data-pill-blocks>
                <QdCardBlocks :blocks="ind.value.blocks" size="s" />
              </span>
            </template>
            <span v-else class="qd-domain-card-value">
              <i v-if="ind.value.state === 'loading'" class="pi pi-spin pi-spinner qd-domain-pill-mark" aria-hidden="true"></i>
              <i v-else class="pi pi-exclamation-triangle qd-domain-pill-mark" aria-hidden="true"></i>
              <span class="qd-card-sr">{{ pillTitle(ind.value) }}</span>
            </span>
          </template>
          <!-- Compact: a pill, its title in the tooltip, its sparkline while there is room -->
          <template v-else>
            <i v-if="ind.value.icon" :class="ind.value.icon" aria-hidden="true"></i>
            <span class="qd-domain-pill-title" :class="{ 'qd-card-sr': ind.value.icon }">{{ ind.value.title }}</span>
            <template v-if="ind.value.state === 'ready'">
              <QdBadge v-if="ind.value.count !== null" :count="ind.value.count" :title="ind.value.title" :tone="badgeTone(ind.value.status)" />
              <span v-if="ind.value.showValue" class="qd-domain-pill-value" :class="{ 'qd-domain-pill-value--zero': ind.value.count === 0 }">{{ ind.value.value }}</span>
              <span v-if="ind.value.blocks.length && !tight" class="qd-domain-pill-viz" data-pill-blocks>
                <QdCardBlocks :blocks="ind.value.blocks" size="s" />
              </span>
            </template>
            <i v-else-if="ind.value.state === 'loading'" class="pi pi-spin pi-spinner qd-domain-pill-mark" aria-hidden="true"></i>
            <i v-else class="pi pi-exclamation-triangle qd-domain-pill-mark" aria-hidden="true"></i>
            <span v-if="ind.value.state !== 'ready'" class="qd-card-sr">{{ pillTitle(ind.value) }}</span>
          </template>
        </component>
      </li>
    </ul>

    <button
      type="button"
      class="qd-domain-bar-toggle"
      :aria-pressed="chosen ? 'true' : 'false'"
      :aria-label="chosen ? tOr('core.domainBar.expand', 'Full bar') : tOr('core.domainBar.compact', 'Compact bar')"
      :title="chosen ? tOr('core.domainBar.expand', 'Full bar') : tOr('core.domainBar.compact', 'Compact bar')"
      data-domain-toggle
      @click="toggle"
    >
      <i :class="chosen ? 'pi pi-window-maximize' : 'pi pi-window-minimize'" aria-hidden="true"></i>
    </button>
  </section>
  <div v-if="reserve" class="qd-domain-bar-reserve" aria-hidden="true" :style="{ height: `${reserve}px` }" data-domain-reserve></div>
</template>
