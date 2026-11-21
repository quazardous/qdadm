<script setup>
/**
 * DotsChart - an app's own chart (#5441), registered as 'dots' in main.js
 *
 * Any `chart: 'dots'` (a viz block, a metric card or its domain bar pill)
 * draws with it. It gets the series read ({ label, points: [{ t, v }] }),
 * their colours as CSS values, its height, and the bar's mode. Here: one
 * dot per point, a row per series, its size by its value.
 */
import { computed } from 'vue'

const props = defineProps({
  series: { type: Array, required: true },
  colors: { type: Array, default: () => [] },
  height: { type: Number, default: 28 },
  compact: { type: Boolean, default: true },
})

const rows = computed(() => {
  const max = Math.max(1, ...props.series.flatMap((s) => s.points.map((p) => p.v)))
  const n = Math.max(1, ...props.series.map((s) => s.points.length))
  const rowH = props.height / Math.max(1, props.series.length)
  return props.series.map((s, k) => ({
    color: props.colors[k],
    dots: s.points.map((p, i) => ({ x: ((i + 0.5) / n) * 100, y: rowH * (k + 0.5), r: 0.6 + (p.v / max) * (rowH / 2 - 0.6) })),
  }))
})
</script>

<template>
  <svg class="demo-dots" :viewBox="`0 0 100 ${height}`" preserveAspectRatio="none" aria-hidden="true" :style="{ width: '100%', height: compact ? '100%' : `${height * 2}px`, display: 'block' }">
    <g v-for="(r, k) in rows" :key="k" :style="{ fill: r.color }">
      <ellipse v-for="(d, i) in r.dots" :key="i" :cx="d.x" :cy="d.y" :rx="d.r * 0.5" :ry="d.r" />
    </g>
  </svg>
</template>
