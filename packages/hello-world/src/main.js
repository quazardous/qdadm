/**
 * Hello World - Minimal qdadm Example with Module System v2
 *
 * Demonstrates:
 * 1. Kernel bootstrap with moduleDefs (new-style modules)
 * 2. HelloModule extending Module base class
 * 3. Minimal configuration without auth
 */

import { Kernel } from 'qdadm'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import 'qdadm/styles'
import 'primeicons/primeicons.css'

import App from './App.vue'
import { HelloModule } from './HelloModule.js'

// Minimal auth adapter (no authentication)
const noAuthAdapter = {
  isAuthenticated: () => true,
  getUser: () => ({ id: '1', username: 'guest', role: 'ROLE_USER' }),
  getToken: () => null,
  login: async () => ({ id: '1', username: 'guest', role: 'ROLE_USER' }),
  logout: () => {}
}

// Kernel configuration
const kernel = new Kernel({
  root: App,
  hashMode: true,

  // Module System v2: pass module classes via moduleDefs
  moduleDefs: [
    HelloModule
  ],

  // Navigation section order
  sectionOrder: ['Main'],

  // No entities needed for hello-world
  managers: {},

  // Minimal auth (always authenticated)
  authAdapter: noAuthAdapter,

  // Simple pages (no login needed)
  pages: {
    login: { template: '<div>Login</div>' },
    layout: () => import('qdadm/components').then(m => m.AppLayout)
  },

  // Home redirects to hello page
  homeRoute: 'hello',

  // App branding
  app: {
    name: 'Hello World',
    shortName: 'Hello',
    version: '1.0.0'
  },

  // PrimeVue configuration
  primevue: {
    plugin: PrimeVue,
    theme: Aura
  }
})

// Create and mount the app
kernel.createApp().mount('#app')
