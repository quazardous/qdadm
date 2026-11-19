<script setup lang="ts">
/**
 * breakdown (#5352): how a whole splits, in one or more groups ("By kind",
 * "By origin"). Each line a label, a bar scaled within its group and the
 * value written; a line may open its filtered list.
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from '../../i18n/useI18n'
import { formatNumber } from '../../cards/builtin/shared'

interface Row {
  label: string
  value: number
  to?: RouteLocationRaw
}
const props = defineProps<{ data: { groups: Array<{ title?: string; rows: Row[] }>; note?: string } }>()
const { locale } = useI18n()

const groups = computed(() =>
  props.data.groups.map((g) => {
    const max = Math.max(0, ...g.rows.map((r) => r.value))
    return { ...g, rows: g.rows.map((r) => ({ ...r, share: max ? (r.value / max) * 100 : 0, text: formatNumber(r.value, locale.value) })) }
  })
)
</script>

<template>
  <div class="qd-board-breakdown">
    <section v-for="(g, gi) in groups" :key="gi" class="qd-board-breakdown-group">
      <h3 v-if="g.title" class="qd-board-subtitle">{{ g.title }}</h3>
      <ul>
        <li v-for="(r, ri) in g.rows" :key="ri">
          <component :is="r.to ? RouterLink : 'div'" :to="r.to" class="qd-board-breakdown-row">
            <span class="qd-board-breakdown-label">{{ r.label }}</span>
            <span class="qd-board-breakdown-track" aria-hidden="true"><span class="qd-board-breakdown-bar" :style="{ width: `${r.share}%` }"></span></span>
            <span class="qd-board-breakdown-value">{{ r.text }}</span>
          </component>
        </li>
      </ul>
    </section>
    <p v-if="data.note" class="qd-board-note">{{ data.note }}</p>
  </div>
</template>
