<script setup lang="ts">
/**
 * QdDomainBoard (#5352): a domain's board, the level between a dashboard and
 * a list. The app declares typed blocks on a grid of 12 columns; the
 * component knows only the types (kpi, breakdown, top, timeline, and any
 * registered with registerBoardBlock).
 *
 *   <QdDomainBoard :source="{ label: 'LegacyLog', freshness: readAt, to: 'https://…' }" :blocks="[
 *     { type: 'kpi', data: { label: 'Open', value: 69, note: 'signatures not handled' } },
 *     { type: 'breakdown', title: 'By kind', load: () => errors.byKind() },
 *     { type: 'top', title: 'Most frequent', load: () => errors.top(5), more: { label: 'All 69', to: { name: 'php-error' } } },
 *   ]" />
 *
 * Each block reads its own data and draws its own states.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import QdBoardBlock from './QdBoardBlock.vue'
import { useI18n } from '../i18n/useI18n'
import { relativeTime } from '../cards/builtin/shared'
import { getBoardBlock } from './registry'
import type { BoardBlock, BoardSource } from './types'

const props = withDefaults(defineProps<{ blocks: BoardBlock[]; source?: BoardSource | null }>(), { source: null })
const { tOr, locale } = useI18n()

const placed = computed(() =>
  props.blocks.map((block, i) => ({
    key: block.id ?? `${block.type}-${i}`,
    block,
    span: Math.max(1, Math.min(12, Math.round(block.span ?? getBoardBlock(block.type)?.span ?? 12))),
  }))
)

const fresh = computed(() => {
  const at = props.source?.freshness
  if (at === undefined || at === null || at === '') return null
  const date = at instanceof Date ? at : new Date(at)
  if (Number.isNaN(date.getTime())) return { text: String(at), title: undefined }
  return { text: relativeTime(date, locale.value), title: date.toLocaleString(locale.value) }
})
const external = computed(() => typeof props.source?.to === 'string' && /^[a-z]+:\/\//i.test(props.source.to))
</script>

<template>
  <div class="qd-board">
    <p v-if="source" class="qd-board-source">
      <span>{{ tOr('core.board.source', 'Source: {source}', { source: source.label }) }}</span>
      <template v-if="fresh">
        · <span :title="fresh.title">{{ tOr('core.board.readAt', 'read {when}', { when: fresh.text }) }}</span>
      </template>
      <template v-if="source.to">
        ·
        <a v-if="external" :href="(source.to as string)" target="_blank" rel="noopener">{{ tOr('core.board.openSource', 'open {source}', { source: source.label }) }}</a>
        <RouterLink v-else :to="source.to">{{ tOr('core.board.openSource', 'open {source}', { source: source.label }) }}</RouterLink>
      </template>
    </p>
    <div class="qd-board-grid">
      <div v-for="p in placed" :key="p.key" class="qd-board-cell" :style="{ '--qd-board-span': p.span }" :data-board-type="p.block.type">
        <QdBoardBlock :block="p.block" />
      </div>
    </div>
  </div>
</template>
