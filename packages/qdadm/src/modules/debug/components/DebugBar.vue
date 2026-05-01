<script setup lang="ts">
/**
 * qdadm DebugBar wrapper.
 *
 * Wraps the panel-pluggable `@quazardous/qddebug` `DebugBar` with qdadm's
 * admin-specific panels (auth, entities, router, zones, i18n) and the
 * matching tab metadata (icons / labels / colors). Existing call sites that
 * imported this file continue to work unchanged.
 */
import { DebugBar as QddebugBar, type CollectorMeta } from '@quazardous/qddebug'
import {
  ZonesPanel,
  AuthPanel,
  EntitiesPanel,
  RouterPanel,
  I18nPanel,
} from './panels'

defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bridge: any
  zIndex?: number
}>()

const adminPanels = {
  zones: ZonesPanel,
  ZonesCollector: ZonesPanel,
  auth: AuthPanel,
  AuthCollector: AuthPanel,
  entities: EntitiesPanel,
  EntitiesCollector: EntitiesPanel,
  router: RouterPanel,
  RouterCollector: RouterPanel,
  i18n: I18nPanel,
  I18nCollector: I18nPanel,
}

// Admin tab metadata — qddebug ships defaults for generic collectors only
// (errors/signals/toasts/i18n); qdadm provides the rest.
const adminMeta: Record<string, CollectorMeta> = {
  zones: { icon: 'pi-th-large', label: 'Zones', color: '#06b6d4' },
  ZonesCollector: { icon: 'pi-th-large', label: 'Zones', color: '#06b6d4' },
  auth: { icon: 'pi-user', label: 'Auth', color: '#10b981' },
  AuthCollector: { icon: 'pi-user', label: 'Auth', color: '#10b981' },
  entities: { icon: 'pi-database', label: 'Entities', color: '#3b82f6' },
  EntitiesCollector: { icon: 'pi-database', label: 'Entities', color: '#3b82f6' },
  router: { icon: 'pi-directions', label: 'Router', color: '#ec4899' },
  RouterCollector: { icon: 'pi-directions', label: 'Router', color: '#ec4899' },
}

// Preserve the legacy localStorage key so existing users keep their saved layout.
const STORAGE_KEY = 'qdadm-debug-bar'
</script>

<template>
  <QddebugBar
    :bridge="bridge"
    :z-index="zIndex"
    :storage-key="STORAGE_KEY"
    :panels="adminPanels"
    :collector-meta="adminMeta"
  />
</template>
