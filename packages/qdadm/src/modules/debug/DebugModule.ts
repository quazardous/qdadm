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
 */

import { h, inject, defineComponent, type DefineComponent } from 'vue'
import { Module, type ModuleOptions } from '../../kernel/Module'
import { createDebugBridge, type DebugBridge } from './DebugBridge'
import { ErrorCollector } from './ErrorCollector'
import { SignalCollector } from './SignalCollector'
import { ToastCollector } from './ToastCollector'
import { ZonesCollector } from './ZonesCollector'
import { AuthCollector } from './AuthCollector'
import { EntitiesCollector } from './EntitiesCollector'
import { RouterCollector } from './RouterCollector'
import DebugBar from './components/DebugBar.vue'
import type { KernelContext } from '../../kernel/KernelContext'

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
 */
export const QdadmDebugBar = defineComponent({
  name: 'QdadmDebugBar',
  setup() {
    const bridge = inject<DebugBridge | null>(DEBUG_BRIDGE_KEY, null)
    return () => bridge ? h(DebugBar as unknown as DefineComponent, { bridge }) : null
  }
})

/**
 * Debug module options
 */
export interface DebugModuleOptions extends ModuleOptions {
  enabled?: boolean
  maxEntries?: number
  errorCollector?: boolean
  signalCollector?: boolean
  toastCollector?: boolean
  zonesCollector?: boolean
  authCollector?: boolean
  entitiesCollector?: boolean
  routerCollector?: boolean
  _kernelManaged?: boolean
}

/**
 * DebugModule - Integrates debug tools into the application
 */
export class DebugModule extends Module {
  static override moduleName = 'debug'
  static override requires: string[] = []
  static override priority = 1000
  static styles = () => import('./styles.scss')

  declare options: DebugModuleOptions
  private _bridge: DebugBridge | null = null
  private _blockId = 'debug-bar'

  constructor(options: DebugModuleOptions = {}) {
    super(options)
  }

  /**
   * Check if module should be enabled
   */
  override enabled(ctx: KernelContext): boolean {
    const extCtx = ctx as KernelContext & { isDev?: boolean; debug?: boolean }
    return extCtx.isDev || extCtx.debug || false
  }

  /**
   * Connect module to kernel
   */
  override async connect(ctx: KernelContext): Promise<void> {
    this.ctx = ctx as unknown as Record<string, unknown>

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
    this._bridge.install(ctx as unknown as Record<string, unknown>)

    // Define the debug zone
    const extCtx = ctx as KernelContext & {
      zone: (name: string) => void
      block: (zone: string, config: {
        id: string
        component: unknown
        props: Record<string, unknown>
        weight: number
      }) => void
      provide: (key: symbol, value: unknown) => void
      component: (name: string, component: unknown) => void
    }

    extCtx.zone(DEBUG_ZONE)

    // Only register zone block if NOT using Kernel's root wrapper approach
    if (!this.options._kernelManaged) {
      extCtx.block(DEBUG_ZONE, {
        id: this._blockId,
        component: DebugBar,
        props: {
          bridge: this._bridge
        },
        weight: 100
      })
    }

    // Provide debug bridge for injection
    extCtx.provide(DEBUG_BRIDGE_KEY, this._bridge)

    // Register global component for use in App.vue
    extCtx.component('QdadmDebugBar', QdadmDebugBar)
  }

  /**
   * Disconnect module from kernel
   */
  override async disconnect(): Promise<void> {
    if (this._bridge) {
      this._bridge.uninstall()
      this._bridge = null
    }

    await super.disconnect()
  }

  /**
   * Get the debug bridge instance
   */
  getBridge(): DebugBridge | null {
    return this._bridge
  }
}

export default DebugModule
