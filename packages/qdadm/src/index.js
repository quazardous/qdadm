/**
 * qdadm - Vue 3 Admin Dashboard Framework
 *
 * A framework for building admin dashboards with Vue 3, PrimeVue, and Vue Router.
 */

// Version (from package.json)
import pkg from '../package.json'
export const version = pkg.version

// Kernel (simplified bootstrap)
export * from './kernel/index.js'

// Plugin (manual bootstrap)
export { createQdadm } from './plugin.js'

// Entity system
export * from './entity/index.js'

// Orchestrator
export * from './orchestrator/index.js'

// Composables
export * from './composables/index.js'

// Components
export * from './components/index.js'

// Module system
export * from './module/index.js'

// Zones
export * from './zones/index.js'

// Hooks
export * from './hooks/index.js'

// Core (extension helpers)
export * from './core/index.js'

// Utils
export * from './utils/index.js'

// Assets
export { default as qdadmLogo } from './assets/logo.svg'
