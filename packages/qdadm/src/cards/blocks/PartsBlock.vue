<script setup lang="ts">
/**
 * parts block (#5414): a whole in parts, one bar split and its legend with
 * each part's name and value. The colours come from a fixed palette by rank,
 * never from the data; the parts past `max` go into a grey "others".
 * Everything the colour says is also written.
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from '../../i18n/useI18n'
import { formatNumber } from '../builtin/shared'
import type { PartsBlock } from './types'
import type { CardSize } from '../types'

const props = defineProps<{ block: PartsBlock; size: CardSize }>()
const { t, locale } = useI18n()

interface Part {
  label: string
  value: number
  to?: RouteLocationRaw
  tone: string
}
const parts = computed<Part[]>(() => {
  const sorted = [...props.block.parts].sort((a, b) => b.value - a.value)
  const max = props.block.max ?? 4
  const shown: Part[] = sorted.slice(0, max).map((p, i) => ({ ...p, tone: String(i + 1) }))
  const rest = sorted.slice(max)
  if (rest.length) shown.push({ label: t('core.cards.split.others'), value: rest.reduce((s, p) => s + p.value, 0), tone: 'others' })
  return shown
})
const sum = computed(() => props.block.parts.reduce((s, p) => s + p.value, 0))
const share = (v: number) => (sum.value ? (v / sum.value) * 100 : 0)
const fmt = (v: number) => formatNumber(v, locale.value, { unit: props.block.unit })
</script>

<template>
  <div class="qd-card-block" data-block="parts">
    <div class="qd-split-bar" aria-hidden="true">
      <span v-for="p in parts" :key="p.label" class="qd-split-part" :data-tone="p.tone" :style="{ width: `${share(p.value)}%` }" :title="`${p.label}: ${fmt(p.value)}`"></span>
    </div>
    <ul class="qd-split-legend">
      <li v-for="p in parts" :key="p.label">
        <span class="qd-split-swatch" :data-tone="p.tone" aria-hidden="true"></span>
        <component :is="p.to ? RouterLink : 'span'" :to="p.to" class="qd-split-label">{{ p.label }}</component>
        <span class="qd-split-value">{{ fmt(p.value) }}</span>
      </li>
    </ul>
  </div>
</template>
