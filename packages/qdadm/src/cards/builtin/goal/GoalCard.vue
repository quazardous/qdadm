<script setup lang="ts">
/**
 * goal - am I on time? (#5339)
 *
 * The value against the target, the bar's length for the share reached, a
 * tick for where the expected pace says it should be today, and the words
 * (share, expected share, ahead or behind), so nothing rests on colour.
 * See meta.json for the sheet.
 */
import { computed } from 'vue'
import { useI18n } from '../../../i18n/useI18n'
import { formatNumber } from '../shared'
import type { CardSize } from '../../types'

interface GoalData {
  value: number
  target: number
  start?: string
  due?: string
  now?: string
}

const props = defineProps<{ data: GoalData; options: { unit?: string; decimals?: number }; size: CardSize }>()
const { t, locale } = useI18n()

const fmt = (v: number) => formatNumber(v, locale.value, { decimals: props.options.decimals, unit: props.options.unit })
const pct = (r: number) => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }).format(r)

const progress = computed(() => (props.data.target > 0 ? props.data.value / props.data.target : 0))

/** The share the pace expects today, or null without a period */
const expected = computed(() => {
  const { start, due, now } = props.data
  if (!start || !due) return null
  const s = Date.parse(start)
  const d = Date.parse(due) + 86_400_000 // the last day counts whole
  const n = now ? Date.parse(now) + 86_400_000 : Date.now()
  if ([s, d, n].some(Number.isNaN) || d <= s) return null
  return Math.min(Math.max((n - s) / (d - s), 0), 1)
})
const today = computed(() => {
  const n = props.data.now ? new Date(props.data.now) : new Date()
  return new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }).format(n)
})
const ahead = computed(() => (expected.value === null ? null : progress.value >= expected.value))
</script>

<template>
  <div class="qd-goal">
    <div class="qd-metric-line">
      <span class="qd-card-value">{{ fmt(data.value) }}</span>
      <span class="qd-card-unit">{{ t('core.cards.goal.of', { target: fmt(data.target) }) }}</span>
    </div>
    <div
      class="qd-goal-bar"
      role="meter"
      :aria-valuenow="Math.round(progress * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="t('core.cards.goal.reached', { share: pct(progress) })"
      :data-pace="ahead === null ? 'none' : ahead ? 'ahead' : 'behind'"
    >
      <span class="qd-goal-fill" :style="{ width: `${Math.min(progress, 1) * 100}%` }"></span>
      <span v-if="expected !== null" class="qd-goal-pace" :style="{ left: `${expected * 100}%` }"></span>
    </div>
    <p class="qd-card-note">
      {{ t('core.cards.goal.reached', { share: pct(progress) }) }}<template v-if="expected !== null"
        >; {{ t('core.cards.goal.pace', { date: today, share: pct(expected) }) }}
        <strong class="qd-goal-verdict">{{ ahead ? t('core.cards.goal.ahead') : t('core.cards.goal.behind') }}</strong></template
      >
    </p>
  </div>
</template>
