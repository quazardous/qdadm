/**
 * qdadm Hello World - Minimal example
 *
 * This is the bare minimum to get a qdadm list page working.
 */
console.log('[hello-world] Starting...')

import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'

import { createQdadm, MockApiStorage, EntityManager } from 'qdadm'
import 'qdadm/styles'
import 'primeicons/primeicons.css'

import App from './App.vue'
import TaskList from './TaskList.vue'

// 1. Router (minimal)
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/tasks' },
    { path: '/tasks', name: 'tasks', component: TaskList }
  ]
})

// 2. qdadm config (minimal)
// Create EntityManager instance (not just config object)
const tasksManager = new EntityManager({
  name: 'tasks',
  label: 'Task',
  labelPlural: 'Tasks',
  labelField: 'title',
  storage: new MockApiStorage({
    entityName: 'tasks',
    initialData: [
      { id: '1', title: 'Learn qdadm', done: false },
      { id: '2', title: 'Build an admin', done: false },
      { id: '3', title: 'Deploy to production', done: true }
    ]
  }),
  fields: {
    title: { type: 'text', label: 'Title' },
    done: { type: 'boolean', label: 'Done' }
  }
})

const qdadm = createQdadm({
  router,
  toast: { add: () => {}, remove: () => {} },
  features: { auth: false },  // Disable auth for minimal example
  managers: { tasks: tasksManager }
})

// 3. App bootstrap
console.log('[hello-world] Creating app...')
try {
  const app = createApp(App)
  console.log('[hello-world] Using router...')
  app.use(router)
  console.log('[hello-world] Using PrimeVue...')
  app.use(PrimeVue, { theme: { preset: Aura } })
  console.log('[hello-world] Using ToastService...')
  app.use(ToastService)
  console.log('[hello-world] Using qdadm...')
  app.use(qdadm)
  console.log('[hello-world] Mounting...')
  app.mount('#app')
  console.log('[hello-world] Mounted!')
} catch (e) {
  console.error('[hello-world] ERROR:', e)
}
