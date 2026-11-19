<script setup lang="ts">
/**
 * ranking - what works? (#5355)
 *
 * The first N, ranked, with their values; a bar per line when asked, scaled
 * to the first. Each line opens its item. See meta.json for the sheet.
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from '../../../i18n/useI18n'
import { formatNumber } from '../shared'
import type { CardSize } from '../../types'

const props = defineProps<{
  data: { items: Array<{ label: string; value: number; to?: RouteLocationRaw }> }
  options: { maxItems?: number; unit?: string; bars?: boolean }
  size: CardSize
}>()
const { locale } = useI18n()

const lines = computed(() => {
  const items = [...props.data.items].sort((a, b) => b.value - a.value).slice(0, props.options.maxItems ?? 5)
  const max = Math.max(0, ...items.map((i) => i.value))
  return items.map((item, i) => ({ ...item, rank: i + 1, share: max ? (item.value / max) * 100 : 0, text: formatNumber(item.value, locale.value, { unit: props.options.unit }) }))
})
</script>

<template>
  <ol class="qd-ranking">
    <li v-for="line in lines" :key="line.rank" class="qd-ranking-item">
      <span class="qd-ranking-rank">{{ line.rank }}</span>
      <component :is="line.to ? RouterLink : 'span'" :to="line.to" class="qd-ranking-label">{{ line.label }}</component>
      <span class="qd-ranking-value">{{ line.text }}</span>
      <span v-if="options.bars" class="qd-ranking-track" aria-hidden="true"><span class="qd-ranking-bar" :style="{ width: `${line.share}%` }"></span></span>
    </li>
  </ol>
</template>
