<script setup lang="ts">
/**
 * QdCard - the envelope every card shares (#5339)
 *
 * qdadm draws the frame, the card type draws the body (the default slot):
 *
 *   <QdCard title="Commandes à traiter" status="critical" source="boutique" :freshness="readAt"
 *           :to="{ name: 'orders' }" :action="{ verb: 'Traiter la 1re', mode: 'next', to: firstOrder }">
 *     …the body…
 *   </QdCard>
 *
 * Two zones, one thing each: the surface (the title's link stretched over the
 * card) opens the domain's board; the action button, and any link or button
 * in the body, does its own gesture and stops there.
 *
 * The status is a hue, a side bar and a word: never the hue alone.
 * States `loading`, `unreachable`, `empty` and `invalid` replace the body.
 */
import { computed, inject, ref, useSlots } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useI18n } from '../i18n/useI18n'
import type { CardAction, CardLink, CardSize, CardState, CardStatus } from './types'
import { CARD_BLOCK_LINKS } from './blockLinks'
import type { SchemaProblem } from './validate'
import { useRun } from '../run/useRun'
import type { RouteLocationRaw } from 'vue-router'

const props = withDefaults(
  defineProps<{
    title: string
    /** An icon class drawn before the title */
    icon?: string | null
    status?: CardStatus | null
    source?: string | null
    freshness?: string | number | Date | null
    to?: RouteLocationRaw | null
    action?: CardAction | null
    /** Secondary gestures beside the action (#5405); the `#cta` slot adds the app's own */
    links?: CardLink[] | null
    state?: CardState
    size?: CardSize
    error?: string | null
    emptyText?: string | null
    /** `invalid`: what does not fit the schema */
    problems?: SchemaProblem[]
  }>(),
  {
    icon: null,
    status: null,
    source: null,
    freshness: null,
    to: null,
    action: null,
    links: null,
    state: 'ready',
    size: 's',
    error: null,
    emptyText: null,
    problems: () => [],
  }
)

const { t, locale } = useI18n()
const router = useRouter()
const run = useRun()

const STATUS_ICONS: Record<CardStatus, string> = {
  critical: 'pi pi-exclamation-circle',
  watch: 'pi pi-exclamation-triangle',
  good: 'pi pi-check-circle',
  info: 'pi pi-info-circle',
}

const span = computed(() => ({ s: 1, m: 2, l: 3 })[props.size] ?? 1)

