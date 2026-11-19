<script setup lang="ts">
/**
 * kpi (#5352): one number of the domain, its unit, a note, and a status
 * drawn as a side bar and a word, never by the hue alone. `to` opens what
 * the number counts.
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from '../../i18n/useI18n'
import { formatNumber } from '../../cards/builtin/shared'

const props = defineProps<{
  data: { label: string; value: number | string; unit?: string; decimals?: number; note?: string; status?: 'critical' | 'watch' | 'good' | 'info'; to?: RouteLocationRaw }
}>()
const { t, locale } = useI18n()

const value = computed(() =>
  typeof props.data.value === 'number' ? formatNumber(props.data.value, locale.value, { decimals: props.data.decimals, unit: props.data.unit }) : props.data.value
)
</script>

<template>
  <div class="qd-board-kpi" :class="data.status ? `qd-board-kpi--${data.status}` : null">
    <component :is="data.to ? RouterLink : 'div'" :to="data.to" class="qd-board-kpi-body">
      <span class="qd-board-kpi-label">{{ data.label }}</span>
      <span class="qd-board-kpi-value">{{ value }}</span>
      <span v-if="data.status" class="qd-board-kpi-status">{{ t(`core.cards.status.${data.status}`) }}</span>
      <span v-if="data.note" class="qd-board-kpi-note">{{ data.note }}</span>
    </component>
  </div>
</template>
