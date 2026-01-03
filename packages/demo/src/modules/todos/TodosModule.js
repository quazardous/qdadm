/**
 * Todos Module - Module System v2 Implementation
 *
 * Simple todo list from JSONPlaceholder API.
 */

import { Module } from 'qdadm'

export class TodosModule extends Module {
  static name = 'todos'
  static requires = []
  static priority = 0

  async connect(ctx) {
    ctx.routes('todos', [
      {
        path: '',
        name: 'todo',
        component: () => import('./pages/TodosPage.vue'),
        meta: { layout: 'list' }
      }
    ], { entity: 'todos' })

    ctx.navItem({
      section: 'JSONPlaceholder',
      route: 'todo',
      icon: 'pi pi-check-square',
      label: 'Todos'
    })

    ctx.routeFamily('todo', ['todo-'])
  }
}

export default TodosModule
