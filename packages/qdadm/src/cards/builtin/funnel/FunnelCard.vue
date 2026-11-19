<script setup lang="ts">
/**
 * funnel - where is it lost? (#5355)
 *
 * The steps with their counts, bars scaled to the first step, and between two
 * steps the loss in words ("−33 between sent and followed up"). See meta.json
 * for the sheet.
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from '../../../i18n/useI18n'
import { formatNumber } from '../shared'
import type { CardSize } from '../../types'

const props = defineProps<{ data: { steps: Array<{ label: string; value: number; to?: RouteLocationRaw }> }; options: Record<string, never>; size: CardSize }>()
const { t, locale } = useI18n()

const first = computed(() => props.data.steps[0]?.value ?? 0)
const steps = computed(() =>
  props.data.steps.map((s, i) => {
    const prev = props.data.steps[i - 1]
    const lost = prev ? prev.value - s.value : 0
    return {
      ...s,
      share: first.value ? Math.min(100, (s.value / first.value) * 100) : 0,
      text: formatNumber(s.value, locale.value),
      loss: prev && lost > 0 ? t('core.cards.funnel.loss', { count: formatNumber(lost, locale.value), from: prev.label, to: s.label }) : null,
    }
  })
)
</script>

<template>
  <ol class="qd-funnel">
    <li v-for="(s, i) in steps" :key="i" class="qd-funnel-step">
      <span v-if="s.loss" class="qd-funnel-loss">{{ s.loss }}</span>
      <component :is="s.to ? RouterLink : 'div'" :to="s.to" class="qd-funnel-row">
        <span class="qd-funnel-label">{{ s.label }}</span>
        <span class="qd-funnel-track" aria-hidden="true"><span class="qd-funnel-bar" :style="{ width: `${s.share}%` }"></span></span>
        <span class="qd-funnel-value">{{ s.text }}</span>
      </component>
    </li>
  </ol>
</template>
