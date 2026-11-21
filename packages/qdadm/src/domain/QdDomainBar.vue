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
 * Compact: one line of icons and badges, on its own once the page scrolls, or
 * by the person's choice, kept per account.
 *
 * Each indicator knows the bar's mode (#5422): `data-mode` on its pill, the
 * mode passed to its card's pill form (a metric's sparkline, in the full bar
 * only) and to the app's own component, with `compact` overrides.
 */
import { computed, inject, markRaw, onBeforeUnmount, onMounted, ref, toRaw, watch, type Component, type Ref } from 'vue'
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { useI18n } from '../i18n/useI18n'
import { useAuth } from '../composables/useAuth'
import { useAsyncRead } from '../composables/useAsyncRead'
import { getCard, checkCardInput, resolveCardOptions } from '../cards/registry'
import type { CardPillMode, CardStatus } from '../cards/types'
import type { CardBlock } from '../cards/blocks/types'
import QdCardBlocks from '../cards/blocks/QdCardBlocks.vue'
import QdBadge from './QdBadge.vue'
import { badgeTone, type DomainDefinition, type DomainIndicator, type DomainIndicatorProps, type DomainLook, type DomainNavEntry } from './registry'

const props = defineProps<{ domain: DomainDefinition }>()

// The look (#5400): the domain's, else the app's, else the toolbox
const features = inject<{ domainBar?: { look?: DomainLook } } | null>('qdadmFeatures', null)
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
let observer: IntersectionObserver | null = null
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !sentinel.value) return
  observer = new IntersectionObserver(([e]) => (scrolled.value = !!e && !e.isIntersecting))
  observer.observe(sentinel.value)
})
onBeforeUnmount(() => observer?.disconnect())
const compact = computed(() => chosen.value || scrolled.value)
/** The mode each indicator is drawn in (#5422) */
const mode = computed<CardPillMode>(() =>
  compact.value ? { mode: 'compact', reason: chosen.value ? 'chosen' : 'scrolled' } : { mode: 'full', reason: null }
)

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
}

function watchIndicator(def: DomainIndicator): Ref<IndicatorView> {
  const read = def.load ? useAsyncRead(() => def.load!()) : null
  let timer: ReturnType<typeof setInterval> | null = null
  if (read && def.refresh && def.refresh > 0) {
    onMounted(() => (timer = setInterval(() => void read.load(), def.refresh! * 1000)))
    onBeforeUnmount(() => timer && clearInterval(timer))
  }
  return computed<IndicatorView>(() => {
    const m = mode.value
    const small = m.mode === 'compact' ? def.compact : undefined
    const options = small?.options ? { ...def.options, ...small.options } : def.options ?? {}
    const found = small?.component ?? def.component
    // A component as is, never a reactive copy of it
    const component = found ? markRaw(toRaw(found)) : null
    const data = read ? (read.ready.value ? read.data.value : undefined) : def.data
    const status = (): CardStatus | null => (typeof def.status === 'function' ? def.status(data) ?? null : def.status ?? null)
    const view = (state: IndicatorView['state'], more: Partial<IndicatorView> = {}): IndicatorView => {
      const v: IndicatorView = { def, value: '', count: null, status: null, reason: null, showValue: false, blocks: [], component, ...more, state, props: null as never }
      v.props = { data, options, status: v.status, mode: m, title: def.title, icon: def.icon ?? null, state, value: v.value, count: v.count }
      return v
    }
    if (read && !read.ready.value) return read.error.value ? view('unreachable', { reason: read.error.value }) : view('loading')
    // The app's component alone: the data is its own
    if (!def.card) return component ? view('ready', { status: status() }) : view('invalid', { reason: 'no card and no component' })
    const card = getCard(def.card)
    if (!card?.pill) return view('invalid', { reason: `no card type '${def.card}' with a pill` })
    const problems = checkCardInput(card, data, options)
    if (problems.length) return view('invalid', { reason: problems.map((p) => `${p.path}: ${p.message}`).join('; ') })
    const pill = card.pill(data, resolveCardOptions(card.meta, options), locale.value, m)
    const plain = pill.count !== null && pill.count > 0 && pill.value === new Intl.NumberFormat(locale.value).format(pill.count)
    return view('ready', { value: pill.value, count: pill.count, status: status(), showValue: !plain, blocks: pill.blocks ?? [] })
  })
}

const indicators = (props.domain.indicators ?? []).map(watchIndicator)
const byId = computed(() => new Map(indicators.map((i) => [i.value.def.id, i.value])))

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

const label = computed(() => tOr('core.domainBar.label', '{domain}: its pages and indicators', { domain: props.domain.label }))
function pillTitle(i: IndicatorView): string {
  const title = i.def.title
  if (i.state === 'unreachable') return tOr('core.domainBar.unreachable', '{title}: unreachable ({error})', { title, error: i.reason ?? '' })
  if (i.state === 'invalid') return tOr('core.domainBar.invalid', '{title}: data that does not fit', { title }) + (i.reason ? ` (${i.reason})` : '')
  if (i.state === 'loading') return tOr('core.domainBar.loading', '{title}: loading', { title })
  return i.value ? `${title}: ${i.value}` : title
}
</script>

<template>
  <div ref="sentinel" class="qd-domain-bar-sentinel" aria-hidden="true"></div>
  <section
    class="qd-domain-bar"
    :class="[`qd-domain-bar--${look}`, { 'qd-domain-bar--compact': compact }]"
    :aria-label="label"
    :data-domain="domain.name"
    :data-look="look"
    :data-compact="compact ? (chosen ? 'chosen' : 'scrolled') : undefined"
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
        <QdBadge v-if="n.badge && n.badge.state === 'ready'" :count="n.badge.count" :title="n.badge.def.title" :tone="badgeTone(n.badge.status)" />
      </RouterLink>
    </nav>

    <ul v-if="indicators.length" class="qd-domain-bar-indicators" :aria-label="tOr('core.domainBar.indicators', '{domain} indicators', { domain: domain.label })">
      <li
        v-for="ind in indicators"
        :key="ind.value.def.id"
        class="qd-domain-pill"
        :data-indicator="ind.value.def.id"
        :data-state="ind.value.state"
        :data-status="ind.value.status || undefined"
        :data-mode="mode.mode"
        :title="pillTitle(ind.value)"
      >
        <component :is="ind.value.def.to ? RouterLink : 'span'" :to="ind.value.def.to" class="qd-domain-pill-body">
          <!-- The app's own drawing (#5422), told the bar's mode -->
          <component :is="ind.value.component" v-if="ind.value.component" v-bind="ind.value.props" />
          <template v-else>
            <i v-if="ind.value.def.icon" :class="ind.value.def.icon" aria-hidden="true"></i>
            <span class="qd-domain-pill-title" :class="{ 'qd-card-sr': compact && ind.value.def.icon }">{{ ind.value.def.title }}</span>
            <template v-if="ind.value.state === 'ready'">
              <QdBadge v-if="ind.value.count !== null" :count="ind.value.count" :title="ind.value.def.title" :tone="badgeTone(ind.value.status)" />
              <span v-if="ind.value.showValue" class="qd-domain-pill-value" :class="{ 'qd-domain-pill-value--zero': ind.value.count === 0 }">{{ ind.value.value }}</span>
              <span v-if="ind.value.blocks.length" class="qd-domain-pill-viz" data-pill-blocks>
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
</template>
