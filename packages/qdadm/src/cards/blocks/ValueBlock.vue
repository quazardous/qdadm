<script setup lang="ts">
/**
 * value block (#5414): the number, what it counts, a short word, its change;
 * or, given `then`, now and then side by side and the change between them.
 */
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { formatNumber, formatDelta, deltaTone } from '../builtin/shared'
import type { ValueBlock } from './types'
import type { CardSize } from '../types'

const props = defineProps<{ block: ValueBlock; size: CardSize }>()
const { t, locale } = useI18n()

const fmt = (v: number, decimals = props.block.decimals) => formatNumber(v, locale.value, { decimals, unit: props.block.unit })

const delta = computed(() => {
  const b = props.block
  if (b.then) {
    const diff = b.value - b.then.value
    const percent = b.changeAs === 'percent'
    if (percent && b.then.value === 0) return null
    const amount = percent ? (diff / Math.abs(b.then.value)) * 100 : diff
    const unit = percent ? '%' : b.unit === '%' ? t('core.cards.compare.points') : b.unit
    const text = formatDelta(amount, locale.value, b.decimals ?? 1)
    return { text: unit ? `${text}\u202f${unit}` : text, period: undefined, tone: deltaTone(diff, b.higherIs) }
  }
  if (!b.delta) return null
  return {
    text: formatDelta(b.delta.value, locale.value, b.decimals) + (b.unit ? ` ${b.unit}` : ''),
    period: b.delta.period,
    tone: deltaTone(b.delta.value, b.higherIs),
  }
})
</script>

<template>
  <div v-if="block.then" class="qd-compare qd-card-block" data-block="value">
    <div class="qd-compare-values">
      <div class="qd-compare-now">
        <span class="qd-card-value">{{ fmt(block.value, block.decimals ?? 1) }}</span>
        <span v-if="block.label" class="qd-card-unit">{{ block.label }}</span>
      </div>
      <div class="qd-compare-then">
        <span class="qd-compare-then-value">{{ fmt(block.then.value, block.decimals ?? 1) }}</span>
        <span v-if="block.then.label" class="qd-card-unit">{{ block.then.label }}</span>
      </div>
    </div>
    <span v-if="delta" class="qd-card-delta" :class="`qd-tone--${delta.tone}`">{{ delta.text }}</span>
  </div>
  <div v-else class="qd-metric-line qd-card-block" data-block="value">
    <span class="qd-card-value">{{ fmt(block.value) }}</span>
    <span v-if="block.label" class="qd-card-unit">{{ block.label }}</span>
    <span v-if="block.badge" class="qd-card-badge">{{ block.badge }}</span>
    <span v-if="delta" class="qd-card-delta" :class="`qd-tone--${delta.tone}`">
      {{ delta.text }}<template v-if="delta.period"> / {{ delta.period }}</template>
    </span>
  </div>
</template>
