/**
 * qdadm-demo - Book Manager Demo
 *
 * Canonical bootstrap for qdadm applications.
 *
 * Module-centric pattern: each module owns its entity definition,
 * storage, routes, and navigation.
 */

import { Kernel } from 'qdadm'
import { debugBar } from 'qdadm/debug'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import 'qdadm/styles'
import 'primeicons/primeicons.css'

import App from './App.vue'
import { version } from '../package.json'
import { authAdapter } from './adapters/authAdapter'
import { demoEntityAuthAdapter } from './adapters/entityAuthAdapter'
import { moduleDefs, modulesOptions, sectionOrder, registerHooks } from './config'

// ============================================================================
// KERNEL BOOTSTRAP
// ============================================================================

const kernel = new Kernel({
  root: App,
  basePath: import.meta.env.BASE_URL,

  // Modules & Navigation
  // Module-centric: modules define their own entities via ctx.entity()
  moduleDefs,
  modulesOptions,
  sectionOrder,

  // Authentication
  authAdapter,
  entityAuthAdapter: demoEntityAuthAdapter,
  security: {
    role_hierarchy: {
      ROLE_ADMIN: ['ROLE_USER']
    },
    role_permissions: {
      ROLE_USER: ['entity:read', 'entity:list'],
      ROLE_ADMIN: ['entity:create', 'entity:update', 'entity:delete', 'user:manage', 'role:assign', 'user:impersonate']
    }
  },

  // Event routing for cache invalidation
  eventRouter: {
    'auth:impersonate': ['cache:entity:invalidate:loans'],
    'auth:impersonate:stop': ['cache:entity:invalidate:loans']
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
  app: { name: 'Book Manager', shortName: 'Books', version },

  // PrimeVue
  primevue: { plugin: PrimeVue, theme: Aura },

  // Debug bar
  debugBar
})

// Create app and register hooks
const app = kernel.createApp()
registerHooks(kernel)

// Mount
app.mount('#app')
