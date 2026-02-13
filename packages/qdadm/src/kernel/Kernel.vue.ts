import {
  createApp,
  h,
  defineComponent,
  type App,
  type Component,
} from 'vue'
import { createPinia } from 'pinia'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import Toast from 'primevue/toast'
import ToastListener from '../toast/ToastListener.vue'
import { createQdadm } from '../plugin.js'
import { createNotificationStore, NOTIFICATION_KEY } from '../notifications/NotificationStore'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Self = any

// Module-level reference to debug bar component (set by constructor)
let _QdadmDebugBar: Component | null = null

/**
 * Set the debug bar component reference (called from Kernel constructor)
 */
export function setQdadmDebugBar(component: Component | null): void {
  _QdadmDebugBar = component
}

/**
 * Patch Kernel prototype with Vue app creation methods.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyVueMethods(KernelClass: { prototype: any }): void {
  const proto = KernelClass.prototype as Self

  /**
   * Create layout components map for useLayoutResolver
   */
  proto._createLayoutComponents = function (this: Self): void {
    const layouts = this.options.layouts || {}
    this.layoutComponents = {
      list: layouts.list || layouts.ListLayout || null,
      form: layouts.form || layouts.FormLayout || null,
      dashboard: layouts.dashboard || layouts.DashboardLayout || null,
      base: layouts.base || layouts.BaseLayout || null,
    }
  }

  /**
   * Create Vue app instance
   */
  proto._createVueApp = function (this: Self): void {
    if (!this.options.root) {
      throw new Error('[Kernel] root component is required')
    }

    const OriginalRoot = this.options.root
    const DebugBarComponent =
      this.options.debugBar?.component && _QdadmDebugBar ? _QdadmDebugBar : null
    const hasPrimeVue = !!this.options.primevue?.plugin
    const appKey = this._appKey

    const WrappedRoot = defineComponent({
      name: 'QdadmRootWrapper',
      setup() {
        return () => {
          const children = [h(OriginalRoot, { key: appKey.value })]

          if (hasPrimeVue) {
            children.push(h(Toast))
            children.push(h(ToastListener))
          }

          if (DebugBarComponent) {
            children.push(h(DebugBarComponent))
          }

          return h(
            'div',
            { id: 'qdadm-root', style: 'display: contents' },
            children
          )
        }
      },
    })

    this.vueApp = createApp(WrappedRoot)
  }

  /**
   * Install all plugins on Vue app
   */
  proto._installPlugins = function (this: Self): void {
    const app = this.vueApp!
    const { authAdapter, features, primevue } = this.options

    app.use(createPinia())

    if (primevue?.plugin) {
      const pvConfig = {
        theme: {
          preset: primevue.theme,
          options: {
            darkModeSelector: '.dark-mode',
            ...primevue.options,
          },
        },
      }
      app.use(primevue.plugin as { install: (app: App, options: unknown) => void }, pvConfig)
      app.use(ToastService)
      app.use(ConfirmationService)
      app.directive('tooltip', Tooltip)
    }

    app.use(this.router!)

    for (const [key, value] of this._pendingProvides) {
      app.provide(key, value)
    }
    this._pendingProvides.clear()

    for (const [name, component] of this._pendingComponents) {
      app.component(name, component)
    }
    this._pendingComponents.clear()

    const { homeRoute } = this.options
    const homeRouteName =
      typeof homeRoute === 'object' ? homeRoute?.name : homeRoute

    app.provide('qdadmZoneRegistry', this.zoneRegistry)
    app.provide('qdadmActiveStack', this.activeStack)
    app.provide('qdadmStackHydrator', this.stackHydrator)

    if (this.options.debug && typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__qdadm = {
        kernel: this,
        orchestrator: this.orchestrator,
        signals: this.signals,
        hooks: this.hookRegistry,
        zones: this.zoneRegistry,
        activeStack: this.activeStack,
        stackHydrator: this.stackHydrator,
        deferred: this.deferred,
        router: this.router,
        get: (name: string) => this.orchestrator!.get(name),
        managers: () => this.orchestrator!.getRegisteredNames(),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__qdadmZones = this.zoneRegistry
      console.debug(
        '[qdadm] Debug mode: window.__qdadm exposed (orchestrator, signals, hooks, zones, deferred, router)'
      )
    }

    app.provide('qdadmSignals', this.signals)

    if (this.sseBridge) {
      app.provide('qdadmSSEBridge', this.sseBridge)
    }

    app.provide('qdadmHooks', this.hookRegistry)
    app.provide('qdadmDeferred', this.deferred)
    app.provide('qdadmLayoutComponents', this.layoutComponents)

    if (this.securityChecker) {
      app.provide('qdadmSecurityChecker', this.securityChecker)
    }
    if (this.permissionRegistry) {
      app.provide('qdadmPermissionRegistry', this.permissionRegistry)
    }

    // Create and provide notification store if notifications are enabled
    if (this.options.notifications?.enabled) {
      this.notificationStore = createNotificationStore({
        maxNotifications: this.options.notifications.maxNotifications,
      })
      app.provide(NOTIFICATION_KEY, this.notificationStore)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qdadmOptions: any = {
      orchestrator: this.orchestrator,
      authAdapter,
      router: this.router,
      toast: app.config.globalProperties.$toast,
      app: this.options.app,
      homeRoute: homeRouteName,
      features: {
        auth: !!authAdapter,
        poweredBy: true,
        ...features,
      },
    }
    app.use(createQdadm(qdadmOptions) as unknown as { install: (app: App) => void })
  }
}
