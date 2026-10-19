/**
 * Ops widgets demo (#4109)
 *
 * The widgets an ops cockpit needs on top of entity CRUD, each on a page you
 * can play with: a live task log first (#4110).
 */
import { Module } from '@quazardous/qdadm'

export class OpsDemoModule extends Module {
  static moduleName = 'ops-demo'
  static requires = []
  static priority = 0

  async connect(ctx) {
    ctx.routes('ops-demo', [
      {
        path: 'log-stream',
        name: 'ops-log-stream',
        component: () => import('./pages/LogStreamPlayground.vue'),
        meta: { layout: 'page' },
      },
    ])
    ctx.navItem({ section: 'Features', route: 'ops-log-stream', icon: 'pi pi-align-left', label: 'Log stream' })
  }
}

export default OpsDemoModule
