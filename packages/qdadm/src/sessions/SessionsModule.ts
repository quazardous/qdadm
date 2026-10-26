/**
 * SessionsModule (#4336): who else has the admin open, and the sign-in
 * history, over a SessionsAdapter.
 *
 *   moduleDefs: [new SessionsModule({ base: '/api/sessions', permission: 'admin:sessions', bannerSeverity: 'warn' })]
 *   // or any transport:
 *   new SessionsModule({ adapter: mySessionsAdapter })
 *
 * - A heartbeat every `interval` seconds while the tab is visible and someone
 *   is signed in (stops on auth:logout).
 * - The "Also signed in: X (since 10 min)" banner while the server reports others.
 * - A "Sessions" page (route and menu entry under `permission`): present,
 *   paged history, Close with a reason (adapter.close and `closePermission`).
 */
import { Module } from '../kernel/Module'
import type { I18n } from '../i18n/I18n'
import type { TranslateParams } from '../i18n'
import { getAppBannerStore } from '../composables/useAppBanner'
import type { AppBannerSeverity } from '../composables/useAppBanner'
import { restSessionsAdapter, type SessionPresence, type SessionsAdapter, type RestSessionsAdapterOptions } from './sessionsAdapter'
import { createPresence, type Presence } from './presence'

export const SESSIONS_BANNER_ID = 'qdadm.sessions.others'

/** A text the app replaces: a string (`{name}` placeholders) or a function of the params */
export type SessionsLabel = string | ((params: TranslateParams) => string)

export interface SessionsModuleOptions {
  /** The transport; or `base` for restSessionsAdapter(base, rest) */
  adapter?: SessionsAdapter
  base?: string
  rest?: RestSessionsAdapterOptions
  /** Seconds between heartbeats (default 30) */
  interval?: number
  /** The banner's severity (default 'info'; 'warn' for a delivery admin) */
  bannerSeverity?: AppBannerSeverity
  /** No banner at all */
  banner?: boolean
  /** Who sees the Sessions page and its menu entry (the router refuses the others) */
  permission?: string
  /** Who may close a session (default: `permission`) */
  closePermission?: string
  /** The page's path (default 'sessions'); false: no page */
  path?: string | false
  nav?: { section?: string; icon?: string; label?: string } | false
  /** Rows per history page (default 25) */
  historyPageSize?: number
  /** Texts: `banner` ({ list }), `bannerOne` ({ name, since }) and any core.sessions.<key> */
  labels?: Record<string, SessionsLabel>
}

interface SessionsRuntime {
  options: Required<Pick<SessionsModuleOptions, 'interval' | 'bannerSeverity' | 'historyPageSize'>> & SessionsModuleOptions
  adapter: SessionsAdapter
  presence: Presence | null
}

let runtime: SessionsRuntime | null = null

/** The module's adapter and options, for the Sessions page */
export function getSessionsRuntime(): SessionsRuntime | null {
  return runtime
}

/** "10 min", "2 h", "3 d" since an ISO date */
export function sinceText(iso?: string, now = Date.now()): string {
  const at = iso ? Date.parse(iso) : NaN
  if (Number.isNaN(at)) return ''
  const min = Math.max(0, Math.floor((now - at) / 60000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return h < 48 ? `${h} h` : `${Math.floor(h / 24)} d`
}

export class SessionsModule extends Module {
  static override moduleName = 'sessions'
  static override requires: string[] = []

  declare options: SessionsModuleOptions & Record<string, unknown>

  constructor(options: SessionsModuleOptions = {}) {
    super(options as Record<string, unknown>)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override async connect(ctx: any): Promise<void> {
    const options = this.options as SessionsModuleOptions
    const adapter = options.adapter ?? (options.base ? restSessionsAdapter(options.base, options.rest) : null)
    if (!adapter) throw new Error('[qdadm] SessionsModule needs `adapter` or `base`')

    const i18n = ctx.i18n as I18n | null
    const label = (key: string, fallback: string, params: TranslateParams = {}): string => {
      const custom = options.labels?.[key]
      if (typeof custom === 'function') return custom(params)
      if (typeof custom === 'string') return custom.replace(/\{(\w+)\}/g, (m, n) => (n in params ? String(params[n]) : m))
      const trace = i18n?.resolve(`core.sessions.${key}`, params)
      return trace?.hit ? trace.result : fallback.replace(/\{(\w+)\}/g, (m, n) => (n in params ? String(params[n]) : m))
    }

    const banners = getAppBannerStore()
    const showOthers = (others: SessionPresence[]) => {
      if (options.banner === false || !others.length) return banners.hide(SESSIONS_BANNER_ID)
      const list = others
        .map((o) => {
          const since = sinceText(o.since)
          return since ? label('bannerOne', '{name} (since {since})', { name: o.login, since }) : o.login
        })
        .join(', ')
      banners.show({ id: SESSIONS_BANNER_ID, text: label('banner', 'Also signed in: {list}', { list }), severity: options.bannerSeverity ?? 'info' })
    }

    const presence = createPresence({ adapter, interval: options.interval ?? 30, onOthers: showOthers })
    runtime = {
      options: { interval: 30, bannerSeverity: 'info', historyPageSize: 25, ...options },
      adapter,
      presence,
    }

    // Beat while someone is signed in
    const auth = ctx.auth as { isAuthenticated?: () => boolean } | null
    if (!auth || auth.isAuthenticated?.() !== false) presence.start()
    ctx.on('auth:login', () => presence.start())
    ctx.on('auth:logout', () => presence.stop())

    if (options.path !== false) {
      const path = options.path ?? 'sessions'
      ctx.routes(
        path,
        [{ path: '', name: 'qdadm-sessions', component: () => import('./SessionsPage.vue'), meta: { layout: 'page' } }],
        { label: label('title', 'Sessions'), ...(options.permission ? { permission: options.permission } : {}) }
      )
      if (options.nav !== false) {
        ctx.navItem({
          section: options.nav?.section ?? 'Admin',
          route: 'qdadm-sessions',
          icon: options.nav?.icon ?? 'pi pi-users',
          label: options.nav?.label ?? label('title', 'Sessions'),
        })
      }
    }
  }

  override async disconnect(): Promise<void> {
    runtime?.presence?.stop()
    runtime = null
    await super.disconnect()
  }
}

export function createSessionsModule(options: SessionsModuleOptions): SessionsModule {
  return new SessionsModule(options)
}
