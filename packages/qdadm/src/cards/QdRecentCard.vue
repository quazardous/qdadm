<script setup lang="ts">
/**
 * QdRecentCard (#5349): the records the person opened lately, live.
 *
 *   ctx.block(DASHBOARD_ZONES.WIDGETS, { id: 'recent', component: QdRecentCard, card: { title: 'Recent' } })
 */
import { computed, inject, onMounted } from 'vue'
import QdCardView from './QdCardView.vue'
import { useI18n } from '../i18n/useI18n'
import { useRecent } from '../favorites/useFavorites'
import type { CardSize } from './types'
import type { RouteLocationRaw } from 'vue-router'
import { seeAllLink } from './seeAll'

const props = withDefaults(
  defineProps<{
    title?: string | null
    size?: CardSize
    maxItems?: number
    /** The full list (#5405): a "See all" link in the card's foot */
    moreTo?: RouteLocationRaw | null
    /** When it shows: past maxItems lines (default), or always */
    more?: 'overflow' | 'always'
  }>(),
  { title: null, size: 's', maxItems: 5, moreTo: null, more: 'overflow' }
)
const { tOr } = useI18n()
const recent = useRecent()
onMounted(() => void recent.reload())
const orchestrator = inject<{ get?: (name: string) => { label?: string } | undefined } | null>('qdadmOrchestrator', null)

const envelope = computed(() => ({
  title: props.title ?? tOr('core.favorites.recentTitle', 'Recent'),
  size: props.size,
  state: !recent.available
    ? ('empty' as const)
    : !recent.loaded.value
      ? ('loading' as const)
      : recent.error.value && !recent.list.value.length
        ? ('unreachable' as const)
        : recent.list.value.length
          ? ('ready' as const)
          : ('empty' as const),
  error: recent.error.value ?? undefined,
  links: seeAllLink(props.moreTo, props.more, recent.list.value.length, props.maxItems, tOr),
  emptyText: recent.available ? tOr('core.favorites.noneRecent', 'Nothing opened yet') : tOr('core.favorites.noRecentsEntity', 'No recents entity is declared'),
}))
const data = computed(() => ({
  items: recent.list.value.map((r) => {
    const note = orchestrator?.get?.(r.entity)?.label
    return { label: r.label, to: r.to, at: r.at, ...(note ? { note } : {}) }
  }),
}))
</script>

<template>
  <QdCardView type="recent" :envelope="envelope" :data="data" :options="{ maxItems }">
    <template v-if="$slots.cta" #cta="scope"><slot name="cta" v-bind="scope"></slot></template>
  </QdCardView>
</template>
