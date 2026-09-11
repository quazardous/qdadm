/**
 * RelayCollector — the MCP tab (#2231).
 *
 * Pairs this browser tab with a local qdadm-mcp-relay through
 * `window.__qdadmRelay`, the controller `@quazardous/qdadm-mcp/connector`
 * installs. qddebug knows nothing else about MCP. Current state only, no
 * ring buffer.
 *
 * The pairing code never leaves the tab: `snapshot()` and the `state` action
 * redact it. The debug bridge is readable over HTTP and MCP, and an agent
 * able to read the code could pair a tab nobody pointed it at — the code
 * exists precisely so that a human carries it.
 */
import {
  Collector,
  type CollectorContext,
  type CollectorManifest,
  type CollectorOptions,
  type CollectorSnapshot,
} from '../bridge/Collector'

export interface RelayIdentityLike {
  project?: string
  cwd?: string
  port?: number
}

export interface RelayStateLike {
  status: string
  code?: string
  message?: string
  permissionPending?: boolean
  ports?: readonly number[]
  relay?: RelayIdentityLike
  relays?: RelayIdentityLike[]
  instanceId?: string
  retryInMs?: number
}

/** A screenshot the user annotated and sent in the chat (#2309). */
export interface RelayChatImageLike {
  mimeType: string
  /** Base64, without the `data:` prefix. */
  data: string
}

export interface RelayChatMessageLike {
  id: number
  from: 'agent' | 'user'
  text: string
  at: number
  image?: RelayChatImageLike
  /** It had a screenshot, dropped to keep the chat within the tab's storage. */
  imageDropped?: boolean
}

/** A picture of the viewport, taken by the connector for the user to annotate (#2309). */
export interface RelayShotLike {
  data: string
  mimeType: string
  width: number
  height: number
  source?: string
}

export interface RelayActivityLike {
  id: number
  at: number
  tool: string
  detail: string
  ok: boolean
  error?: string
  ms: number
}

export interface RelayControllerLike {
  readonly mode?: 'auto' | 'pairing' | 'token'
  readonly instanceId?: string
  readonly state: RelayStateLike
  subscribe(listener: (state: RelayStateLike) => void): () => void
  pair(port?: number): Promise<void>
  unpair(): void
  readonly chat?: {
    readonly messages: readonly RelayChatMessageLike[]
    send(text: string, image?: RelayChatImageLike): void
    /** Absent from connectors older than #2309. */
    shoot?(): Promise<RelayShotLike>
    clear?(): void
    subscribe(listener: (messages: readonly RelayChatMessageLike[]) => void): () => void
  }
  readonly activity?: {
    readonly entries: readonly RelayActivityLike[]
    subscribe(listener: (entries: readonly RelayActivityLike[]) => void): () => void
  }
  /** Real screenshots (#2247): a capture of this tab the user starts with a click. */
  readonly capture?: {
    readonly active: boolean
    /** False on a browser that cannot capture a tab. Absent from connectors older than #2318. */
    readonly supported?: boolean
    start(): Promise<void>
    stop(): void
    subscribe(listener: (active: boolean) => void): () => void
    /** An agent screenshot was rendered from the page because no capture runs (#2318). Absent from older connectors. */
    onSuggest?(listener: () => void): () => void
  }
}

/** The controller the relay connector installed, if any. */
export function findRelayController(): RelayControllerLike | null {
  try {
    const c = (globalThis as { __qdadmRelay?: RelayControllerLike }).__qdadmRelay
    return c && typeof c.subscribe === 'function' && typeof c.pair === 'function' ? c : null
  } catch {
    return null
  }
}

const REDACTED = '[shown in the browser tab only]'

/**
 * What the MCP tab has shown (#2285), kept for the browser tab like the chat: a reload must not bring old messages
 * back as new. Chat and history ids keep counting across a clear and a reload, so "seen up to id" holds.
 */
const SEEN_KEY = 'qdadm-debug:mcp-seen'

interface SeenMarks {
  chat: number
  history: number
}

type TabStorage = Pick<Storage, 'getItem' | 'setItem'>

