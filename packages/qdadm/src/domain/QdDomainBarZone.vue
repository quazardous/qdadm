<script setup lang="ts">
/**
 * Where the layouts draw the domain bar (#5389): the `_app:domain-bar` zone,
 * on the pages of a domain only, with QdDomainBar as its default. An app
 * replaces it with a block in that zone; the block receives `domain`.
 */
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import Zone from '../components/layout/Zone.vue'
import QdDomainBar from './QdDomainBar.vue'
import { domainOfRoute, getDomain } from './registry'
import { useActiveStack } from '../chain/useActiveStack'
import type { ActiveStack } from '../chain/ActiveStack'

// The page's domain, as the kernel resolved it into the active stack (#5412);
// without a kernel, the default rule on the route
const route = useRoute()
const hasStack = !!inject<ActiveStack | null>('qdadmActiveStack', null)
const stack = hasStack ? useActiveStack() : null
const domain = computed(() => (stack ? (stack.domain.value ? getDomain(stack.domain.value.name) : null) : domainOfRoute(route)))
</script>

<template>
  <Zone v-if="domain" :key="domain.name" class="qd-domain-bar-zone" name="_app:domain-bar" :default-component="QdDomainBar" :block-props="{ domain }" />
</template>
