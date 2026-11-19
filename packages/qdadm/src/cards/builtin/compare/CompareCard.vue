<script setup lang="ts">
/**
 * compare - better or worse than before? (#5355)
 *
 * The two values side by side with their labels, and the change, signed, in
 * points or in percent, toned by `higherIs`. See meta.json for the sheet.
 */
import { computed } from 'vue'
import { useI18n } from '../../../i18n/useI18n'
import { formatNumber, formatDelta, deltaTone } from '../shared'
import type { CardSize } from '../../types'

const props = defineProps<{
  data: { now: { value: number; label?: string }; then: { value: number; label?: string } }
  options: { unit?: string; decimals?: number; higherIs?: 'better' | 'worse' | 'neutral'; changeAs?: 'points' | 'percent' }
  size: CardSize
}>()
const { t, locale } = useI18n()

const fmt = (v: number) => formatNumber(v, locale.value, { decimals: props.options.decimals ?? 1, unit: props.options.unit })
const change = computed(() => {
  const { now, then } = props.data
  const diff = now.value - then.value
  const percent = props.options.changeAs === 'percent'
  if (percent && then.value === 0) return null
  const amount = percent ? (diff / Math.abs(then.value)) * 100 : diff
  const unit = percent ? '%' : props.options.unit === '%' ? t('core.cards.compare.points') : props.options.unit
  const text = formatDelta(amount, locale.value, props.options.decimals ?? 1)
  return { text: unit ? `${text} ${unit}` : text, tone: deltaTone(diff, props.options.higherIs) }
})
</script>

<template>
  <div class="qd-compare">
    <div class="qd-compare-values">
      <div class="qd-compare-now">
        <span class="qd-card-value">{{ fmt(data.now.value) }}</span>
        <span v-if="data.now.label" class="qd-card-unit">{{ data.now.label }}</span>
      </div>
      <div class="qd-compare-then">
        <span class="qd-compare-then-value">{{ fmt(data.then.value) }}</span>
        <span v-if="data.then.label" class="qd-card-unit">{{ data.then.label }}</span>
      </div>
    </div>
    <span v-if="change" class="qd-card-delta" :class="`qd-tone--${change.tone}`">{{ change.text }}</span>
  </div>
</template>
