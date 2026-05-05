<script setup lang="ts">
/**
 * qdadm DebugBar wrapper.
 *
 * Wraps the panel-pluggable `@quazardous/qddebug` `DebugBar` with qdadm's
 * admin-specific panels (auth, entities, router, zones, i18n) and the
 * matching tab metadata (icons / labels / colors). Existing call sites that
 * imported this file continue to work unchanged.
 */
import { DebugBar as QddebugBar } from '@quazardous/qddebug'
import { adminPanels, adminPanelsMeta } from './adminPanelsConfig'

defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bridge: any
  zIndex?: number
}>()

// Preserve the legacy localStorage key so existing users keep their saved layout.
const STORAGE_KEY = 'qdadm-debug-bar'
</script>

<template>
  <QddebugBar
    :bridge="bridge"
    :z-index="zIndex"
    :storage-key="STORAGE_KEY"
    :panels="adminPanels"
    :collector-meta="adminPanelsMeta"
  />
</template>
