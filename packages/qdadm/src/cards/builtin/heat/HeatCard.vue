<script setup lang="ts">
/**
 * heat - when? (#5355)
 *
 * A grid (days × hours, weeks × days): each cell's shade is its value on a
 * sequential scale of five steps, its value in its title and for screen
 * readers; a legend gives the scale. See meta.json for the sheet.
 */
import { computed } from 'vue'
import { useI18n } from '../../../i18n/useI18n'
import { formatNumber } from '../shared'
import type { CardSize } from '../../types'

const props = defineProps<{ data: { columns: string[]; rows: Array<{ label: string; cells: number[] }> }; options: Record<string, never>; size: CardSize }>()
const { t, locale } = useI18n()

const max = computed(() => Math.max(0, ...props.data.rows.flatMap((r) => r.cells)))
const level = (v: number) => (max.value ? Math.min(4, Math.round((v / max.value) * 4)) : 0)
const fmt = (v: number) => formatNumber(v, locale.value)
</script>

<template>
  <div class="qd-heat">
    <table>
      <thead>
        <tr>
          <td></td>
          <th v-for="c in data.columns" :key="c" scope="col">{{ c }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in data.rows" :key="r.label">
          <th scope="row">{{ r.label }}</th>
          <td v-for="(v, i) in r.cells" :key="i" :data-level="level(v)" :title="`${r.label} · ${data.columns[i] ?? ''}: ${fmt(v)}`">
            <span class="qd-card-sr">{{ fmt(v) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="qd-heat-legend" aria-hidden="true">
      <span>{{ t('core.cards.heat.low') }}</span>
      <span v-for="l in 5" :key="l" class="qd-heat-key" :data-level="l - 1"></span>
      <span>{{ t('core.cards.heat.high', { max: fmt(max) }) }}</span>
    </div>
  </div>
</template>
