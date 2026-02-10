/**
 * qdadm-demo - Book Manager Demo
 *
 * Canonical bootstrap for qdadm applications.
 *
 * Module-centric pattern: each module owns its entity definition,
 * storage, routes, and navigation.
 */

import { Kernel } from 'qdadm'
import { debugBar } from 'qdadm/modules/debug'
import { createLocalStorageRolesProvider } from 'qdadm/security'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import 'qdadm/styles'
import 'primeicons/primeicons.css'

import App from './App.vue'
import { version } from '../package.json'
import { authAdapter } from './adapters/authAdapter'
import { moduleDefs, modulesOptions, sectionOrder, registerHooks } from './config'

// ============================================================================
// KERNEL BOOTSTRAP
// ============================================================================

const kernel = new Kernel({
  root: App,
  basePath: import.meta.env.BASE_URL,
  hashMode: import.meta.env.VITE_HASH_MODE === 'true',

  // Modules & Navigation
  // Module-centric: modules define their own entities via ctx.entity()
  moduleDefs,
  modulesOptions,
  sectionOrder,

  // Authentication
  authAdapter,
  entityAuthAdapter: () => authAdapter.getUser(), // Function → EntityAuthAdapter with getCurrentUser
  security: {
    rolesProvider: createLocalStorageRolesProvider({
      key: 'demo_roles',
      // Fixed: system permissions, cannot be edited
      fixed: {
        role_permissions: {
          ROLE_ANONYMOUS: ['auth:login']
        }
      },
      // Defaults: editable via Roles UI
      defaults: {
        role_hierarchy: {
          ROLE_ADMIN: ['ROLE_USER']
        },
        role_permissions: {
          ROLE_USER: ['entity:*:read', 'entity:*:list'],
          ROLE_ADMIN: ['entity:*:create', 'entity:*:update', 'entity:*:delete', 'admin:**', 'security:**', 'auth:impersonate']
        },
        role_labels: {
          ROLE_ANONYMOUS: 'Anonymous',
          ROLE_USER: 'User',
          ROLE_ADMIN: 'Administrator'
        }
      }
    })
  },

  // Event routing: auth events → datalayer invalidation (only authSensitive entities react)
  eventRouter: {
    'auth:**': [{ signal: 'entity:datalayer-invalidate', transform: () => ({ actuator: 'auth' }) }]
  },

  // Pages
  pages: {
    login: () => import('./pages/LoginPage.vue'),
    layout: () => import('./pages/MainLayout.vue')
  },
  homeRoute: {
    name: 'home',
    component: () => import('./pages/WelcomePage.vue')
  },

  // Branding
  app: { name: 'Book Manager', shortName: 'BM', version },

  // PrimeVue
  primevue: { plugin: PrimeVue, theme: Aura },

  // Debug bar
  debugBar,

  // Notification panel
  notifications: { enabled: true, maxNotifications: 100 },

  // Cache: 5 minutes TTL by default for all entities
  defaultEntityCacheTtlMs: 5 * 60 * 1000
})

// Create app and register hooks
const app = kernel.createApp()
registerHooks(kernel)

// Mount
app.mount('#app')
