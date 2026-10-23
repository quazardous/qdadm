/**
 * useAppBanner - the messages of the top strip (#4200)
 *
 * The strip above the layout shows one message at a time: the `app.banner`
 * messages (which environment this is, typically) and the ones the app
 * pushes at runtime with `show()`. A message stays unless it is `closable`;
 * closing one shows the next, and a closed message with an `id` stays closed
 * for the browser session, even when the app shows it again: to bring it
 * back, show it under a new id.
 *
 * @example
 * // Kernel / createQdadm options
 * app: { banner: { id: 'env', text: 'PRODUCTION', severity: 'error' } }
 *
 * // At runtime
 * const banner = useAppBanner()
 * banner.show({ id: 'maintenance', text: 'Maintenance at 22:00', severity: 'warn', closable: true })
 * banner.hide('maintenance')
 */
import { computed, inject, reactive, ref, type ComputedRef } from 'vue'

export type AppBannerSeverity = 'info' | 'success' | 'warn' | 'error'

export interface AppBannerMessage {
  /** Stable id: a later message with the same id replaces it, and closing it lasts the session. */
  id?: string
  text: string
  /** Default: 'info'. */
  severity?: AppBannerSeverity
  /** A PrimeIcons class (`pi pi-…`), or false for none. Default: one per severity. */
  icon?: string | false
  /** A link after the text; an absolute URL opens in a new tab. */
  link?: { label: string; href: string }
  /** Show a close button. Default: false, the message stays. */
  closable?: boolean
  /** Higher first. Default: 0. */
  priority?: number
}

export type AppBannerInput = AppBannerMessage | AppBannerMessage[] | null | undefined

/** `app.banner`: one message, a list, or a function returning either (read reactively). */
export type AppBannerConfig = AppBannerInput | (() => AppBannerInput)

export interface AppBannerEntry {
  /** The message id, or one made from its text when it has none. */
  key: string
  message: AppBannerMessage
}

const STORAGE_KEY = 'qdadm.banner.dismissed'

function readDismissed(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const ids = raw ? JSON.parse(raw) : []
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function toList(input: AppBannerInput): AppBannerMessage[] {
  if (!input) return []
  return (Array.isArray(input) ? input : [input]).filter((m) => m && typeof m.text === 'string' && m.text.trim())
}

const keyOf = (message: AppBannerMessage): string => message.id ?? `text:${message.severity ?? 'info'}:${message.text}`

/** The runtime messages and the dismissals, shared by every strip of the app. */
export function createAppBannerStore() {
  let seq = 0
  const runtime = ref<{ seq: number; message: AppBannerMessage }[]>([])
  // Ids closed this session; messages without an id are closed in memory only
  const dismissed = reactive(new Set<string>(readDismissed()))
  // Ids made up by show(): they mean nothing after a reload
  const generated = new Set<string>()

  return {
    runtime,
    dismissed,
    show(message: AppBannerMessage): string {
      let id = message.id
      if (!id) generated.add((id = `banner-${++seq}`))
      const entry = { seq: ++seq, message: { ...message, id } }
      const at = runtime.value.findIndex((e) => e.message.id === id)
      if (at >= 0) runtime.value.splice(at, 1, entry)
      else runtime.value.push(entry)
      return id
    },
    hide(id: string): void {
      runtime.value = runtime.value.filter((e) => e.message.id !== id)
    },
    dismiss(message: AppBannerMessage): void {
      dismissed.add(keyOf(message))
      if (message.id && !generated.has(message.id)) {
        try {
          const ids = new Set(readDismissed()).add(message.id)
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
        } catch {
          // No session storage: closed until the next reload only
        }
      }
    },
  }
}

export type AppBannerStore = ReturnType<typeof createAppBannerStore>

let store: AppBannerStore | null = null

export function getAppBannerStore(): AppBannerStore {
  return (store ??= createAppBannerStore())
}

export interface UseAppBannerReturn {
  /** The messages to show, in order: closed ones left out. */
  messages: ComputedRef<AppBannerEntry[]>
  show: (message: AppBannerMessage) => string
  hide: (id: string) => void
  /** Close a message: it leaves the strip, the next one shows. */
  dismiss: (message: AppBannerMessage) => void
}

export function useAppBanner(): UseAppBannerReturn {
  const s = getAppBannerStore()
  const app = inject<{ banner?: AppBannerConfig } | null>('qdadmApp', null)

  const messages = computed(() => {
    const config = app?.banner
    const configured = toList(typeof config === 'function' ? config() : config)
    // Config first, then runtime messages by arrival; a runtime id replaces a configured one
    const runtimeIds = new Set(s.runtime.value.map((e) => e.message.id))
    const all = [
      ...configured.filter((m) => !m.id || !runtimeIds.has(m.id)).map((message, i) => ({ order: i - 1e6, message })),
      ...s.runtime.value.map((e) => ({ order: e.seq, message: e.message })),
    ]
    return all
      .filter(({ message }) => !s.dismissed.has(keyOf(message)))
      .sort((a, b) => (b.message.priority ?? 0) - (a.message.priority ?? 0) || a.order - b.order)
      .map(({ message }) => ({ key: keyOf(message), message }))
  })

  return { messages, show: s.show, hide: s.hide, dismiss: s.dismiss }
}
