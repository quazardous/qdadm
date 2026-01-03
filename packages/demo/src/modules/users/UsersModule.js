/**
 * Users Module - Module System v2
 *
 * User management with LocalStorage.
 * Entity (users) is defined in main.js with EntityManager.
 */
import { Module } from 'qdadm'

export class UsersModule extends Module {
  static name = 'users'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // ============ ROUTES ============
    ctx.routes('users', [
      {
        path: '',
        name: 'user',
        component: () => import('./pages/UserList.vue')
      },
      {
        path: 'create',
        name: 'user-create',
        component: () => import('./pages/UserForm.vue')
      },
      {
        path: ':id/edit',
        name: 'user-edit',
        component: () => import('./pages/UserForm.vue')
      }
    ], { entity: 'users' })

    // ============ NAVIGATION ============
    ctx.navItem({
      section: 'Administration',
      route: 'user',
      icon: 'pi pi-users',
      label: 'Users',
      entity: 'users'
    })

    // ============ ROUTE FAMILY ============
    ctx.routeFamily('user', ['user-'])
  }
}

export default UsersModule
