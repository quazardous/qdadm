<script setup lang="ts">
/**
 * top (#5352): the first items of the domain as a small table with declared
 * columns (text, mono, tags, number, spark). A row with `to` opens its item:
 * its first cell is the link, the others stay readable text.
 */
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from '../../i18n/useI18n'
import { formatNumber, seriesPaths } from '../../cards/builtin/shared'

type ColumnType = 'text' | 'mono' | 'tags' | 'number' | 'spark'
interface Column {
  key: string
  label: string
  type?: ColumnType
}
interface Tag {
  label: string
  status?: 'critical' | 'watch' | 'good' | 'info'
}
defineProps<{ data: { columns: Column[]; rows: Array<{ values: Record<string, unknown>; to?: RouteLocationRaw }> } }>()
const { locale } = useI18n()

const tags = (v: unknown): Tag[] =>
  (Array.isArray(v) ? v : v === undefined || v === null || v === '' ? [] : [v]).map((t) => (typeof t === 'object' && t ? (t as Tag) : { label: String(t) }))
const num = (v: unknown) => (typeof v === 'number' ? formatNumber(v, locale.value) : String(v ?? ''))
const spark = (v: unknown) => (Array.isArray(v) && v.every((n) => typeof n === 'number') ? seriesPaths(v as number[], 100, 24) : null)
</script>

<template>
  <div class="qd-board-top">
    <table>
      <thead>
        <tr>
          <th v-for="c in data.columns" :key="c.key" scope="col" :class="`qd-board-col--${c.type ?? 'text'}`">{{ c.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, ri) in data.rows" :key="ri" :class="{ 'qd-board-top-linked': !!row.to }">
          <td v-for="(c, ci) in data.columns" :key="c.key" :class="`qd-board-col--${c.type ?? 'text'}`">
            <RouterLink v-if="ci === 0 && row.to" :to="row.to" class="qd-board-top-link">{{ row.values[c.key] }}</RouterLink>
            <template v-else-if="c.type === 'tags'">
              <span v-for="(tag, ti) in tags(row.values[c.key])" :key="ti" class="qd-card-tag" :class="tag.status ? `qd-tone--${tag.status}` : null">{{ tag.label }}</span>
            </template>
            <template v-else-if="c.type === 'number'">{{ num(row.values[c.key]) }}</template>
            <template v-else-if="c.type === 'spark'">
              <svg v-if="spark(row.values[c.key])" class="qd-board-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
                <path :d="spark(row.values[c.key])!.line" vector-effect="non-scaling-stroke" />
              </svg>
            </template>
            <template v-else>{{ row.values[c.key] }}</template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
