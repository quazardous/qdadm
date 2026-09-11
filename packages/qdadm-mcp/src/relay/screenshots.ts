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

/** `20260911-112233-34fcb409-books-12-edit.jpg` */
export function screenshotFileName(at: Date, meta: ScreenshotMeta, mimeType: string): string {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg'
  return `${stamp(at)}-${(meta.instance ?? 'tab').slice(0, 8)}-${pageSlug(meta.location)}.${ext}`
}

export interface KeepScreenshotOptions {
  /** The project: where `.aiball/screenshots/` goes, and what the path in the answer is relative to. */
  cwd: string
  now?: () => Date
}

/** Writes the picture of a `screenshot` answer and adds where to the answer. Saving never fails the call. */
export function keepScreenshot(result: CallToolResult, options: KeepScreenshotOptions): CallToolResult {
  const image = result.content.find((c) => c.type === 'image') as { data: string; mimeType: string } | undefined
  if (result.isError || !image) return result

  const meta: ScreenshotMeta = { ...((result._meta?.[SCREENSHOT_META] as ScreenshotMeta | undefined) ?? {}) }
  if (!meta.instance) {
    // A relay older than the front sends no _meta: its text still starts with the instance.
    const text = result.content.find((c) => c.type === 'text') as { text: string } | undefined
    meta.instance = /^Instance (\w{8})/.exec(text?.text ?? '')?.[1]
  }

  let note: string
  try {
    const dir = join(options.cwd, SCREENSHOTS_DIR)
    mkdirSync(dir, { recursive: true })
    const name = screenshotFileName((options.now ?? (() => new Date()))(), meta, image.mimeType)
    let file = join(dir, name)
    for (let n = 2; existsSync(file); n++) file = join(dir, name.replace(/(\.\w+)$/, `-${n}$1`))
    writeFileSync(file, Buffer.from(image.data, 'base64'))
    note = `Saved to ${relative(options.cwd, file)}.`
  } catch (e) {
    note = `Not saved to ${SCREENSHOTS_DIR}: ${(e as Error).message}`
  }
  return { ...result, content: [...result.content, { type: 'text', text: note }] }
}
