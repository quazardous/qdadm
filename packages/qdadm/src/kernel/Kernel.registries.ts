import { createSignalBus } from './SignalBus'
import { createZoneRegistry } from '../zones/ZoneRegistry'
import { createHookRegistry } from '../hooks/HookRegistry'
import { createSecurityChecker } from '../entity/auth/SecurityChecker'
import { PermissionRegistry } from '../security/PermissionRegistry'
import { StaticRoleProvider } from '../security/StaticRolesProvider'
import { createManagers, type ManagerFactoryContext } from '../entity/factory.js'
import { defaultStorageResolver } from '../entity/storage/factory'
import { createDeferredRegistry } from '../deferred/DeferredRegistry.js'
import { createEventRouter } from './EventRouter'
import { createSSEBridge } from './SSEBridge'
import { createLiveEntityRouter, type LiveOrchestratorLike } from './LiveEntityRouter'
import { ActiveStack } from '../chain/ActiveStack.js'
import { StackHydrator } from '../chain/StackHydrator.js'
import { Orchestrator } from '../orchestrator/Orchestrator'
import type { EntityAuthAdapter } from '../entity/auth/EntityAuthAdapter'
import type { Kernel } from './Kernel'
import type { SSEConfig } from './Kernel.types'
// #1196 Phase B — this-typing against the real Kernel shape (was Self = any)
type Self = Kernel

/**
 * Patch Kernel prototype with registry-related methods.
 */
