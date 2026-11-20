<script setup lang="ts">
/**
 * Where the layouts draw the domain bar (#5389): the `_app:domain-bar` zone,
 * on the pages of a domain only, with QdDomainBar as its default. An app
 * replaces it with a block in that zone; the block receives `domain`.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Zone from '../components/layout/Zone.vue'
import QdDomainBar from './QdDomainBar.vue'
import { domainOfRoute } from './registry'

const route = useRoute()
const domain = computed(() => domainOfRoute(route))
</script>

<template>
  <Zone v-if="domain" :key="domain.name" class="qd-domain-bar-zone" name="_app:domain-bar" :default-component="QdDomainBar" :block-props="{ domain }" />
</template>
