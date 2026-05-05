import {
  createApp,
  h,
  defineComponent,
  ref,
  type App,
  type Component,
  type Ref,
} from 'vue'
import { createPinia } from 'pinia'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import Toast from 'primevue/toast'
import ToastListener from '../toast/ToastListener.vue'
import { createQdadm } from '../plugin.js'
import { createNotificationStore, NOTIFICATION_KEY } from '../notifications/NotificationStore'
import { I18N_INJECTION_KEY } from '../i18n/useI18n'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Self = any

/**
 * Reactive reference to the debug bar component, set by the Kernel
 * constructor when `debugBar.component` is provided. Exposed as a
 * `Ref<Component | null>` so the `<QdadmRoot />` host helper can
 * pick it up reactively regardless of mount order.
 */
export const qdadmDebugBarRef: Ref<Component | null> = ref(null)

/**
 * Set the debug bar component reference (called from Kernel constructor).
 * Kept as a function for back-compat; equivalent to
 * `qdadmDebugBarRef.value = component`.
 */
export function setQdadmDebugBar(component: Component | null): void {
  qdadmDebugBarRef.value = component
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
   * Create Vue app instance.
   *
   * When `options.existingApp` is provided, the Kernel reuses the
   * host's app and skips its own `createApp(WrappedRoot)`. The host
   * is then responsible for rendering qdadm's DOM extras (Toast,
   * ToastListener, DebugBar) — see `<QdadmRoot />` for a drop-in
   * helper that does it.
   *
   * `options.root` is ignored in this mode (the host already mounted
   * its own root).
   */
  proto._createVueApp = function (this: Self): void {
    if (this.options.existingApp) {
      this.vueApp = this.options.existingApp
      return
    }

    if (!this.options.root) {
      throw new Error('[Kernel] root component is required (or pass options.existingApp)')
    }

    const OriginalRoot = this.options.root
    const DebugBarComponent =
      this.options.debugBar?.component && qdadmDebugBarRef.value
        ? qdadmDebugBarRef.value
        : null
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
   * Install all plugins on Vue app.
   *
   * When a host shell uses `existingApp`, it may have already
   * installed Pinia / PrimeVue / vue-router. Calling `app.use(plugin)`
   * twice is harmless for stateless plugins (vue-router, Pinia
   * recognise the duplicate and no-op), but PrimeVue does not — guard
   * with `_qdadmPluginsInstalled` markers on globalProperties so the
   * Kernel never double-installs PrimeVue, ToastService, or
   * ConfirmationService.
   */
  proto._installPlugins = function (this: Self): void {
    const app = this.vueApp!
    const { authAdapter, features, primevue, existingApp } = this.options
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const marks = (app.config.globalProperties as any).__qdadmInstalled ??= {
      pinia: false,
      primevue: false,
      router: false,
    }

    if (!marks.pinia) {
      app.use(createPinia())
      marks.pinia = true
    }

    if (primevue?.plugin && !marks.primevue) {
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
      marks.primevue = true
    }

    // Skip vue-router install when the host owned the router from the
    // start — they already called `app.use(router)`. Calling it again
    // emits Vue's "Plugin has already been applied" warning. When
    // Kernel created the router itself, install is required.
    if (!marks.router && !this.options.existingRouter) {
      app.use(this.router!)
      marks.router = true
    }

    // Avoid eslint unused-var warning when host owns the app
    void existingApp

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
      const self = this
      // Single namespaced surface for browser-console & agent introspection.
      // The `debug` sub-object proxies to whatever DebugBridge the DebugModule
      // installed (resolved lazily so we don't depend on module load order).
      const debugProxy = {
        get bridge() {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const debugMod = (self as any).moduleLoader?.getModules?.()?.get?.('debug')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return debugMod?.getBridge?.() ?? (debugMod as any)?._bridge ?? null
        },
        describe(): unknown {
          const b = this.bridge
          return b ? b.describe() : null
        },
        dump(): unknown {
          const b = this.bridge
          return b ? b.dump() : null
        },
        call(name: string, action: string, args: Record<string, unknown> = {}): Promise<unknown> {
          const b = this.bridge
          if (!b) return Promise.reject(new Error('[qdadm] DebugBridge unavailable'))
          return b.call(name, action, args)
        },
      }
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
        i18n: this.i18nInstance,
        get: (name: string) => this.orchestrator!.get(name),
        managers: () => this.orchestrator!.getRegisteredNames(),
        debug: debugProxy,
      }
      console.debug(
        '[qdadm] Debug mode: window.__qdadm.{kernel,orchestrator,signals,hooks,zones,router,i18n,debug.{describe,dump,call}}'
      )
    }

    app.provide('qdadmSignals', this.signals)

    if (this.i18nInstance) {
      app.provide(I18N_INJECTION_KEY, this.i18nInstance)
      app.provide('qdadmI18n', this.i18nInstance)
    }

    if (this.sseBridge) {
      app.provide('qdadmSSEBridge', this.sseBridge)
    }

    app.provide('qdadmHooks', this.hookRegistry)
    app.provide('qdadmDeferred', this.deferred)
    app.provide('qdadmLayoutComponents', this.layoutComponents)
    // Surface PrimeVue presence so host-rendered <QdadmRoot /> can
    // decide whether to mount Toast / ToastListener.
    app.provide('qdadmHasPrimeVue', !!primevue?.plugin)

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
