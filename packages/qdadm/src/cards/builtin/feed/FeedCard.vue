<script setup lang="ts">
/**
 * feed - what happened? (#5355)
 *
 * The latest events first, with when (a time for today, else a day), each
 * opening its item; a status as a side mark and a word. See meta.json for
 * the sheet.
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from '../../../i18n/useI18n'
import { dayWords } from '../shared'
import type { CardSize, CardStatus } from '../../types'

const props = defineProps<{
  data: { now?: string | number; items: Array<{ at: string | number; label: string; to?: RouteLocationRaw; status?: CardStatus }> }
  options: { maxItems?: number }
  size: CardSize
}>()
const { t, locale } = useI18n()

const lines = computed(() => {
  const now = props.data.now !== undefined ? new Date(props.data.now) : new Date()
  return [...props.data.items]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, props.options.maxItems ?? 4)
    .map((item) => ({ ...item, ...dayWords(new Date(item.at), now, locale.value, t, true) }))
})
</script>

<template>
  <ul class="qd-feed">
    <li v-for="(line, i) in lines" :key="i" class="qd-feed-item" :data-status="line.status">
      <time class="qd-feed-when" :datetime="line.iso" :title="line.full">{{ line.when }}</time>
      <component :is="line.to ? RouterLink : 'span'" :to="line.to" class="qd-feed-label">{{ line.label }}</component>
      <span v-if="line.status" class="qd-feed-status">{{ t(`core.cards.status.${line.status}`) }}</span>
    </li>
  </ul>
</template>
