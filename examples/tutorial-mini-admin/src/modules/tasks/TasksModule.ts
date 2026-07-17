import { Module, EntityManager, MockApiStorage } from '@quazardous/qdadm'

export class TasksModule extends Module {
  static name = 'tasks'

  async connect(ctx: any) {
    ctx.entity('tasks', new EntityManager({
      name: 'tasks',
      labelField: 'title',
      fields: {
        title: { type: 'text', label: 'Title', required: true, default: '' },
        done: { type: 'boolean', label: 'Done', default: false },
      },
      storage: new MockApiStorage({
        entityName: 'tasks',
        initialData: [
          { id: '1', title: 'Learn qdadm', done: false },
          { id: '2', title: 'Build an admin', done: true },
        ],
      }),
    }))

    ctx.crud('tasks', {
      list: () => import('./pages/TaskList.vue'),
    }, { nav: { section: 'Main', icon: 'pi pi-check-square' } })
  }
}
