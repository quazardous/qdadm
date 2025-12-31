/**
 * Todos Module - JSONPlaceholder Integration
 *
 * Simple todo list from JSONPlaceholder API.
 * Features completion toggle checkbox.
 * No detail page needed (simple entity).
 */

export function init({ registry }) {

  // ============ ROUTES ============
  registry.addRoutes('todos', [
    {
      path: '',
      name: 'todo',
      component: () => import('./pages/TodosPage.vue'),
      meta: { layout: 'list' }
    }
  ], { entity: 'todos' })

  // ============ NAVIGATION ============
  registry.addNavItem({
    section: 'JSONPlaceholder',
    route: 'todo',
    icon: 'pi pi-check-square',
    label: 'Todos'
  })

  // ============ ROUTE FAMILY ============
  registry.addRouteFamily('todo', ['todo-'])
}
