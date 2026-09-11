/**
 * The debug bar's 📷 (#2318): a picture of the page the user annotates and sends to the agent.
 *
 * Without a real capture it first asks whether to allow one — rendered pictures work, but not everything looks the
 * same. Plain state and steps: the bar only renders them.
 */
import type { RelayChatImageLike, RelayShotLike } from '../../collectors/RelayCollector'

export type ShotStep = 'idle' | 'prompt' | 'shooting' | 'annotate'

/** What the flow needs from the MCP tab's collector. */
export interface ShotSource {
  readonly canShoot: boolean
  readonly canCapture: boolean
  readonly captureActive: boolean
  readonly captureDeclined: boolean
  shoot(): Promise<RelayShotLike>
  startCapture(): Promise<void>
  declineCapture(): void
  sendChat(text: string, image?: RelayChatImageLike): void
}

export interface ShotEvents {
  /** Something the bar renders changed. */
  change(): void
  /** The picture went to the chat. */
  sent(): void
}

/** Why the prompt asks, for the 📷 and for the notice an agent screenshot brings up. */
export const CAPTURE_PROMPT =
  'Real screenshots are off. Without them, pictures are rendered from the page: they work, but a canvas, a video or some effects may look different.'

export class ScreenshotFlow {
  step: ShotStep = 'idle'
  shot: RelayShotLike | null = null
  error: string | null = null
  /** Allow was clicked: the browser's share prompt is up. */
  waiting = false
  /** Why the prompt is still open after Allow. */
  promptNote: string | null = null

  private readonly source: ShotSource
  private readonly events: ShotEvents

  constructor(source: ShotSource, events: ShotEvents) {
    this.source = source
    this.events = events
  }

  get available(): boolean {
    return this.source.canShoot
  }

  /** The 📷 click: the prompt first when a real capture could run but does not, unless the user already declined. */
  async start(): Promise<void> {
    if (this.step !== 'idle' || !this.source.canShoot) return
    this.error = null
    const { canCapture, captureActive, captureDeclined } = this.source
    if (canCapture && !captureActive && !captureDeclined) {
      this.promptNote = null
      this.set('prompt')
      return
    }
    await this.take()
  }

  /**
   * Call it from the click: the browser asks to share the tab only within one. The prompt stays open until the tab is
   * shared — a refused share says so, and going on without takes a click on Continue without.
   */
  async allow(): Promise<void> {
    if (this.step !== 'prompt' || this.waiting) return
    this.waiting = true
    this.promptNote = null
    this.events.change()
    try {
      await this.source.startCapture()
    } catch (e) {
      this.waiting = false
      this.promptNote =
        (e as Error).name === 'NotAllowedError'
          ? 'Not shared. Allow again, or continue without.'
          : `No real screenshots: ${(e as Error).message}`
      this.events.change()
      return
    }
    this.waiting = false
    // Continue without, or Cancel, while the browser asked: that choice stands.
    if (this.step !== 'prompt') {
      this.events.change()
      return
    }
    await this.take()
  }

  /** A capture started some other way (the Status sub-tab) while the prompt is open: go on with the real pixels. */
  async captureStarted(): Promise<void> {
    if (this.step !== 'prompt' || this.waiting || !this.source.captureActive) return
    await this.take()
  }

  /** A rendered picture, and no more prompt in this browser tab. */
  async continueWithout(): Promise<void> {
    if (this.step !== 'prompt') return
    this.source.declineCapture()
    await this.take()
  }

  cancel(): void {
    this.shot = null
    this.set('idle')
  }

  send(text: string, image: RelayChatImageLike): void {
    if (this.step !== 'annotate') return
    this.source.sendChat(text, image)
    this.shot = null
    this.set('idle')
    this.events.sent()
  }

  dismissError(): void {
    this.error = null
    this.events.change()
  }

  private async take(): Promise<void> {
    this.set('shooting')
    try {
      this.shot = await this.source.shoot()
      this.set('annotate')
    } catch (e) {
      this.error = `No screenshot: ${(e as Error).message}`
      this.set('idle')
    }
  }

  private set(step: ShotStep): void {
    this.step = step
    this.events.change()
  }
}
