// Step 6: first import, so the agent also sees what fails during boot
import { installQdadmRelayConnector } from '@quazardous/qdadm-mcp/connector'
installQdadmRelayConnector()

import { Kernel } from '@quazardous/qdadm'
import { AppLayout } from '@quazardous/qdadm/components'
import { createLocalStorageRolesProvider } from '@quazardous/qdadm/security'
import { authAdapter } from './auth/authAdapter'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import '@quazardous/qdadm/styles'
import 'primeicons/primeicons.css'

import App from './App.vue'
import { moduleDefs } from './config/modules'

const kernel = new Kernel({
  root: App,
  hashMode: true, // hash routing keeps the GitHub Pages deploy simple
  moduleDefs,
  pages: { layout: AppLayout, login: () => import('./pages/Login.vue') },
  authAdapter,
  entityAuthAdapter: () => authAdapter.getUser(),
  security: {
    rolesProvider: createLocalStorageRolesProvider({
      key: 'my_admin_roles',
      defaults: {
        role_hierarchy: { ROLE_ADMIN: ['ROLE_USER'] },
        role_permissions: {
          ROLE_USER: ['entity:*:read', 'entity:*:list'],
          ROLE_ADMIN: ['entity:*:create', 'entity:*:update', 'entity:*:delete'],
        },
      },
    }),
  },
  homeRoute: { name: 'home', component: () => import('./pages/HomePage.vue') },
  primevue: { plugin: PrimeVue, theme: Aura },
  app: { name: 'My Admin' },
  sectionOrder: ['Library', 'Main'],
  features: { breadcrumbModeToggle: true },
  debug: import.meta.env.DEV, // step 6: window.__qdadm, which the agent's tools read
})

kernel.createApp().mount('#app')
