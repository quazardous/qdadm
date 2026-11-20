<script setup lang="ts">
/**
 * QdBadge (#5389): a number on a pill, like a notification count. Its tone
 * comes from how things stand (critical, watch, or none); it hides at zero and
 * says what it counts to screen readers.
 */
import { computed } from 'vue'
import { useI18n } from '../i18n/useI18n'

const props = defineProps<{
  count: number | null | undefined
  /** What it counts, for screen readers */
  title?: string
  tone?: 'critical' | 'watch' | null
}>()

const { locale, tOr } = useI18n()
const shown = computed(() => typeof props.count === 'number' && props.count > 0)
const text = computed(() => {
  const n = props.count ?? 0
  return n > 99 ? '99+' : new Intl.NumberFormat(locale.value).format(n)
})
</script>

<template>
  <span
    v-if="shown"
    class="qd-badge"
    :class="tone ? `qd-badge--${tone}` : null"
    :data-tone="tone || 'neutral'"
    :title="title ? tOr('core.domainBar.badge', '{count} — {title}', { count: count!, title }) : undefined"
  >
    <span aria-hidden="true">{{ text }}</span>
    <span class="qd-card-sr">{{ title ? tOr('core.domainBar.badge', '{count} — {title}', { count: count!, title }) : count }}</span>
  </span>
</template>
