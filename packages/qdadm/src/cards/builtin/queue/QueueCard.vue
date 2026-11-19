<script setup lang="ts">
/**
 * queue - what do I have to do? (#5339)
 *
 * How many wait, then one line per item, each with its gesture. The
 * background under a line advances with its age against the promised delay,
 * warmer as it nears it; the age is written too, so warmth is never alone.
 * See meta.json for the sheet.
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from '../../../i18n/useI18n'
import { formatNumber } from '../shared'
import type { CardSize } from '../../types'

interface QueueItem {
  label: string
  age?: number
  due?: number
  to?: RouteLocationRaw
  action?: { verb: string; to: RouteLocationRaw }
}
interface QueueData {
  total?: number
  note?: string
  items: QueueItem[]
}

const props = defineProps<{ data: QueueData; options: { ageUnit?: 'min' | 'h' | 'd'; maxItems?: number }; size: CardSize }>()
const { t, locale } = useI18n()

const total = computed(() => props.data.total ?? props.data.items.length)
const unit = computed(() => t(`core.cards.ageUnit.${props.options.ageUnit ?? 'd'}`))

const lines = computed(() =>
  props.data.items.slice(0, props.options.maxItems ?? 3).map((item) => {
    const ratio = item.age !== undefined && item.due ? item.age / item.due : null
    return {
      ...item,
      fill: ratio === null ? 0 : Math.min(ratio, 1) * 100,
      warmth: ratio === null ? 'none' : ratio >= 1 ? 'overdue' : ratio >= 0.6 ? 'warm' : 'cool',
      ageText: item.age === undefined ? null : `${formatNumber(item.age, locale.value, { decimals: 0 })}\u202f${unit.value}`,
    }
  })
)
</script>

<template>
  <div class="qd-queue">
    <div class="qd-metric-line">
      <span class="qd-card-value">{{ formatNumber(total, locale) }}</span>
      <span v-if="data.note" class="qd-card-unit">{{ data.note }}</span>
    </div>
    <ul class="qd-queue-items">
      <li v-for="(line, i) in lines" :key="i" class="qd-queue-item" :data-warmth="line.warmth">
        <span class="qd-queue-age-bg" :style="{ width: `${line.fill}%` }" aria-hidden="true"></span>
        <component :is="line.to ? RouterLink : 'span'" :to="line.to" class="qd-queue-label">{{ line.label }}</component>
        <span v-if="line.ageText" class="qd-queue-age" :title="line.warmth === 'overdue' ? t('core.cards.overdue') : undefined">
          {{ line.ageText }}<span v-if="line.warmth === 'overdue'" class="qd-card-sr"> · {{ t('core.cards.overdue') }}</span>
        </span>
        <RouterLink v-if="line.action" :to="line.action.to" class="qd-queue-gesture">{{ line.action.verb }}</RouterLink>
      </li>
    </ul>
  </div>
</template>
