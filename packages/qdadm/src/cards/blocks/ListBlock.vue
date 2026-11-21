<script setup lang="ts">
/**
 * list block (#5414): lines, each opening its item.
 * - hot (default): the label and a short tag, the items behind a number;
 * - queue: the age against the promised delay, warmer as it nears it, the
 *   age written too, and the line's gesture;
 * - feed: the latest first, when (a time for today, else a day), a status;
 * - ranking: ranked by value, the value, a bar scaled to the first.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from '../../i18n/useI18n'
import { formatNumber, dayWords } from '../builtin/shared'
import type { ListBlock, ListItem } from './types'
import type { CardSize } from '../types'

const props = defineProps<{ block: ListBlock; size: CardSize }>()
const { t, locale } = useI18n()

const look = computed(() => props.block.look ?? 'hot')
const DEFAULT_MAX = { hot: 2, queue: 3, feed: 4, ranking: 5 } as const
const max = computed(() => props.block.max ?? DEFAULT_MAX[look.value])

const ordered = computed<ListItem[]>(() => {
  const items = [...props.block.items]
  if (look.value === 'feed') items.sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime())
  if (look.value === 'ranking') items.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  return items
})
const shown = computed(() => ordered.value.slice(0, max.value))
const more = computed(() => (props.block.more ? props.block.items.length - shown.value.length : 0))

const ageUnit = computed(() => t(`core.cards.ageUnit.${props.block.ageUnit ?? 'd'}`))
const queueLines = computed(() =>
  shown.value.map((item) => {
    const ratio = item.age !== undefined && item.due ? item.age / item.due : null
    return {
      ...item,
      fill: ratio === null ? 0 : Math.min(ratio, 1) * 100,
      warmth: ratio === null ? 'none' : ratio >= 1 ? 'overdue' : ratio >= 0.6 ? 'warm' : 'cool',
      ageText: item.age === undefined ? null : `${formatNumber(item.age, locale.value, { decimals: 0 })} ${ageUnit.value}`,
    }
  })
)
const feedLines = computed(() => {
  const now = props.block.now !== undefined ? new Date(props.block.now) : new Date()
  return shown.value.map((item) => ({ ...item, ...dayWords(new Date(item.at ?? 0), now, locale.value, t, true) }))
})
const rankingLines = computed(() => {
  const top = Math.max(0, ...shown.value.map((i) => i.value ?? 0))
  return shown.value.map((item, i) => ({
    ...item,
    rank: i + 1,
    share: top ? ((item.value ?? 0) / top) * 100 : 0,
    text: formatNumber(item.value ?? 0, locale.value, { unit: props.block.unit }),
  }))
})
</script>

<template>
  <ul v-if="look === 'hot'" class="qd-card-hot qd-card-block" data-block="list">
    <li v-for="(item, i) in shown" :key="i">
      <component :is="item.to ? RouterLink : 'span'" :to="item.to" class="qd-card-hot-line">
        <span class="qd-card-hot-label">{{ item.label }}</span>
        <span v-if="item.tag" class="qd-card-tag" :class="item.tagStatus ? `qd-tone--${item.tagStatus}` : null">{{ item.tag }}</span>
      </component>
    </li>
  </ul>

  <ul v-else-if="look === 'queue'" class="qd-queue-items qd-card-block" data-block="list">
    <li v-for="(line, i) in queueLines" :key="i" class="qd-queue-item" :data-warmth="line.warmth">
      <span class="qd-queue-age-bg" :style="{ width: `${line.fill}%` }" aria-hidden="true"></span>
      <component :is="line.to ? RouterLink : 'span'" :to="line.to" class="qd-queue-label">{{ line.label }}</component>
      <span v-if="line.ageText" class="qd-queue-age" :title="line.warmth === 'overdue' ? t('core.cards.overdue') : undefined">
        {{ line.ageText }}<span v-if="line.warmth === 'overdue'" class="qd-card-sr"> · {{ t('core.cards.overdue') }}</span>
      </span>
      <RouterLink v-if="line.action" :to="line.action.to" class="qd-queue-gesture">{{ line.action.verb }}</RouterLink>
    </li>
  </ul>

  <ul v-else-if="look === 'feed'" class="qd-feed qd-card-block" data-block="list">
    <li v-for="(line, i) in feedLines" :key="i" class="qd-feed-item" :data-status="line.status">
      <time class="qd-feed-when" :datetime="line.iso" :title="line.full">{{ line.when }}</time>
      <component :is="line.to ? RouterLink : 'span'" :to="line.to" class="qd-feed-label">{{ line.label }}</component>
      <span v-if="line.status" class="qd-feed-status">{{ t(`core.cards.status.${line.status}`) }}</span>
    </li>
  </ul>

  <ol v-else class="qd-ranking qd-card-block" data-block="list">
    <li v-for="line in rankingLines" :key="line.rank" class="qd-ranking-item">
      <span class="qd-ranking-rank">{{ line.rank }}</span>
      <component :is="line.to ? RouterLink : 'span'" :to="line.to" class="qd-ranking-label">{{ line.label }}</component>
      <span class="qd-ranking-value">{{ line.text }}</span>
      <span v-if="block.bars" class="qd-ranking-track" aria-hidden="true"><span class="qd-ranking-bar" :style="{ width: `${line.share}%` }"></span></span>
    </li>
  </ol>

  <p v-if="more > 0" class="qd-card-more qd-card-block" data-block="more">{{ t('core.cards.moreProblems', { count: more }) }}</p>
</template>
