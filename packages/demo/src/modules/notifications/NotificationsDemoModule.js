/**
 * Notifications demo (#2677)
 *
 * A page to try the notification zone by hand: toasts of every severity and
 * keep level, an entry that leads somewhere, and a slow operation to see the
 * activity ring on the sidebar logo. The "changes made elsewhere" entry is
 * simulated from the JP user detail page.
 */
import { Module } from '@quazardous/qdadm'

export class NotificationsDemoModule extends Module {
  static moduleName = 'notifications-demo'
  static requires = []
  static priority = 0

  async connect(ctx) {
    ctx.routes('notifications-demo', [
      {
        path: '',
        name: 'notifications-demo',
        component: () => import('./pages/NotificationsPlayground.vue'),
        meta: { layout: 'page' },
      },
    ])
    ctx.navItem({ section: 'Features', route: 'notifications-demo', icon: 'pi pi-bell', label: 'Notifications' })
    // A link out of the app (#3675): opens in a new tab, never the active entry.
    ctx.navItem({ section: 'Features', href: 'https://github.com/quazardous/qdadm', icon: 'pi pi-github', label: 'qdadm on GitHub' })
    ctx.navItem({ section: 'Features', href: 'https://github.com/quazardous/tvty', icon: 'pi pi-github', label: 'tvty on GitHub' })
  }
}

export default NotificationsDemoModule
