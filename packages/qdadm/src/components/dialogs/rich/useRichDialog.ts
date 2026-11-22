/**
 * useRichDialog (#5445): open a rich dialog from anywhere, and wait for the
 * answer. Opens are queued and shown one after the other (a licence at
 * login, then what's new), never on top of each other. The kernel draws the
 * host; an app with its own Vue app renders `<QdadmRoot />`.
 *
 *   const { open } = useRichDialog()
 *   const { action, values } = await open({ title: "What's new", blocks, actions, controls })
 */
import { markRaw, shallowReactive } from 'vue'
import type { RichDialogOptions, RichDialogResult } from './types'

interface Entry {
  id: number
  options: RichDialogOptions
  settle: (r: RichDialogResult) => void
}

/** The queue the host shows, its head first */
export const richDialogQueue = shallowReactive<Entry[]>([])
let next = 1
let hosts = 0

/** The host says it is there (tests and hosts only) */
export function registerRichDialogHost(): () => void {
  hosts++
  return () => {
    hosts--
  }
}

const isDev = (): boolean => (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true

/** Show a rich dialog once the ones before it are answered; resolves with the answer */
export function openRichDialog(options: RichDialogOptions): Promise<RichDialogResult> {
  if (!hosts && isDev()) {
    console.warn('[qdadm] openRichDialog: no dialog host is mounted, so nothing shows. The kernel mounts one with PrimeVue; an app with its own Vue app renders <QdadmRoot />.')
  }
  return new Promise((settle) => {
    const opts = options.footer ? { ...options, footer: markRaw(options.footer) } : options
    richDialogQueue.push({ id: next++, options: opts, settle })
  })
}

/** The head of the queue answered: it leaves, the next one shows */
export function settleRichDialog(id: number, result: RichDialogResult): void {
  const i = richDialogQueue.findIndex((e) => e.id === id)
  if (i < 0) return
  const [entry] = richDialogQueue.splice(i, 1)
  entry!.settle(result)
}

export function useRichDialog(): { open: typeof openRichDialog } {
  return { open: openRichDialog }
}
