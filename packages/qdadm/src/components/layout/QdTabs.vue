<script setup lang="ts">
/**
 * QdTabs (#5398): tabs on a page of the app's own, not an entity's. A thin
 * layer over PrimeVue's Tabs, the same parts FieldGroups uses, so the same
 * look and the same ARIA; what it adds is what every page would redo by hand:
 *
 * - the current tab in the address (`?tab=groups`): a link opens it, a reload
 *   keeps it; set with router.replace, so it adds no history entry;
 * - a badge per tab (QdBadge, as in the domain bar), hidden at zero;
 * - a tab the user may not see (`permission`) is not drawn;
 * - a panel is mounted the first time it is opened, then kept (`lazy`).
 *
 *   <QdTabs :tabs="[
 *     { key: 'profile', label: 'Profile', icon: 'pi pi-user' },
 *     { key: 'groups', label: 'Groups', badge: groups.length, permission: 'entity:groups:list' },
 *   ]">
 *     <template #profile>…</template>
 *     <template #groups>…</template>
 *   </QdTabs>
 *
 * A record's pages as tabs are `ctx.itemTabs`; an entity's fields in tabs,
 * `FieldGroups` with `layout="tabs"`.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import QdBadge from '../../domain/QdBadge.vue'
import { useSecurity } from '../../composables/useSecurity'
import type { QdTab } from './QdTabs.types'


const props = withDefaults(
  defineProps<{
    tabs: QdTab[]
    /** The current tab's key (v-model) */
    modelValue?: string | null
    /** The query parameter that holds it; `false`: not in the address */
    query?: string | false
    /** Mount a panel when first opened, then keep it */
    lazy?: boolean
  }>(),
  { modelValue: null, query: 'tab', lazy: true }
)
const emit = defineEmits<{ 'update:modelValue': [key: string] }>()

const route = useRoute() as ReturnType<typeof useRoute> | undefined
const router = useRouter() as ReturnType<typeof useRouter> | undefined
const { isGranted } = useSecurity()

const shown = computed(() => props.tabs.filter((t) => !t.permission || isGranted(t.permission)))
const known = (key: unknown): key is string => typeof key === 'string' && shown.value.some((t) => t.key === key && !t.disabled)
const firstKey = () => shown.value.find((t) => !t.disabled)?.key ?? shown.value[0]?.key ?? ''

/** The key the address asks for, if any */
const fromAddress = (): string | null => {
  if (!props.query || !route) return null
  const v = route.query[props.query]
  return typeof v === 'string' ? v : null
}

const local = ref<string>(known(props.modelValue) ? props.modelValue! : known(fromAddress()) ? fromAddress()! : firstKey())
const current = computed(() => (known(local.value) ? local.value : firstKey()))

// What was opened once stays mounted
const opened = ref(new Set<string>([current.value]))
watch(current, (k) => opened.value.add(k))

watch(
  () => props.modelValue,
  (k) => {
    if (known(k) && k !== local.value) local.value = k
  }
)
// Back, forward, or a link to another tab of the same page
watch(
  () => (props.query && route ? route.query[props.query] : undefined),
  () => {
    const k = fromAddress()
    if (known(k) && k !== local.value) local.value = k
  }
)

function select(value: string | number): void {
  const key = String(value)
  if (!known(key) || key === local.value) return
  local.value = key
  emit('update:modelValue', key)
  if (props.query && route && router) {
    const query = { ...route.query }
    // The first tab is the page itself: no parameter for it
    if (key === firstKey()) delete query[props.query]
    else query[props.query] = key
    void router.replace({ query, hash: route.hash })
  }
}

const badgeOf = (t: QdTab) => (t.badge === null || t.badge === undefined ? null : typeof t.badge === 'number' ? { count: t.badge, tone: null } : { count: t.badge.count, tone: t.badge.tone ?? null })
</script>

<template>
  <Tabs v-if="shown.length" :value="current" class="qd-tabs" @update:value="select">
    <TabList>
      <Tab v-for="t in shown" :key="t.key" :value="t.key" :disabled="t.disabled" :data-tab="t.key">
        <i v-if="t.icon" :class="t.icon" class="qd-tabs-icon" aria-hidden="true"></i>
        <span class="qd-tabs-label">{{ t.label }}</span>
        <QdBadge v-if="badgeOf(t)" :count="badgeOf(t)!.count" :title="t.label" :tone="badgeOf(t)!.tone" />
      </Tab>
    </TabList>
    <TabPanels>
      <TabPanel v-for="t in shown" :key="t.key" :value="t.key" :data-tab-panel="t.key">
        <slot v-if="!lazy || opened.has(t.key)" :name="t.key" :tab="t"></slot>
      </TabPanel>
    </TabPanels>
  </Tabs>
</template>

<style scoped>
.qd-tabs-icon {
  margin-right: 0.5rem;
}

.qd-tabs :deep(.qd-badge) {
  margin-left: 0.5rem;
}
</style>
