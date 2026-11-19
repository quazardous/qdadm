<script setup lang="ts">
/**
 * agenda - what is coming? (#5355)
 *
 * Dated lines, the first ones first: a time for today, "tomorrow", else a
 * date; each line opens its item. See meta.json for the sheet.
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from '../../../i18n/useI18n'
import { dayWords } from '../shared'
import type { CardSize } from '../../types'

const props = defineProps<{
  data: { now?: string | number; items: Array<{ at: string | number; label: string; to?: RouteLocationRaw; allDay?: boolean }> }
  options: { maxItems?: number }
  size: CardSize
}>()
const { t, locale } = useI18n()

const lines = computed(() => {
  const now = props.data.now !== undefined ? new Date(props.data.now) : new Date()
  return [...props.data.items]
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .slice(0, props.options.maxItems ?? 4)
    .map((item) => ({ ...item, ...dayWords(new Date(item.at), now, locale.value, t, !item.allDay) }))
})
</script>

<template>
  <ul class="qd-agenda">
    <li v-for="(line, i) in lines" :key="i" class="qd-agenda-item">
      <time class="qd-agenda-when" :datetime="line.iso" :title="line.full">{{ line.when }}</time>
      <component :is="line.to ? RouterLink : 'span'" :to="line.to" class="qd-agenda-label">{{ line.label }}</component>
    </li>
  </ul>
</template>
