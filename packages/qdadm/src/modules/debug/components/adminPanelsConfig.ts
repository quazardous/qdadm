/**
 * Admin panel registry — extracted from `DebugBar.vue` so host shells
 * that own a shared bridge (qdcms demo) can merge these panels with
 * their own and feed them to a single `<DebugBar />` instead of two.
 *
 * The keys MUST match what `bridge.collectors` keys into — both the
 * lowercase short names (`zones`, `auth`, …) and the legacy
 * collectorName strings (`ZonesCollector`, …) are aliased here so
 * the bar resolves them under either form.
 */

import type { Component } from 'vue'
import type { CollectorMeta } from '@quazardous/qddebug'
import ZonesPanel from './panels/ZonesPanel.vue'
import AuthPanel from './panels/AuthPanel.vue'
import EntitiesPanel from './panels/EntitiesPanel.vue'
import RouterPanel from './panels/RouterPanel.vue'
import I18nPanel from './panels/I18nPanel.vue'

export const adminPanels: Record<string, Component> = {
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

export const adminPanelsMeta: Record<string, CollectorMeta> = {
  zones: { icon: 'pi-th-large', label: 'Zones', color: '#06b6d4' },
  ZonesCollector: { icon: 'pi-th-large', label: 'Zones', color: '#06b6d4' },
  auth: { icon: 'pi-user', label: 'Auth', color: '#10b981' },
  AuthCollector: { icon: 'pi-user', label: 'Auth', color: '#10b981' },
  entities: { icon: 'pi-database', label: 'Entities', color: '#3b82f6' },
  EntitiesCollector: { icon: 'pi-database', label: 'Entities', color: '#3b82f6' },
  router: { icon: 'pi-directions', label: 'Router', color: '#ec4899' },
  RouterCollector: { icon: 'pi-directions', label: 'Router', color: '#ec4899' },
}
