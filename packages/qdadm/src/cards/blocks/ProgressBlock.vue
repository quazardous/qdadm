<script setup lang="ts">
/**
 * progress block (#5414): a value against a target.
 * - goal (default): the bar's length for the share reached, a tick for where
 *   the expected pace says it should be today, and the words (share,
 *   expected share, ahead or behind), so nothing rests on colour;
 * - bullet: Few's bullet graph: the dark bar is the value, the upright tick
 *   the target, the background ranges poor / fair / good cut at the
 *   thresholds written under the axis, the range the value falls in written.
 */
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { formatNumber } from '../builtin/shared'
import type { ProgressBlock } from './types'
import type { CardSize } from '../types'

const props = defineProps<{ block: ProgressBlock; size: CardSize }>()
const { t, locale } = useI18n()

const fmt = (v: number) => formatNumber(v, locale.value, { decimals: props.block.decimals, unit: props.block.unit })
const pct = (r: number) => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }).format(r)
const look = computed(() => props.block.look ?? 'goal')

// ── goal ──
const progress = computed(() => (props.block.target && props.block.target > 0 ? props.block.value / props.block.target : 0))
/** The share the pace expects today, or null without a period */
const expected = computed(() => {
  const { start, due, now } = props.block
  if (!start || !due) return null
  const s = Date.parse(start)
  const d = Date.parse(due) + 86_400_000 // the last day counts whole
  const n = now ? Date.parse(now) + 86_400_000 : Date.now()
  if ([s, d, n].some(Number.isNaN) || d <= s) return null
  return Math.min(Math.max((n - s) / (d - s), 0), 1)
})
const today = computed(() => {
  const n = props.block.now ? new Date(props.block.now) : new Date()
  return new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }).format(n)
})
const ahead = computed(() => (expected.value === null ? null : progress.value >= expected.value))

// ── bullet ──
const cuts = computed(() => [...(props.block.thresholds ?? [])].sort((a, b) => a - b))
const min = computed(() => props.block.min ?? 0)
const max = computed(() => {
  if (props.block.max !== undefined) return props.block.max
  const top = Math.max(props.block.value, props.block.target ?? -Infinity, ...cuts.value)
  return top + (top - min.value) * 0.15
})
const at = (v: number) => `${Math.min(Math.max((v - min.value) / (max.value - min.value || 1), 0), 1) * 100}%`
const ranges = computed(() => {
  const bounds = [min.value, ...cuts.value, max.value]
  const words = cuts.value.length === 1 ? ['poor', 'good'] : ['poor', 'fair', 'good']
  const ordered = props.block.higherIs === 'worse' ? [...words].reverse() : words
  return bounds.slice(0, -1).map((from, i) => ({ from, to: bounds[i + 1]!, word: ordered[i] ?? 'good' }))
})
const verdict = computed(() => ranges.value.find((r, i) => props.block.value < r.to || i === ranges.value.length - 1)?.word ?? 'fair')
</script>

<template>
  <div v-if="look === 'goal'" class="qd-card-block" data-block="progress">
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
  <div v-else class="qd-card-block" data-block="progress">
    <div
      class="qd-bullet-graph"
      role="img"
      :aria-label="t('core.cards.bullet.aria', { value: fmt(block.value), range: t(`core.cards.bullet.${verdict}`) })"
    >
      <span
        v-for="(r, i) in ranges"
        :key="i"
        class="qd-bullet-range"
        :data-range="r.word"
        :style="{ left: at(r.from), width: `calc(${at(r.to)} - ${at(r.from)})` }"
      ></span>
      <span class="qd-bullet-value" :style="{ width: at(block.value) }"></span>
      <span v-if="block.target !== undefined" class="qd-bullet-target" :style="{ left: at(block.target) }"></span>
    </div>
    <div class="qd-bullet-axis" aria-hidden="true">
      <span :style="{ left: '0%' }">{{ fmt(min) }}</span>
      <span v-for="c in cuts" :key="c" :style="{ left: at(c) }">{{ fmt(c) }}</span>
      <span :style="{ left: '100%' }">{{ fmt(max) }}</span>
    </div>
    <p class="qd-card-note">
      <strong class="qd-bullet-verdict" :data-range="verdict">{{ t(`core.cards.bullet.${verdict}`) }}</strong>
    </p>
  </div>
</template>
