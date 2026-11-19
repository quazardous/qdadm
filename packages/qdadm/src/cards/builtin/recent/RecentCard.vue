<script setup lang="ts">
/**
 * recent - what was I just looking at? (#5349)
 *
 * The last records opened, the last one first, with what each one is and
 * when it was seen. QdRecentCard feeds it live from useRecent.
 * See meta.json for the sheet.
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from '../../../i18n/useI18n'
import { relativeTime } from '../shared'
import type { CardSize } from '../../types'

interface RecentData {
  items: Array<{ label: string; to: RouteLocationRaw; at?: string | number; note?: string }>
}

const props = defineProps<{ data: RecentData; options: { maxItems?: number }; size: CardSize }>()
const { locale } = useI18n()

const lines = computed(() =>
  props.data.items.slice(0, props.options.maxItems ?? 5).map((item) => ({
    ...item,
    when: item.at === undefined ? null : relativeTime(item.at, locale.value),
    whenTitle: item.at === undefined ? undefined : new Date(item.at).toLocaleString(locale.value),
  }))
)
</script>

<template>
  <ul class="qd-recent">
    <li v-for="(line, i) in lines" :key="i" class="qd-recent-item">
      <RouterLink :to="line.to" class="qd-recent-link">
        <span class="qd-recent-label">{{ line.label }}</span>
        <span v-if="line.note" class="qd-recent-note">{{ line.note }}</span>
      </RouterLink>
      <time v-if="line.when" class="qd-recent-when" :datetime="new Date(line.at!).toISOString()" :title="line.whenTitle">{{ line.when }}</time>
    </li>
  </ul>
</template>
