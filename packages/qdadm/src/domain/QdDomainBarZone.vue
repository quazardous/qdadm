<script setup lang="ts">
/**
 * Where the layouts draw the domain bar (#5389): the `_app:domain-bar` zone,
 * on the pages of a domain only, with QdDomainBar as its default. An app
 * replaces it with a block in that zone; the block receives `domain` and
 * `layout`.
 *
 * The bar's layout (#5526): `features.domainBar.layout(domain)` gives it (a
 * layout, a promise of one, or null for the declared indicators). Read again
 * when the domain changes and after `reloadDomainBar()`; a new layout is a
 * new bar.
 */
import { computed, inject, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Zone from '../components/layout/Zone.vue'
import QdDomainBar from './QdDomainBar.vue'
import { domainOfRoute, getDomain, type DomainDefinition } from './registry'
import { domainBarGlobalVersion, domainBarVersion } from './layout'
import { useActiveStack } from '../chain/useActiveStack'
import type { ActiveStack } from '../chain/ActiveStack'

// The page's domain, as the kernel resolved it into the active stack (#5412);
// without a kernel, the default rule on the route
const route = useRoute()
const hasStack = !!inject<ActiveStack | null>('qdadmActiveStack', null)
const stack = hasStack ? useActiveStack() : null
const domain = computed(() => (stack ? (stack.domain.value ? getDomain(stack.domain.value.name) : null) : domainOfRoute(route)))

// The app's layout for that domain, and which read it is
const features = inject<{ domainBar?: { layout?: (domain: DomainDefinition) => unknown } } | null>('qdadmFeatures', null)
const layout = ref<unknown>(null)
const read = ref(0)
let asked = 0
watch(
  () => [domain.value?.name, domain.value ? domainBarVersion(domain.value.name) : 0, domainBarGlobalVersion()] as const,
  () => {
    const d = domain.value
    const source = features?.domainBar?.layout
    const ticket = ++asked
    if (!d || typeof source !== 'function') {
      layout.value = null
      return
    }
    let given: unknown
    try {
      given = source(d)
    } catch (err) {
      console.warn(`[qdadm] features.domainBar.layout('${d.name}') failed:`, err)
      layout.value = null
      read.value++
      return
    }
    if (given && typeof (given as PromiseLike<unknown>).then === 'function') {
      ;(given as Promise<unknown>).then(
        (value) => {
          if (ticket !== asked) return
          layout.value = value ?? null
          read.value++
        },
        (err) => {
          if (ticket !== asked) return
          console.warn(`[qdadm] features.domainBar.layout('${d.name}') failed:`, err)
          layout.value = null
          read.value++
        }
      )
      return
    }
    layout.value = given ?? null
    read.value++
  },
  { immediate: true }
)
</script>

<template>
  <Zone
    v-if="domain"
    :key="`${domain.name}:${read}`"
    class="qd-domain-bar-zone"
    name="_app:domain-bar"
    :default-component="QdDomainBar"
    :block-props="{ domain, layout }"
  />
</template>
