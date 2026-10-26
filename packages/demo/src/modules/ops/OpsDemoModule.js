/**
 * Ops widgets demo (#4109)
 *
 * The widgets an ops cockpit needs on top of entity CRUD, each on a page you
 * can play with: a live task log (#4110), an entity's history across actors (#4111),
 * messages in their own format and their diff (#4112), captured emails (#4113),
 * long backend tasks followed to the end (#4114), a live YAML configuration (#4303).
 */
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
    registerTaskKind('demo-create-box', kind)
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
        meta: { layout: 'page' },
      },
      {
        path: 'yaml-config',
        name: 'ops-yaml-config',
        component: () => import('./pages/YamlConfigPlayground.vue'),
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
    // Gated by a permission, not an entity (#4318): lights on its own page
    ctx.navItem({ section: 'Features', route: 'ops-tasks', icon: 'pi pi-cog', label: 'Tasks', permission: 'admin:ops:tasks' })
    ctx.navItem({ section: 'Features', route: 'ops-yaml-config', icon: 'pi pi-file-edit', label: 'YAML config' })
  }
}

export default OpsDemoModule
