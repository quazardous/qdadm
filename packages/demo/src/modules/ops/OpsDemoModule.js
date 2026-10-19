/**
 * Ops widgets demo (#4109)
 *
 * The widgets an ops cockpit needs on top of entity CRUD, each on a page you
 * can play with: a live task log (#4110), an entity's history across actors (#4111),
 * messages in their own format and their diff (#4112), captured emails (#4113).
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
      {
        path: 'payloads',
        name: 'ops-payloads',
        component: () => import('./pages/PayloadPlayground.vue'),
        meta: { layout: 'page' },
      },
      {
        path: 'emails',
        name: 'ops-emails',
        component: () => import('./pages/EmailPlayground.vue'),
        meta: { layout: 'page' },
      },
      {
        path: 'timeline',
        name: 'ops-timeline',
        component: () => import('./pages/TimelinePlayground.vue'),
        meta: { layout: 'page' },
      },
    ])
    ctx.navItem({ section: 'Features', route: 'ops-log-stream', icon: 'pi pi-align-left', label: 'Log stream' })
    ctx.navItem({ section: 'Features', route: 'ops-timeline', icon: 'pi pi-history', label: 'Timeline' })
    ctx.navItem({ section: 'Features', route: 'ops-payloads', icon: 'pi pi-code', label: 'Payloads' })
    ctx.navItem({ section: 'Features', route: 'ops-emails', icon: 'pi pi-envelope', label: 'Emails' })
  }
}

export default OpsDemoModule
