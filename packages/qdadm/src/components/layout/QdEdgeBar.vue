<script setup lang="ts">
/**
 * QdEdgeBar (#5506): the layout's edge bar. It calls the app's
 * `features.edgeBar.panels(context)` with the page's context (the context
 * stack, the route, the user) whenever it changes, and draws QdEdgePanel
 * with what it gives: nothing given, no bar.
 */
import { computed, inject, watch } from 'vue'
import { useRoute } from 'vue-router'
import QdEdgePanel from './QdEdgePanel.vue'
import { useActiveStack } from '../../chain/useActiveStack'
import { useAuth } from '../../composables/useAuth'
import { setEdgePanels, useEdgeBar, type EdgeBarConfig, type EdgeContext, type EdgePanelDef } from '../../edge/edgeBar'

const features = inject<{ edgeBar?: EdgeBarConfig } | null>('qdadmFeatures', null)
const config = features?.edgeBar ?? null
const route = useRoute()
const stack = inject('qdadmActiveStack', null) ? useActiveStack() : null
const { user } = useAuth()
const edge = useEdgeBar()

const context = computed<EdgeContext>(() => {
  const levels = [...(stack?.levels.value ?? [])]
  return {
    domain: stack?.domain.value ?? null,
    levels,
    current: levels[levels.length - 1] ?? null,
    entity: (name: string) => [...levels].reverse().find((l) => l.entity === name) ?? null,
    route: {
      name: typeof route?.name === 'string' ? route.name : null,
      path: route?.path ?? '',
      params: { ...(route?.params ?? {}) },
      query: { ...(route?.query ?? {}) },
    },
    user: user.value,
  }
})

const given = computed<EdgePanelDef[]>(() => {
  if (typeof config?.panels !== 'function') return []
  try {
    const list = config.panels(context.value) ?? []
    // One panel per key: the first one given
    const seen = new Set<string>()
    return list.filter((p) => p && typeof p.key === 'string' && !seen.has(p.key) && (seen.add(p.key), true))
  } catch (e) {
    console.warn('[qdadm] features.edgeBar.panels failed:', e)
    return []
  }
})
watch(given, (list) => setEdgePanels(list), { immediate: true })

const open = computed({ get: () => edge.isOpen.value, set: (v: boolean) => (v ? edge.open(edge.tab.value ?? undefined) : edge.close()) })
const tab = computed({ get: () => edge.tab.value, set: (k: string | null) => k && edge.open(k) })
</script>

<template>
  <QdEdgePanel
    v-if="edge.present.value"
    v-model:open="open"
    v-model:tab="tab"
    :panels="edge.panels.value"
    :side="config?.side ?? 'right'"
    :width="config?.width ?? '26rem'"
    :narrow-at="config?.narrowAt ?? 900"
  />
</template>
