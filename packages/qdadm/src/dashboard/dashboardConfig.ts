/**
 * The app's card dashboards (#4338): where arrangements are kept, set once at
 * boot. A CardsDashboard's own `storage` / `load-grace` props win.
 *
 *   configureDashboards({
 *     storage: {
 *       load: (key) => api.get(`/me/dashboards/${key}`).then((r) => r.data, () => null),
 *       save: (key, arrangement) => api.put(`/me/dashboards/${key}`, arrangement),
 *     },
 *   })
 */
import type { CardsArrangementStorage } from '../composables/useCardsArrangement'

export interface DashboardsOptions {
  /** Where arrangements are kept (default: localStorage) */
  storage?: CardsArrangementStorage
  /** Ms an async load may take before the default order shows (default 150) */
  loadGrace?: number
}

const app: DashboardsOptions = {}

/** Later calls merge over earlier ones. */
export function configureDashboards(options: DashboardsOptions): void {
  Object.assign(app, options)
}

export function getDashboardsConfig(): Readonly<DashboardsOptions> {
  return app
}

/** For tests: back to qdadm's defaults. */
export function resetDashboards(): void {
  delete app.storage
  delete app.loadGrace
}
