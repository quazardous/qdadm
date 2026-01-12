/**
 * qdadm - Vue 3 Admin Dashboard Framework
 *
 * A framework for building admin dashboards with Vue 3, PrimeVue, and Vue Router.
 */

// Version (from package.json)
import pkg from '../package.json'
export const version = pkg.version

// Kernel (simplified bootstrap)
export * from './kernel/index'

// Plugin (manual bootstrap)
export { createQdadm } from './plugin.js'

// Entity system
export * from './entity/index.js'

// Session auth (user authentication)
export * from './auth/index.js'

// Security (permissions, roles)
export * from './security/index.js'

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

// Chain (active navigation stack)
export * from './chain/index.js'

// Hooks
export * from './hooks/index'

// Deferred (async service loading)
export * from './deferred/index.js'

// Core (extension helpers)
export * from './core/index.js'

// Query (MongoDB-like filtering)
export * from './query/index'

// Utils
export * from './utils/index'

// Toast (signal-based notifications)
export * from './toast/index.js'

// Debug tools are NOT exported here to enable tree-shaking.
// Import from 'qdadm/debug' separately when needed:
//   import { debugBar, DebugModule } from 'qdadm/debug'

// Assets
export { default as qdadmLogo } from './assets/logo.svg'