export function applyRegistryMethods(KernelClass: { prototype: Kernel }): void {
  const proto = KernelClass.prototype

  /**
   * Create signal bus for event-driven communication.
   *
   * When `options.existingSignals` is provided (host shell already
   * owns a bus), reuse it instead of spinning up a fresh one. This
   * is what lets qdcms and qdadm share entity events when they're
   * mounted on the same Vue app.
   */
  proto._createSignalBus = function (this: Self): void {
    // Idempotent (#1905 lot B): the constructor builds the bus so consumers can
    // wire it immediately. Replacing it here would orphan every listener
    // registered between construction and createApp() — silently, which is
    // exactly the failure mode this lot exists to remove.
    if (this.signals) return

    if (this.options.existingSignals) {
      this.signals = this.options.existingSignals
      return
    }
    const debug = this.options.debug ?? false
    this.signals = createSignalBus({ debug })
  }

  /**
   * Create hook registry for Drupal-inspired extensibility
   */
  proto._createHookRegistry = function (this: Self): void {
    // Idempotent, and built in the constructor (#1906 lot B1): replacing it in
    // createApp() would orphan every hook registered before then — silently,
    // which is the failure this lot exists to remove.
    if (this.hookRegistry) return

    const debug = this.options.debug ?? false
    this.hookRegistry = createHookRegistry({
      kernel: this.signals.getKernel(),
      debug,
    })
  }

  /**
   * Create orchestrator with managers and signal bus
   */
  proto._createOrchestrator = function (this: Self): void {
    const factoryContext = {
      storageResolver: this.options.storageResolver || defaultStorageResolver,
      managerResolver: this.options.managerResolver,
      managerRegistry: this.options.managerRegistry || {},
    } as ManagerFactoryContext

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const managers = createManagers((this.options.managers || {}) as any, factoryContext)

    this.orchestrator = new Orchestrator({
      managers,
      signals: this.signals,
      hooks: this.hookRegistry,
      deferred: this.deferred,
      entityAuthAdapter: (this.options.entityAuthAdapter as EntityAuthAdapter) || null,
    })

    // Pass kernel options to orchestrator (avoid circular reference for Vue reactivity)
    this.orchestrator.kernelOptions = {
      defaultEntityCacheTtlMs: this.options.defaultEntityCacheTtlMs,
    }

    if (this.options.toast) {
      this.orchestrator.setToastConfig(this.options.toast)
    }
  }

  /**
   * Create PermissionRegistry early so modules can register permissions
   */
  proto._createPermissionRegistry = function (this: Self): void {
    // Idempotent, built in the constructor (#1906 lot B1) — see _createHookRegistry.
    if (this.permissionRegistry) return

    this.permissionRegistry = new PermissionRegistry()
    this._registerCorePermissions()
  }

  /**
   * Register core system permissions provided by the framework
   */
  proto._registerCorePermissions = function (this: Self): void {
    this.permissionRegistry.register('auth', {
      impersonate: 'Impersonate other users',
      manage: 'Manage authentication settings',
    })

    this.permissionRegistry.register('admin', {
      access: 'Access admin panel',
      config: 'Edit system configuration',
    })
  }

  /**
   * Setup security layer (role hierarchy, permissions)
   */
  proto._setupSecurity = function (this: Self): void {
    const { security, entityAuthAdapter } = this.options

    if (!security) return

    this._validateSecurityConfig(security as unknown as Record<string, unknown>)

    // security configured but no user source: every isGranted() falls back
    // to permissive — a newcomer believes gating is on when it isn't (#1388)
    if (!entityAuthAdapter) {
      console.warn(
        '[Kernel] security is configured but entityAuthAdapter is not — entity ' +
          'permission checks default to PERMISSIVE (no current user to check). ' +
          'Pass entityAuthAdapter (e.g. `() => authAdapter.getUser()`) to enable gating.'
      )
    }

    // A `grant` that cannot judge would be silently skipped, leaving the role
    // matrix to decide alone while the app believes its backend does (#2225).
    if (security.grant && typeof security.grant.isGranted !== 'function') {
      throw new Error(
        '[qdadm] security.grant must provide isGranted(attribute, subject, user). ' +
          'Without it the application judgement would be skipped and the role matrix would decide alone.'
      )
    }

    let rolesProvider = security.rolesProvider
    if (!rolesProvider && (security.role_permissions || security.role_hierarchy)) {
      rolesProvider = new StaticRoleProvider({
        role_hierarchy: security.role_hierarchy || {},
        role_permissions: security.role_permissions || {},
        role_labels: security.role_labels || {},
      })
    }

    this.securityChecker = createSecurityChecker({
      rolesProvider: rolesProvider || undefined,
      grant: security.grant,
      getCurrentUser: () =>
        (entityAuthAdapter as EntityAuthAdapter | null)?.getCurrentUser?.() || null,
    })

    // Store entity_permissions config (augment securityChecker for EntityManager to use)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(this.securityChecker as any).entityPermissions = security.entity_permissions ?? false

    const adapter = entityAuthAdapter as EntityAuthAdapter | null
    if (adapter?.setSecurityChecker) {
      adapter.setSecurityChecker(this.securityChecker)
    }

    // One context for both installers. `permissionRegistry` lets a provider or
    // a judge pre-warm in one batch (#2225) — but modules register their
    // entities AFTER this point, so the keys must be read at fetch time, not
    // inside install().
    const ctx = {
      orchestrator: this.orchestrator,
      signals: this.signals,
      permissionRegistry: this.permissionRegistry,
    }
    if (rolesProvider?.install) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rolesProvider.install(ctx as any)
    }
    if (security.grant?.install) {
      security.grant.install(ctx)
    }
  }

  /**
   * Create zone registry for extensible UI composition
   */
  proto._createZoneRegistry = function (this: Self): void {
    // Idempotent, built in the constructor (#1906 lot B1) — see _createHookRegistry.
    if (this.zoneRegistry) return

    const debug = this.options.debug ?? false
    this.zoneRegistry = createZoneRegistry({ debug })
  }

  /**
   * Create active stack for navigation state
   */
  proto._createActiveStack = function (this: Self): void {
    this.activeStack = new ActiveStack(this.signals!)
  }

  /**
   * Create stack hydrator for async data loading
   */
  proto._createStackHydrator = function (this: Self): void {
    this.stackHydrator = new StackHydrator(
      this.activeStack!,
      this.orchestrator!,
      this.signals!
    )
  }

  /**
   * Create deferred registry for async service loading
   */
  proto._createDeferredRegistry = function (this: Self): void {
    // Idempotent, built in the constructor (#1906 lot B1) — see _createHookRegistry.
    if (this.deferred) return

    const debug = this.options.debug ?? false
    // `this.signals` is never null now, so the defensive `?.` this line used
    // to carry is gone. Less guarding, not more: that is the point of closing
    // the window rather than warning about it.
    this.deferred = createDeferredRegistry({
      kernel: this.signals.getKernel(),
      debug,
    })
  }

  /**
   * Create EventRouter for declarative signal routing
   */
  proto._createEventRouter = function (this: Self): void {
    const { eventRouter: routes } = this.options
    if (!routes || Object.keys(routes).length === 0) return

    const debug = this.options.debug ?? false
    this.eventRouter = createEventRouter({
      signals: this.signals!,
      routes,
      debug,
    })
  }

  /**
   * Create SSEBridge for Server-Sent Events to SignalBus integration
   */
  /**
   * The known key a typo most likely meant, or undefined.
   *
   * Case differences and prefixes were all the original matcher caught
   * (#1898), which misses the commonest typo of all: one missing or
   * transposed letter. `securty` suggested nothing, so the reader got
   * "IGNORED" with no hint and no consequence — the two things that make the
   * warning worth printing. An edit distance of one covers an omission, an
   * insertion, a substitution or a transposition; two is allowed only for
   * longer keys, where it stays specific enough not to guess wildly.
   */
  function nearestKnownKey(key: string, known: Set<string>): string | undefined {
    const exact = [...known].find(
      (k) => k.toLowerCase() === key.toLowerCase() || k.startsWith(key) || key.startsWith(k)
    )
    if (exact) return exact

    const budget = key.length >= 8 ? 2 : 1
    let best: string | undefined
    let bestDistance = budget + 1
    for (const candidate of known) {
      const distance = editDistance(key.toLowerCase(), candidate.toLowerCase(), bestDistance)
      if (distance < bestDistance) {
        bestDistance = distance
        best = candidate
      }
    }
    return bestDistance <= budget ? best : undefined
  }

  /** Damerau-Levenshtein, abandoned as soon as it exceeds `cap`. */
  function editDistance(a: string, b: string, cap: number): number {
    if (Math.abs(a.length - b.length) > cap) return cap + 1

    let previous: number[] = Array.from({ length: b.length + 1 }, (_, i) => i)
    let beforePrevious: number[] = []

    for (let i = 1; i <= a.length; i++) {
      const current: number[] = [i]
      let rowBest = i
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1
        let value = Math.min(
          (current[j - 1] as number) + 1,
          (previous[j] as number) + 1,
          (previous[j - 1] as number) + cost
        )
        // Transposition: `raods` for `roads`.
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          value = Math.min(value, (beforePrevious[j - 2] as number) + 1)
        }
        current[j] = value
        rowBest = Math.min(rowBest, value)
      }
      if (rowBest > cap) return cap + 1
      beforePrevious = previous
      previous = current
    }
    return previous[b.length] as number
  }

  /**
   * Warn about keys a config object does not recognise (#1906 lot B2).
   *
   * Extracted from the `sse` validator of #1898, which was the only one of its
   * kind: every other qdadm config accepted anything in silence. The shape of
   * the message is the lesson from that incident and is kept intact — it names
   * what happens INSTEAD of what was asked, because "ignored" reads as "no
   * effect" rather than "falls back to something else", and that reading is
   * what cost a durable auth token in access logs.
   *
   * Only for CLOSED shapes. A config that deliberately forwards unknown keys
   * elsewhere — `debugBar`, whose extra options reach the DebugModule — must
   * not be passed through here: a warning that cries wolf is worse than none
   * (ADR 0011).
   */
  proto._warnUnknownKeys = function (
    this: Self,
    scope: string,
    config: Record<string, unknown>,
    known: Set<string>,
    consequences: Record<string, string> = {}
  ): void {
    const unknown = Object.keys(config).filter((key) => !known.has(key))
    if (!unknown.length) return

    for (const key of unknown) {
      const near = nearestKnownKey(key, known)
      // Look the consequence up under the NEAREST KNOWN key: a typo like
      // `getTokens` means `getToken` is absent, and it is that absence whose
      // effect the reader needs to hear.
      const consequence = consequences[key] ?? (near ? consequences[near] : undefined)
      const because = consequence ? ` — ${consequence}` : ''
      const suggestion = near ? ` Did you mean "${near}"?` : ''
      console.warn(
        `[Kernel] ${scope}${key} is not a recognised option and is IGNORED${because}.` +
          `${suggestion} This usually means the installed qdadm predates the option ` +
          `— check the version before assuming the key has no effect.`
      )
    }
  }

  /**
   * Every option `KernelOptions` accepts (#1906 lot B2).
   *
   * A misspelled TOP-LEVEL key is the worst silence of the family: it does not
   * degrade a feature, it removes a whole section of configuration. `securty:`
   * means no security config at all, and nothing says so. TypeScript catches
   * it; the many consumers whose module files are plain JavaScript get
   * nothing.
   *
   * Kept in sync with the interface by a test that reads `Kernel.types.ts` and
   * compares — a hand-maintained list that drifts would start crying wolf,
   * which is the failure mode this whole ticket exists to avoid.
   */
  const KNOWN_KERNEL_OPTIONS = new Set([
    'apiClient', 'app', 'authAdapter', 'authTypes', 'basePath', 'coreRoutes',
    'debug', 'debugBar', 'defaultEntityCacheTtlMs', 'entityAuthAdapter',
    'eventRouter', 'existingApp', 'existingRouter', 'existingSignals',
    'features', 'hashMode', 'homeRoute', 'i18n', 'layouts', 'managerRegistry',
    'managerResolver', 'managers', 'moduleDefs', 'modules', 'modulesOptions',
    'notifications', 'onAuthExpired', 'pages', 'parentParamMode', 'primevue',
    'root', 'routeParamResolver', 'routePrefix', 'routeState', 'sectionOrder',
    'security', 'sse', 'storageResolver', 'toast', 'warmup',
  ])

  proto._validateKernelOptions = function (this: Self): void {
    this._warnUnknownKeys('', this.options as Record<string, unknown>, KNOWN_KERNEL_OPTIONS, {
      security: 'no role hierarchy or permissions will be applied — every check falls back to the default',
      sse: 'no server-sent events will be connected',
      debugBar: 'no debug bar will be mounted',
      layouts: 'pages will fall back to the base layout',
      i18n: 'translations will not be configured',
      authAdapter: 'the app will run unauthenticated',
    })
  }

  /**
   * Warn about unrecognised `security` keys (#1906 lot B2).
   *
   * Chosen first, and by damage: a misspelled key here means a role hierarchy
   * or a permission map is simply absent, and every check then falls through
   * to whatever the default is. Nothing fails, nothing warns, and the app is
   * open where its author believed it closed.
   */
  proto._validateSecurityConfig = function (this: Self, security: Record<string, unknown>): void {
    this._warnUnknownKeys(
      'security.',
      security,
      new Set(['role_hierarchy', 'role_permissions', 'role_labels', 'entity_permissions', 'rolesProvider', 'grant']),
      {
        role_hierarchy: 'roles will not inherit from one another',
        role_permissions: 'no role will carry any permission',
        entity_permissions: 'per-entity permissions will not be generated',
        rolesProvider: "the current user's roles will not be resolved",
        grant: "the application's judgement will not be consulted — the role matrix decides alone",
      }
    )
  }

  /**
   * Warn about unrecognised `sse` keys (#1898 lot A).
   *
   * A consumer configured `sse.getToken` against a version that predated it.
   * It was not rejected — it was ignored, and the bridge fell back to the
   * session's DURABLE token, which then travelled in the query string of every
   * `/events` request and into logs that outlive the session by months. No
   * error, no warning, and a stream that worked perfectly.
   *
   * The warning therefore names what happens INSTEAD, not merely that the key
   * was ignored: "ignored" reads as "no effect", not as "falls back to a more
   * sensitive secret". That reading is what made the failure invisible.
   */
  proto._validateSseConfig = function (this: Self, sse: SSEConfig): void {
    this._warnUnknownKeys(
      'sse.',
      sse as unknown as Record<string, unknown>,
      new Set([
        'url',
        'reconnectDelay',
        'signalPrefix',
        'autoConnect',
        'withCredentials',
        'tokenParam',
        'events',
        'entities',
        'getToken',
        'connectOnSignal',
        'disconnectOnSignal',
      ]),
      {
        getToken:
          'the session auth token will be sent in the stream URL instead — ' +
          'and query strings reach access logs',
        entities: 'no entity cache will be invalidated from the stream',
        tokenParam: 'the token will be sent under the default name "token"',
      }
    )
  }

  proto._createSSEBridge = function (this: Self): void {
    const { sse, authAdapter } = this.options
    if (!sse?.url) return

    const debug = this.options.debug ?? false

    this._validateSseConfig(sse)

    // An explicit sse.getToken wins — including an explicit null, which means
    // "send no token" and must not fall back to the auth adapter.
    const getToken =
      sse.getToken !== undefined
        ? sse.getToken
        : authAdapter?.getToken
          ? () => authAdapter.getToken!()
          : () => localStorage.getItem('auth_token')

    this.sseBridge = createSSEBridge({
      signals: this.signals!,
      url: sse.url,
      reconnectDelay: sse.reconnectDelay ?? 5000,
      signalPrefix: sse.signalPrefix ?? 'sse',
      autoConnect: sse.autoConnect ?? false,
      withCredentials: sse.withCredentials ?? false,
      tokenParam: sse.tokenParam ?? 'token',
      getToken,
      ...(sse.connectOnSignal !== undefined ? { connectOnSignal: sse.connectOnSignal } : {}),
      ...(sse.disconnectOnSignal !== undefined ? { disconnectOnSignal: sse.disconnectOnSignal } : {}),
      debug,
    })

    // The declared entities imply their own frames: an app that declares
    // `entities` should not also have to remember to list the event names.
    const declaredEvents = sse.entities
      ? ['entity:created', 'entity:updated', 'entity:deleted']
      : []
    const events = [...new Set([...(sse.events ?? []), ...declaredEvents])]

    if (events.length) {
      this.signals!.once('sse:connected', () => {
        this.sseBridge!.registerEvents(events)
      })
    }

    // A restored session must connect the stream too (#1898 lot C).
    //
    // The bridge waits for `auth:login`, which is emitted by the LOGIN PAGE —
    // by the interface, not by the authentication state. So reloading a page
    // with a valid session, or revalidating one without going through our
    // login form, left the stream permanently disconnected.
    //
    // Deliberately NOT fixed by emitting `auth:login` at boot: the kernel
    // listens to it in _setupAuthInvalidation and remounts the whole app, so
    // announcing a restored session that way would remount on every reload.
    // Connecting the bridge directly says the same thing without the blast
    // radius.
    // `in`, not `??`: an EXPLICIT null means "I drive the connection myself",
    // and `??` would treat it as absent and override the opt-out.
    const connectsOnSignal =
      ('connectOnSignal' in sse ? sse.connectOnSignal : 'auth:login') !== null
    if (!sse.autoConnect && connectsOnSignal && authAdapter?.isAuthenticated?.()) {
      if (debug) {
        console.debug('[Kernel] session already authenticated → connecting SSE')
      }
      void this.sseBridge.connect()
    }

    if (sse.entities) {
      this.liveEntityRouter = createLiveEntityRouter({
        signals: this.signals!,
        entities: sse.entities,
        orchestrator: this.orchestrator as unknown as LiveOrchestratorLike,
        signalPrefix: sse.signalPrefix ?? 'sse',
        debug,
      })
      this.liveEntityRouter.attachSignalTransport()
    }
  }
}
