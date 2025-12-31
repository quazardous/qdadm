/**
 * qdadm Hello World - Minimal example
 *
 * This is the bare minimum to get a qdadm list page working.
 */
import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'

import { createQdadm, MockApiStorage } from 'qdadm'
import 'qdadm/style'

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
const qdadm = createQdadm({
  router,
  managers: {
    tasks: {
      storage: new MockApiStorage({
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
    }
  }
})

// 3. App bootstrap
const app = createApp(App)
app.use(router)
app.use(PrimeVue, { theme: { preset: Aura } })
app.use(ToastService)
app.use(qdadm)
app.mount('#app')