function tabStorage(): TabStorage | null {
  try {
    return (globalThis as { sessionStorage?: TabStorage }).sessionStorage ?? null
  } catch {
    return null
  }
}

const lastId = (items: readonly { id: number }[]) => items.at(-1)?.id ?? 0

/** Statuses the Status sub-tab flags: something to read or to fix. */
const STATUS_ALERTS = new Set(['offline', 'error', 'awaiting-code'])

/** Status / Chat / History — remembered for the browser tab. */
export type RelaySubTab = 'status' | 'chat' | 'history'
const SUBTAB_KEY = 'qdadm-debug:mcp-subtab'

/** The user went on without real screenshots (#2318): not asked again in this browser tab. */
const DECLINED_KEY = 'qdadm-debug:mcp-capture-declined'

/** The notice an agent screenshot brings up (#2318): how long it stays, and how soon it may come back. */
export const CAPTURE_NOTICE_MS = 10_000
export const CAPTURE_NOTICE_EVERY_MS = 60_000

export class RelayCollector extends Collector {
  static override collectorName = 'mcp'
  static override records = false

  private _controller: RelayControllerLike | null = null
  private _state: RelayStateLike = { status: 'unavailable' }
  private _unsubscribe: (() => void) | null = null
  private _chat: readonly RelayChatMessageLike[] = []
  private _unsubscribeChat: (() => void) | null = null
  private _activity: readonly RelayActivityLike[] = []
  private _unsubscribeActivity: (() => void) | null = null
  private _captureActive = false
  private _unsubscribeCapture: (() => void) | null = null
  private _unsubscribeSuggest: (() => void) | null = null
  private _declined: boolean | null = null
  private _captureNotice = false
  private _noticeShownAt: number | null = null
  private _noticeTimer: ReturnType<typeof setTimeout> | null = null
  private _subTab: RelaySubTab | null = null
  private _seen: SeenMarks | null = null

  constructor(options: CollectorOptions = {}) {
    super(options)
    this.registerAction(
      { name: 'state', summary: 'Current pairing state. The code is redacted: a human reads it in the tab.' },
      () => this.publicState()
    )
    this.registerAction(
      { name: 'pair', summary: 'Scan the relay ports (or one port) and ask to pair.', args: { port: 'number?' }, mutates: true },
      async (args) => {
        await this.pair(typeof args?.port === 'number' ? args.port : undefined)
        return this.publicState()
      }
    )
    this.registerAction({ name: 'unpair', summary: 'Forget the pairing on both sides.', mutates: true }, () => {
      this.unpair()
      return this.publicState()
    })
  }

  get state(): RelayStateLike {
    return this._state
  }

  /** How this tab reaches the relay: `auto` on a dev page, `pairing` elsewhere. */
  get mode(): 'auto' | 'pairing' | 'token' | null {
    return this._controller?.mode ?? null
  }

  get instanceId(): string | null {
    return this._controller?.instanceId ?? null
  }

  /** The chat with the agent (#2231): its `chat_send`, the user's replies it reads with `chat_read`. */
  get chat(): readonly RelayChatMessageLike[] {
    return this._chat
  }

  get canChat(): boolean {
    return !!this._controller?.chat
  }

  /** What agents did in this tab through the MCP, newest last. */
  get activity(): readonly RelayActivityLike[] {
    return this._activity
  }

  get hasActivity(): boolean {
    return !!this._controller?.activity
  }

  /** Real screenshots for agents: whether the connector offers them, and whether one runs. */
  get canCapture(): boolean {
    const capture = this._controller?.capture
    return !!capture && capture.supported !== false
  }

  get captureActive(): boolean {
    return this._captureActive
  }

  /** Call it from the user's click: the browser asks them to share this tab. */
  startCapture(): Promise<void> {
    return this._controller?.capture ? this._controller.capture.start() : Promise.resolve()
  }

  stopCapture(): void {
    this._controller?.capture?.stop()
  }

  /** The user went on without real screenshots: neither the 📷 prompt nor the agent notice asks again in this browser tab. */
  get captureDeclined(): boolean {
    if (this._declined === null) {
      try {
        this._declined = tabStorage()?.getItem(DECLINED_KEY) === '1'
      } catch {
        this._declined = false
      }
    }
    return this._declined
  }

