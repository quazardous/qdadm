/**
 * Screenshots kept in the project (#2284). The stdio front is the process an agent's MCP client starts in its
 * project, and every picture passes through it: it writes each one under `.aiball/screenshots/` there. The relay
 * itself serves every project and writes nothing.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { SCREENSHOT_META } from '../tools.ts'

export const SCREENSHOTS_DIR = join('.aiball', 'screenshots')

export interface ScreenshotMeta {
  instance?: string
  location?: string | null
}

const pad = (n: number) => String(n).padStart(2, '0')
const stamp = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`

/** `/books/12/edit` → `books-12-edit`; the home page is `home`. */
export function pageSlug(location: string | null | undefined): string {
  const slug = String(location ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '')
  return slug || 'home'
}

/** `20260911-112233-34fcb409-books-12-edit.jpg`; with a label, it replaces the page (`…-34fcb409-chat.jpg`). */
export function screenshotFileName(at: Date, meta: ScreenshotMeta, mimeType: string, label?: string): string {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg'
  return `${stamp(at)}-${(meta.instance ?? 'tab').slice(0, 8)}-${pageSlug(label ?? meta.location)}.${ext}`
}

export interface KeepScreenshotOptions {
  /** The project: where `.aiball/screenshots/` goes, and what the path in the answer is relative to. */
  cwd: string
  now?: () => Date
  /** Name the files after this rather than the page: `chat` for the pictures the user sent (#2309). */
  label?: string
}

/** Writes the pictures of an answer and adds where to the answer. Saving never fails the call. */
export function keepScreenshot(result: CallToolResult, options: KeepScreenshotOptions): CallToolResult {
  const images = result.content.filter((c) => c.type === 'image') as Array<{ data: string; mimeType: string }>
  if (result.isError || images.length === 0) return result

  const meta: ScreenshotMeta = { ...((result._meta?.[SCREENSHOT_META] as ScreenshotMeta | undefined) ?? {}) }
  if (!meta.instance) {
    // A relay older than the front sends no _meta: its text still starts with the instance.
    const text = result.content.find((c) => c.type === 'text') as { text: string } | undefined
    meta.instance = /^Instance (\w{8})/.exec(text?.text ?? '')?.[1]
  }

  const saved: string[] = []
  let note: string
  try {
    const dir = join(options.cwd, SCREENSHOTS_DIR)
    mkdirSync(dir, { recursive: true })
    const at = (options.now ?? (() => new Date()))()
    for (const image of images) {
      const name = screenshotFileName(at, meta, image.mimeType, options.label)
      let file = join(dir, name)
      for (let n = 2; existsSync(file); n++) file = join(dir, name.replace(/(\.\w+)$/, `-${n}$1`))
      writeFileSync(file, Buffer.from(image.data, 'base64'))
      saved.push(relative(options.cwd, file))
    }
    note = `Saved to ${saved.join(', ')}.`
  } catch (e) {
    const why = (e as Error).message
    note = saved.length > 0 ? `Saved to ${saved.join(', ')}; the rest not saved: ${why}` : `Not saved to ${SCREENSHOTS_DIR}: ${why}`
  }
  return { ...result, content: [...result.content, { type: 'text', text: note }] }
}
