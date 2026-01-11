/**
 * DebugModule - Module System v2 class for debug tools integration
 *
 * Integrates the debug infrastructure (DebugBridge, collectors, DebugBar)
 * into a qdadm application via the Module System.
 *
 * Features:
 * - Creates and configures DebugBridge with default collectors
 * - Registers ErrorCollector and SignalCollector automatically
 * - Adds DebugBar component to 'app:debug' zone
 * - Provides debug bridge via Vue's provide/inject
 *
 * @example
 * import { createKernel, DebugModule } from 'qdadm'
 *
 * const kernel = createKernel({ debug: true })
 * kernel.use(new DebugModule({ enabled: true }))
 * await kernel.boot()
 */

import { h, inject, defineComponent } from 'vue'
import { Module } from '../../kernel/Module.js'
import { createDebugBridge } from './DebugBridge.js'
import { ErrorCollector } from './ErrorCollector.js'
import { SignalCollector } from './SignalCollector.js'
import { ToastCollector } from './ToastCollector.js'
import { ZonesCollector } from './ZonesCollector.js'
import { AuthCollector } from './AuthCollector.js'
import { EntitiesCollector } from './EntitiesCollector.js'
import { RouterCollector } from './RouterCollector.js'
import DebugBar from './components/DebugBar.vue'

/**
 * Symbol for debug bridge injection key
 */
export const DEBUG_BRIDGE_KEY = Symbol('debugBridge')

/**
 * Debug zone name for the DebugBar component
 * Prefixed with _ to hide from ZonesCollector (internal zone)
 */
export const DEBUG_ZONE = '_app:debug'

/**
 * Global DebugBar wrapper component
 * Auto-injects the debug bridge - use in App.vue for app-wide debug bar
 *
 * @example
 * <!-- In App.vue template -->
 * <router-view />
 * <QdadmDebugBar />
 */
export const QdadmDebugBar = defineComponent({
  name: 'QdadmDebugBar',
  setup() {
    const bridge = inject(DEBUG_BRIDGE_KEY, null)
    return () => bridge ? h(DebugBar, { bridge }) : null
  }
})

/**
 * DebugModule - Integrates debug tools into the application
 */
export class DebugModule extends Module {
  /**
   * Module identifier
   * @type {string}
   */
  static name = 'debug'

  /**
   * No dependencies - debug module should work standalone
   * @type {string[]}
   */
  static requires = []

  /**
   * Very low priority - runs last after all modules are connected
   * This ensures all signals and routes are registered before debug tools start
   * @type {number}
   */
  static priority = 1000

  /**
   * Module styles - loaded automatically before connect()
   * @type {() => Promise<any>}
   */
  static styles = () => import('./styles.scss')

  /**
   * Create a new DebugModule
   *
   * @param {object} [options={}] - Module options
   * @param {boolean} [options.enabled=false] - Initial enabled state for collectors
   * @param {number} [options.maxEntries=100] - Max entries per collector
   * @param {boolean} [options.errorCollector=true] - Include ErrorCollector
   * @param {boolean} [options.signalCollector=true] - Include SignalCollector
   * @param {boolean} [options.toastCollector=true] - Include ToastCollector
   * @param {boolean} [options.zonesCollector=true] - Include ZonesCollector
   * @param {boolean} [options.authCollector=true] - Include AuthCollector
   * @param {boolean} [options.entitiesCollector=true] - Include EntitiesCollector
   * @param {boolean} [options.routerCollector=true] - Include RouterCollector
   */
  constructor(options = {}) {
    super(options)
    this._bridge = null
    this._blockId = 'debug-bar'
  }

  /**
   * Check if module should be enabled
   *
   * Debug module is enabled when:
   * - In development mode (ctx.isDev)
   * - OR debug option is explicitly true (ctx.debug)
   *
   * @param {import('../kernel/KernelContext.js').KernelContext} ctx
   * @returns {boolean}
   */
  enabled(ctx) {
    return ctx.isDev || ctx.debug
  }

  /**
   * Connect module to kernel
   *
   * Creates DebugBridge, registers collectors, and sets up DebugBar zone.
   *
   * @param {import('../kernel/KernelContext.js').KernelContext} ctx
   */
  async connect(ctx) {
    this.ctx = ctx

    // Create debug bridge with options
    this._bridge = createDebugBridge({
      enabled: this.options.enabled ?? false
    })

    // Register default collectors
    const collectorOptions = { maxEntries: this.options.maxEntries ?? 100 }

    if (this.options.errorCollector !== false) {
      this._bridge.addCollector(new ErrorCollector(collectorOptions))
    }

    if (this.options.signalCollector !== false) {
      this._bridge.addCollector(new SignalCollector(collectorOptions))
    }

    if (this.options.toastCollector !== false) {
      this._bridge.addCollector(new ToastCollector(collectorOptions))
    }

    if (this.options.zonesCollector !== false) {
      this._bridge.addCollector(new ZonesCollector(collectorOptions))
    }

    if (this.options.authCollector !== false) {
      this._bridge.addCollector(new AuthCollector(collectorOptions))
    }

    if (this.options.entitiesCollector !== false) {
      this._bridge.addCollector(new EntitiesCollector(collectorOptions))
    }

    if (this.options.routerCollector !== false) {
      this._bridge.addCollector(new RouterCollector(collectorOptions))
    }

    // Install collectors with context
    this._bridge.install(ctx)

    // Define the debug zone (for backwards compatibility, but don't render in it)
    // When using debugBar shorthand in Kernel, the root wrapper handles rendering.
    // The zone is still defined so apps can use <QdadmZone name="app:debug" />
    // if they're not using the debugBar shorthand.
    ctx.zone(DEBUG_ZONE)

    // Only register zone block if NOT using Kernel's root wrapper approach
    // This prevents double-rendering when debugBar shorthand is used.
    // Note: When debugBar shorthand is used, Kernel wraps root with QdadmDebugBar.
    // If we also register in zone, layouts with <Zone name="app:debug" /> would render twice.
    if (!this.options._kernelManaged) {
      ctx.block(DEBUG_ZONE, {
        id: this._blockId,
        component: DebugBar,
        props: {
          bridge: this._bridge
        },
        weight: 100
      })
    }

    // Provide debug bridge for injection
    ctx.provide(DEBUG_BRIDGE_KEY, this._bridge)

    // Register global component for use in App.vue (outside authenticated routes)
    ctx.component('QdadmDebugBar', QdadmDebugBar)
  }

  /**
   * Disconnect module from kernel
   *
   * Cleans up debug bridge and removes DebugBar from zone.
   */
  async disconnect() {
    // Uninstall bridge and all collectors
    if (this._bridge) {
      this._bridge.uninstall()
      this._bridge = null
    }

    // Call parent to clean up signal listeners
    await super.disconnect()
  }

  /**
   * Get the debug bridge instance
   *
   * @returns {import('./DebugBridge.js').DebugBridge|null}
   */
  getBridge() {
    return this._bridge
  }
}

export default DebugModule