  declineCapture(): void {
    this._declined = true
    try {
      tabStorage()?.setItem(DECLINED_KEY, '1')
    } catch {
      /* storage refused: the choice lasts for the page only */
    }
    this.dismissCaptureNotice()
    this.notifyChange()
  }

  /**
   * An agent screenshot was just rendered from the page (#2318): the bar offers real screenshots in a corner, without
   * blocking anything. It goes away on its own after CAPTURE_NOTICE_MS.
   */
  get captureNotice(): boolean {
    return this._captureNotice
  }

  dismissCaptureNotice(): void {
    if (this._noticeTimer) clearTimeout(this._noticeTimer)
    this._noticeTimer = null
    if (!this._captureNotice) return
    this._captureNotice = false
    this.notifyChange()
  }

  /** A burst of agent screenshots brings the notice up once: again only after CAPTURE_NOTICE_EVERY_MS. */
  private _suggestCapture(): void {
    if (!this.canCapture || this._captureActive || this.captureDeclined) return
    const now = Date.now()
    if (this._noticeShownAt !== null && now - this._noticeShownAt < CAPTURE_NOTICE_EVERY_MS) return
    this._noticeShownAt = now
    this._captureNotice = true
    if (this._noticeTimer) clearTimeout(this._noticeTimer)
    this._noticeTimer = setTimeout(() => this.dismissCaptureNotice(), CAPTURE_NOTICE_MS)
    this.notifyChange()
  }

  /** The MCP tab's sub-tab. The bar opens Chat once a screenshot is sent (#2318). */
  get subTab(): RelaySubTab {
    if (this._subTab === null) {
      let saved: string | null = null
      try {
        saved = tabStorage()?.getItem(SUBTAB_KEY) ?? null
      } catch {
        /* storage refused: start on Status */
      }
      this._subTab = saved === 'chat' || saved === 'history' ? saved : 'status'
    }
    return this._subTab
  }

  openSubTab(tab: RelaySubTab): void {
    if (tab === this.subTab) return
    this._subTab = tab
    try {
      tabStorage()?.setItem(SUBTAB_KEY, tab)
    } catch {
      /* storage refused: the choice just does not survive a reload */
    }
    this.notifyChange()
  }

  sendChat(text: string, image?: RelayChatImageLike): void {
    const chat = this._controller?.chat
    if (!chat) return
    if (image) chat.send(text, image)
    else chat.send(text)
  }

  /** The chat can take a screenshot for the user to annotate and send (#2309). */
  get canShoot(): boolean {
    return typeof this._controller?.chat?.shoot === 'function'
  }

  /** A picture of the viewport, without the debug bar (real pixels while a tab capture runs). */
  shoot(): Promise<RelayShotLike> {
    const chat = this._controller?.chat
    return chat?.shoot ? chat.shoot() : Promise.reject(new Error('This connector cannot take a screenshot.'))
  }

  clearChat(): void {
    this._controller?.chat?.clear?.()
  }

  pair(port?: number): Promise<void> {
    return this._controller ? this._controller.pair(port) : Promise.resolve()
  }

  unpair(): void {
    this._controller?.unpair()
  }

  /** State as the bridge may expose it: everything but the code. */
  publicState(): RelayStateLike {
    return this._state.code ? { ...this._state, code: REDACTED } : { ...this._state }
  }

  /** Agent chat messages the Chat sub-tab has not shown yet. */
  get unseenChat(): number {
    const seen = this._seen
    return seen ? this._chat.filter((m) => m.from === 'agent' && m.id > seen.chat).length : 0
  }

  /** Agent requests the History sub-tab has not shown yet. */
  get unseenHistory(): number {
    const seen = this._seen
    return seen ? this._activity.filter((e) => e.id > seen.history).length : 0
  }

  /** The Status sub-tab has something to say: the relay is offline, something failed, or a code waits. */
  get statusAlert(): boolean {
    return STATUS_ALERTS.has(this._state.status)
  }

  /** The Chat sub-tab is on screen: what it shows is seen. */
  markChatSeen(): void {
    this._markSeen('chat', lastId(this._chat))
  }

