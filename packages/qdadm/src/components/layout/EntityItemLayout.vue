<script setup lang="ts">
/**
 * EntityItemLayout - a tabbed item (#4963)
 *
 * The frame of `ctx.itemTabs(entity)`: the item's header, one tab per page of
 * the item (its own page as "Details", its child pages and child lists, in
 * declaration order, those the user may open), and the page in a
 * `router-view`. A tab switch changes only the page: the header stays, and the
 * item comes from the active stack, which reads it again when it is
 * invalidated (#4960).
 *
 * Inside it, `<PageNav/>` stays silent: the tabs are the navigation.
 */
import { computed, inject, provide, type Component } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter, type RouteRecordNormalized, type RouteRecordRaw } from 'vue-router'
import { useStackHydrator } from '../../chain/useStackHydrator'
import { useI18n } from '../../i18n/useI18n'
import { canOpenRoute, type RouteAccessDeps } from '../../security/routeAccess'
import type { ItemTabsMeta } from '../../kernel/itemTabs'

interface ManagerView {
  label?: string
  labelPlural?: string
  getEntityLabel?: (item: unknown) => string | null
}

const route = useRoute()
const router = useRouter()
const { tOr } = useI18n()
const hydrator = useStackHydrator()
const orchestrator = inject<(RouteAccessDeps['orchestrator'] & { get: (name: string) => unknown }) | null>('qdadmOrchestrator', null)
const checker = inject<RouteAccessDeps['checker']>('qdadmSecurityChecker', null)

provide('qdadmItemTabs', true)

/** This frame's record: the innermost matched record carrying meta.itemTabs */
const frame = computed<RouteRecordNormalized | undefined>(() => [...route.matched].reverse().find((r) => r.meta?.itemTabs))
const config = computed(() => frame.value?.meta.itemTabs as ItemTabsMeta | undefined)
const manager = computed(() => (config.value ? (orchestrator?.get(config.value.entity) as ManagerView | null) : null))
const id = computed(() => (config.value ? (route.params[config.value.param] as string | undefined) ?? null : null))

// Read through the levels array each time: the stack replaces it on every
// hydration, while a level object keeps its identity as its data changes
const findLevel = () =>
  hydrator.levels.value.find((l) => l.entity === config.value?.entity && String(l.id) === String(id.value)) ?? null
const item = computed(() => findLevel()?.data ?? null)
const loading = computed(() => !findLevel()?.hydrated)
const title = computed(() => (item.value ? manager.value?.getEntityLabel?.(item.value) : null) ?? id.value ?? '')

interface Tab {
  name: string
  label: string
  href: string
  exact: boolean
}

function tabLabel(child: RouteRecordRaw): string {
  if (child.path === '') {
    const details = config.value?.details
    return typeof details === 'string' ? details : tOr('breadcrumb.details', 'Details')
  }
  const meta = (child.meta ?? {}) as { navLabel?: string; entity?: string }
  if (meta.navLabel) return meta.navLabel
  const childManager = meta.entity ? (orchestrator?.get(meta.entity) as ManagerView | null) : null
  return childManager?.labelPlural || String(child.name)
}

const tabs = computed<Tab[]>(() => {
  const children = (frame.value?.children ?? []) as RouteRecordRaw[]
  const out: Tab[] = []
  for (const child of children) {
    if (typeof child.name !== 'string' || child.redirect) continue
    // Forms and a child's own record are not tabs: they open from the tab's page
    if (/-(create|edit|new|show)$/.test(child.name) && child.path !== '') continue
    if (child.path.includes(':')) continue
    if (child.path === '' && config.value?.details === false) continue
    let resolved
    try {
      resolved = router.resolve({ name: child.name, params: route.params })
    } catch {
      continue
    }
    if (!canOpenRoute(resolved, { orchestrator, checker })) continue
    out.push({ name: child.name, label: tabLabel(child), href: resolved.path, exact: child.path === '' })
  }
  return out
})

const isActive = (tab: Tab): boolean =>
  tab.exact ? route.path === tab.href : route.path === tab.href || route.path.startsWith(`${tab.href}/`)

const header = computed(() => config.value?.header as Component | undefined)
</script>

<template>
  <div class="qd-item-tabs">
    <header class="qd-item-tabs-header">
      <component :is="header" v-if="header" :item="item" :manager="manager" :loading="loading" :id="id" />
      <template v-else>
        <span v-if="manager?.label" class="qd-item-tabs-entity">{{ manager.label }}</span>
        <h1 class="qd-item-tabs-title">{{ title }}</h1>
      </template>
    </header>
    <nav v-if="tabs.length > 1" class="qd-item-tabs-bar" :aria-label="title">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.name"
        :to="tab.href"
        class="qd-item-tabs-tab"
        :class="{ 'qd-item-tabs-tab--active': isActive(tab) }"
        :aria-current="isActive(tab) ? 'page' : undefined"
      >
        {{ tab.label }}
      </RouterLink>
    </nav>
    <div class="qd-item-tabs-page">
      <RouterView />
    </div>
  </div>
</template>
