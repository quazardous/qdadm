<script setup lang="ts">
/**
 * split - where does it come from? (#5355)
 *
 * The total, one bar split in parts, and the legend with each part's name and
 * value. The colours come from a fixed palette by rank, never from the data;
 * the parts past `maxParts` go into a grey "others". Everything the colour
 * says is also written. See meta.json for the sheet.
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from '../../../i18n/useI18n'
import { formatNumber } from '../shared'
import type { CardSize } from '../../types'

interface Part {
  label: string
  value: number
  to?: RouteLocationRaw
}
const props = defineProps<{ data: { total?: number; parts: Part[] }; options: { maxParts?: number; unit?: string }; size: CardSize }>()
const { t, locale } = useI18n()

const parts = computed(() => {
  const sorted = [...props.data.parts].sort((a, b) => b.value - a.value)
  const max = props.options.maxParts ?? 4
  const shown: Array<Part & { tone: string }> = sorted.slice(0, max).map((p, i) => ({ ...p, tone: String(i + 1) }))
  const rest = sorted.slice(max)
  if (rest.length) shown.push({ label: t('core.cards.split.others'), value: rest.reduce((s, p) => s + p.value, 0), tone: 'others' })
  return shown
})
const sum = computed(() => props.data.parts.reduce((s, p) => s + p.value, 0))
const total = computed(() => props.data.total ?? sum.value)
const share = (v: number) => (sum.value ? (v / sum.value) * 100 : 0)
const fmt = (v: number) => formatNumber(v, locale.value)
</script>

<template>
  <div class="qd-split">
    <span class="qd-card-value">{{ formatNumber(total, locale, { unit: options.unit }) }}</span>
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
