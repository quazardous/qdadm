/**
 * Ops widgets demo (#4109)
 *
 * The widgets an ops cockpit needs on top of entity CRUD, each on a page you
 * can play with: a live task log (#4110), an entity's history across actors (#4111),
 * messages in their own format and their diff (#4112), captured emails (#4113),
 * long backend tasks followed to the end (#4114), a live YAML configuration (#4303),
 * a card dashboard each user arranges (#4320).
 */
import { defineAsyncComponent } from 'vue'
import { Module, registerTaskKind } from '@quazardous/qdadm'
import { getTask, cancelTask, readLog } from './fakeTasks'

export class OpsDemoModule extends Module {
  static moduleName = 'ops-demo'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // Registered here, not in the page: a run of these kinds resumes after a reload (#4114).
    const kind = {
      task: { get: getTask, intervalMs: 1000 },
      cancel: cancelTask,
      log: (id) => ({ poll: (from) => readLog(id, from), intervalMs: 500 }),
    }
    // A kind's own slot in the follow dialog (#4334)
    registerTaskKind('demo-create-box', { ...kind, slots: { 'after-log': defineAsyncComponent(() => import('./pages/BoxSummary.vue')) } })
    registerTaskKind('demo-destroy-box', { ...kind, cancel: undefined })

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
        path: 'tasks',
        name: 'ops-tasks',
        component: () => import('./pages/TaskPlayground.vue'),
        // The router refuses the page without it (#4332); its menu entry follows
        meta: { layout: 'page', permission: 'admin:ops:tasks' },
      },
      {
        path: 'yaml-config',
        name: 'ops-yaml-config',
        component: () => import('./pages/YamlConfigPlayground.vue'),
        meta: { layout: 'page' },
      },
      {
        path: 'dashboard',
        name: 'ops-dashboard',
        component: () => import('./pages/DashboardPlayground.vue'),
        meta: { layout: 'page' },
      },
      {
        path: 'timeline',
        name: 'ops-timeline',
        component: () => import('./pages/TimelinePlayground.vue'),
        meta: { layout: 'page' },
      },
    ])
    // The dashboard's cards (#4320): plain blocks, shown by a classic Zone or by
    // CardsDashboard alike. `card` only adds what arranging needs; the others
    // take their title from their `title` prop.
    ctx.zone('ops-dashboard')
    const DemoCard = defineAsyncComponent(() => import('./pages/DemoCard.vue'))
    const cards = [
      ['sales', { title: 'Sales', value: '€ 48 210', text: 'This month, +12 %', icon: 'pi pi-euro' }, { required: true, span: 2 }],
      ['orders', { title: 'Orders', value: '1 284', text: '37 waiting for shipping', icon: 'pi pi-shopping-cart' }, {}],
      ['stock', { title: 'Low stock', value: '9', text: 'SKUs under their minimum', icon: 'pi pi-box' }, {}],
      ['alerts', { title: 'Alerts', value: '2', text: 'A feed failed, a task is stuck', icon: 'pi pi-bell' }, { pinned: true }],
      ['news', { title: 'News', text: 'Release notes and announcements', icon: 'pi pi-megaphone' }, { fixed: true }],
      ['visitors', { title: 'Visitors', value: '6 932', text: 'Today, all stores', icon: 'pi pi-users' }, {}],
      ['tasks', { title: 'Tasks', value: '4', text: 'Running in the background', icon: 'pi pi-cog' }, {}],
    ]
    cards.forEach(([id, props, card], i) => {
      ctx.block('ops-dashboard', { id, component: DemoCard, props, weight: (i + 1) * 10, ...(Object.keys(card).length ? { card } : {}) })
    })
    ctx.navItem({ section: 'Features', route: 'ops-dashboard', icon: 'pi pi-th-large', label: 'Dashboard' })
    ctx.navItem({ section: 'Features', route: 'ops-log-stream', icon: 'pi pi-align-left', label: 'Log stream' })
    ctx.navItem({ section: 'Features', route: 'ops-timeline', icon: 'pi pi-history', label: 'Timeline' })
    ctx.navItem({ section: 'Features', route: 'ops-payloads', icon: 'pi pi-code', label: 'Payloads' })
    ctx.navItem({ section: 'Features', route: 'ops-emails', icon: 'pi pi-envelope', label: 'Emails' })
    // Gated by its route's permission, not an entity (#4318, #4332): hidden from
    // whoever may not open the page, and lit on its own page
    ctx.navItem({ section: 'Features', route: 'ops-tasks', icon: 'pi pi-cog', label: 'Tasks' })
    ctx.navItem({ section: 'Features', route: 'ops-yaml-config', icon: 'pi pi-file-edit', label: 'YAML config' })
  }
}

export default OpsDemoModule