  /** The History sub-tab is on screen: what it shows is seen. */
  markHistorySeen(): void {
    this._markSeen('history', lastId(this._activity))
  }

  private _markSeen(kind: keyof SeenMarks, id: number): void {
    if (!this._seen || id <= this._seen[kind]) return
    this._seen = { ...this._seen, [kind]: id }
    this._saveSeen()
    this.notifyChange()
  }

  private _saveSeen(): void {
    try {
      tabStorage()?.setItem(SEEN_KEY, JSON.stringify(this._seen))
    } catch {
      /* storage refused: the marks last for the page only */
    }
  }

  private _readSeen(): SeenMarks | null {
    try {
      const saved = JSON.parse(tabStorage()?.getItem(SEEN_KEY) ?? 'null') as Partial<SeenMarks> | null
      return saved && typeof saved.chat === 'number' && typeof saved.history === 'number'
        ? { chat: saved.chat, history: saved.history }
        : null
    } catch {
      return null
    }
  }

  /**
   * The MCP tab icon (#2285): what agents said and did that the tab has not shown yet. While a code waits or
   * something failed, it asks for attention even with nothing new.
   */
  override getBadge(countAll = false): number {
    const count = countAll
      ? this._chat.filter((m) => m.from === 'agent').length + this._activity.length
      : this.unseenChat + this.unseenHistory
    if (count > 0) return count
    return this._state.status === 'awaiting-code' || this._state.status === 'error' ? 1 : 0
  }

  protected override _doInstall(_ctx: CollectorContext): void {
    this._controller = findRelayController()
    if (!this._controller) {
      this._state = { status: 'unavailable' }
      return
    }
    const saved = this._readSeen()
    this._unsubscribe = this._controller.subscribe((next) => {
      this._state = next
      this.notifyChange()
    })
    this._unsubscribeChat =
      this._controller.chat?.subscribe((messages) => {
        this._chat = [...messages]
        this.notifyChange()
      }) ?? null
    this._unsubscribeActivity =
      this._controller.activity?.subscribe((entries) => {
        this._activity = [...entries]
        this.notifyChange()
      }) ?? null
    this._unsubscribeCapture =
      this._controller.capture?.subscribe((active) => {
        this._captureActive = active
        if (active) this.dismissCaptureNotice()
        this.notifyChange()
      }) ?? null
    this._unsubscribeSuggest = this._controller.capture?.onSuggest?.(() => this._suggestCapture()) ?? null
    // No marks yet: what the tab already held is not news.
    this._seen = saved ?? { chat: lastId(this._chat), history: lastId(this._activity) }
    if (!saved) this._saveSeen()
    this.notifyChange()
  }

  protected override _doUninstall(): void {
    this._unsubscribe?.()
    this._unsubscribe = null
    this._unsubscribeChat?.()
    this._unsubscribeChat = null
    this._unsubscribeActivity?.()
    this._unsubscribeActivity = null
    this._unsubscribeCapture?.()
    this._unsubscribeCapture = null
    this._unsubscribeSuggest?.()
    this._unsubscribeSuggest = null
    if (this._noticeTimer) clearTimeout(this._noticeTimer)
    this._noticeTimer = null
  }

  override snapshot(): CollectorSnapshot {
    return {
      ...super.snapshot(),
      state: this.publicState() as unknown as Record<string, unknown>,
      unseen: this.unseenChat + this.unseenHistory,
      unseenBy: { chat: this.unseenChat, history: this.unseenHistory },
    }
  }

  override describe(): CollectorManifest {
    return {
      ...super.describe(),
      summary: 'Pairing of this browser tab with a local MCP relay (qdadm-mcp-relay). The pairing code is never exposed here.',
      stateShape: {
        status:
          'unavailable | connecting | connected | offline | idle | scanning | none-found | choose | awaiting-code | reconnecting | paired | error',
        relay: '{ project, cwd, port }?',
        message: 'string?',
        unseenBy: '{ chat, history }: agent messages and requests the MCP tab has not shown yet (snapshot)',
      },
    }
  }
}
