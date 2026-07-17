/**
 * qdadm Hello World — minimal Kernel bootstrap (#1388)
 *
 * One module, one entity, one list page. The Kernel builds the router,
 * installs PrimeVue (+ Toast/Confirmation services) and mounts the app —
 * same canonical path as the demo and the tutorial.
 */
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'

import { Kernel, Module, EntityManager, MockApiStorage } from '@quazardous/qdadm'
import { AppLayout } from '@quazardous/qdadm/components'
import '@quazardous/qdadm/styles'
import 'primeicons/primeicons.css'

import App from './App.vue'

class TasksModule extends Module {
  static name = 'tasks'

  async connect(ctx) {
    ctx.entity('tasks', new EntityManager({
      name: 'tasks',
      label: 'Task',
      labelPlural: 'Tasks',
      labelField: 'title',
      fields: {
        title: { type: 'text', label: 'Title' },
        done: { type: 'boolean', label: 'Done' },
      },
      storage: new MockApiStorage({
        entityName: 'tasks',
        initialData: [
          { id: '1', title: 'Learn qdadm', done: false },
          { id: '2', title: 'Build an admin', done: false },
          { id: '3', title: 'Deploy to production', done: true },
        ],
      }),
    }))

    ctx.crud('tasks', {
      list: () => import('./TaskList.vue'),
    }, { nav: { section: 'Main', icon: 'pi pi-check-square' } })
  }
}

const kernel = new Kernel({
  root: App,
  hashMode: true, // hash routing keeps the GitHub Pages deploy simple
  moduleDefs: [TasksModule],
  pages: { layout: AppLayout }, // required — the full admin shell for free
  // "/" redirects to the tasks list. Note: crud route NAMES are singular
  // ('task', 'task-edit'…) even though the path stays plural (/tasks).
  homeRoute: 'task',
  primevue: { plugin: PrimeVue, theme: Aura },
  app: { name: 'Hello qdadm' },
})

kernel.createApp().mount('#app')
