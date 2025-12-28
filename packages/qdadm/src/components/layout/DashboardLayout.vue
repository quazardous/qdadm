<script setup>
/**
 * DashboardLayout - Second level of layout inheritance for dashboard pages
 *
 * Extends BaseLayout by providing content to its `main` zone and defining
 * dashboard-specific zones:
 * - stats: Top area for KPI cards (CardsGrid component)
 * - widgets: Main dashboard widgets area
 * - recent-activity: Recent changes and activity log
 *
 * Each zone renders blocks from ZoneRegistry. Empty zones render nothing
 * (no default widgets). Applications provide dashboard content by
 * registering blocks to these zones.
 *
 * Inheritance pattern:
 *   BaseLayout renders Zone components for each area
 *   -> DashboardLayout fills main zone with dashboard structure
 *   -> Dashboard pages extend with entity-specific customizations
 *
 * Usage:
 * <DashboardLayout>
 *   <!-- Optional: Override specific zones via slots -->
 * </DashboardLayout>
 *
 * Or register blocks via ZoneRegistry:
 *   registry.registerBlock(DASHBOARD_ZONES.STATS, {
 *     component: StatsWidget,
 *     id: 'kpi-cards',
 *     weight: 10
 *   })
 */
import { useSlots } from 'vue'
import BaseLayout from './BaseLayout.vue'
import Zone from './Zone.vue'
import { DASHBOARD_ZONES } from '../../zones/zones.js'

const slots = useSlots()
</script>

<template>
  <BaseLayout>
    <template #main>
      <div class="dashboard-layout">
        <!-- Stats zone: KPI cards, metrics -->
        <section v-if="slots.stats" class="dashboard-stats">
          <slot name="stats" />
        </section>
        <section v-else class="dashboard-stats">
          <Zone :name="DASHBOARD_ZONES.STATS" />
        </section>

        <!-- Widgets zone: main dashboard widgets -->
        <section v-if="slots.widgets" class="dashboard-widgets">
          <slot name="widgets" />
        </section>
        <section v-else class="dashboard-widgets">
          <Zone :name="DASHBOARD_ZONES.WIDGETS" />
        </section>

        <!-- Recent activity zone: activity log, recent changes -->
        <section v-if="slots['recent-activity']" class="dashboard-recent-activity">
          <slot name="recent-activity" />
        </section>
        <section v-else class="dashboard-recent-activity">
          <Zone :name="DASHBOARD_ZONES.RECENT_ACTIVITY" />
        </section>
      </div>
    </template>
  </BaseLayout>
</template>

<style scoped>
.dashboard-layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.dashboard-stats {
  /* Stats area typically uses CardsGrid */
}

.dashboard-widgets {
  /* Main widgets area */
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dashboard-recent-activity {
  /* Recent activity area */
}

/* Empty zones should collapse - Zone renders nothing when no blocks */
.dashboard-stats:empty,
.dashboard-widgets:empty,
.dashboard-recent-activity:empty {
  display: none;
}
</style>