/** "3 min ago", in the app's language */
const freshnessText = computed(() => {
  if (props.freshness === null || props.freshness === undefined || props.freshness === '') return null
  const at = props.freshness instanceof Date ? props.freshness : new Date(props.freshness)
  if (Number.isNaN(at.getTime())) return String(props.freshness)
  const seconds = Math.round((at.getTime() - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 45) return rtf.format(0, 'second')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  return rtf.format(Math.round(seconds / 86400), 'day')
})
const freshnessTitle = computed(() => {
  if (!props.freshness) return undefined
  const at = props.freshness instanceof Date ? props.freshness : new Date(props.freshness)
  return Number.isNaN(at.getTime()) ? undefined : at.toLocaleString(locale.value)
})

const running = ref(false)
async function onAction(): Promise<void> {
  const action = props.action
  if (!action || running.value) return
  if (action.onClick) {
    running.value = true
    try {
      await action.onClick()
    } finally {
      running.value = false
    }
  } else if (action.run) {
    await run.start(action.run)
  } else if (action.to) {
    await router.push(action.to)
  }
}

// The foot's links (#5405): the card's own, then the block's (`card.links` on a dashboard)
const blockLinks = inject(CARD_BLOCK_LINKS, null)
const slots = useSlots()
const allLinks = computed<CardLink[]>(() => [...(props.links ?? []), ...(blockLinks?.value ?? [])])
const hasCta = computed(() => !!slots.cta || allLinks.value.length > 0 || (!!props.action && props.state === 'ready'))
async function onLink(link: CardLink): Promise<void> {
  if (link.onClick) await link.onClick()
  else if (link.run) await run.start(link.run)
}

const actionIcon = computed(() => (props.action?.mode === 'list' ? 'pi pi-list' : 'pi pi-arrow-right'))
</script>

<template>
  <article
    class="qd-card"
    :class="[status ? `qd-card--${status}` : null, `qd-card--${size}`, `qd-card--${state}`, { 'qd-card--link': !!to }]"
    :style="{ '--qd-card-span': span }"
    :aria-busy="state === 'loading' ? 'true' : undefined"
    :data-card-state="state"
  >
    <header class="qd-card-head">
      <h3 class="qd-card-title">
        <i v-if="icon" class="qd-card-icon" :class="icon" aria-hidden="true"></i>
        <RouterLink v-if="to" :to="to" class="qd-card-surface">{{ title }}</RouterLink>
        <span v-else>{{ title }}</span>
      </h3>
      <span v-if="status" class="qd-card-status">
        <i :class="STATUS_ICONS[status]" aria-hidden="true"></i>
        {{ t(`core.cards.status.${status}`) }}
      </span>
    </header>

    <div class="qd-card-body">
      <div v-if="state === 'loading'" class="qd-card-placeholder qd-card-loading" role="status">
        <span class="qd-card-skeleton qd-card-skeleton--big"></span>
        <span class="qd-card-skeleton"></span>
        <span class="qd-card-skeleton qd-card-skeleton--short"></span>
        <span class="qd-card-sr">{{ t('core.cards.loading') }}</span>
      </div>
      <div v-else-if="state === 'unreachable'" class="qd-card-placeholder qd-card-unreachable" role="status">
        <i class="pi pi-wifi" aria-hidden="true"></i>
        <strong>{{ t('core.cards.unreachable') }}</strong>
        <span v-if="error" class="qd-card-detail">{{ error }}</span>
      </div>
      <div v-else-if="state === 'empty'" class="qd-card-placeholder qd-card-empty" role="status">
        <i class="pi pi-check" aria-hidden="true"></i>
        <span>{{ emptyText || t('core.cards.empty') }}</span>
      </div>
      <div v-else-if="state === 'invalid'" class="qd-card-placeholder qd-card-invalid" role="alert">
        <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
        <strong>{{ t('core.cards.invalid') }}</strong>
        <ul class="qd-card-problems">
          <li v-for="(p, i) in problems.slice(0, 4)" :key="i"><code>{{ p.path }}</code> {{ p.message }}</li>
          <li v-if="problems.length > 4">{{ t('core.cards.moreProblems', { count: problems.length - 4 }) }}</li>
        </ul>
      </div>
      <slot v-else></slot>
    </div>

    <footer v-if="source || freshnessText || hasCta" class="qd-card-foot">
      <span class="qd-card-meta">
        <span v-if="source" class="qd-card-source">{{ source }}</span>
        <span v-if="source && freshnessText" aria-hidden="true"> · </span>
        <time v-if="freshnessText" :title="freshnessTitle" class="qd-card-fresh">{{ freshnessText }}</time>
      </span>
      <!-- The CTA zone (#5405): every gesture of the foot together, the
           native ones (links, the action) and the app's own (#cta slot) -->
      <span v-if="hasCta" class="qd-card-cta" data-card-cta>
        <template v-for="(link, i) in allLinks" :key="i">
          <RouterLink v-if="link.to" :to="link.to" class="qd-card-link" data-card-link>
            <i v-if="link.icon" :class="link.icon" aria-hidden="true"></i>{{ link.label }}
          </RouterLink>
          <button v-else type="button" class="qd-card-link" data-card-link @click="onLink(link)">
            <i v-if="link.icon" :class="link.icon" aria-hidden="true"></i>{{ link.label }}
          </button>
        </template>
        <slot name="cta" :links="allLinks" :action="action" :state="state"></slot>
        <button
          v-if="action && state === 'ready'"
          type="button"
          class="qd-card-action"
          :class="{ 'qd-card-action--busy': running }"
          :disabled="running"
          :data-mode="action.mode || 'next'"
          @click="onAction"
        >
          <span>{{ action.verb }}</span>
          <i :class="actionIcon" aria-hidden="true"></i>
        </button>
      </span>
    </footer>
  </article>
</template>
