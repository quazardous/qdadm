/**
 * A picture of the tab (#2247): what the user sees, as an image an agent can look at.
 *
 * Two sources:
 * - `dom` (default): snapdom renders the page's DOM into a canvas. No
 *   permission, nothing for the user to do — but it is a re-rendering, not
 *   pixels: a cross-origin image without CORS, or an exotic CSS effect, may
 *   come out differently.
 * - `tab`: real pixels, from a tab capture the user started with a click in
 *   the MCP tab of the debug bar. The browser asks first, and shows its
 *   sharing bar while the capture runs.
 *
 * Loaded on first use: a tab nobody photographs never downloads snapdom.
 */
import { snapdom, type SnapdomPlugin } from '@zumer/snapdom'
import { DEBUG_BAR } from './aria.ts'

export interface ShotOptions {
  /** Only this element. */
  element?: Element | null
  /** The whole page, not just the viewport (dom source only). */
  fullPage?: boolean
  /** "jpeg" (default) or "png". */
  format?: string
  /** JPEG quality, 0–1 (default 0.8). */
  quality?: number
  /** Keep the debug bar in the picture (dom source only; a tab capture always shows it). */
  withDebugBar?: boolean
}

export interface Shot {
  data: string
  mimeType: string
  width: number
  height: number
  source: 'dom' | 'tab'
}

/** The longest edge an agent gets: past it, an image costs context for detail nobody reads. */
const MAX_EDGE = 1600

function encode(canvas: HTMLCanvasElement, options: ShotOptions, source: Shot['source']): Shot {
  let out = canvas
  const edge = Math.max(canvas.width, canvas.height)
  if (edge > MAX_EDGE) {
    const k = MAX_EDGE / edge
    out = document.createElement('canvas')
    out.width = Math.round(canvas.width * k)
    out.height = Math.round(canvas.height * k)
    out.getContext('2d')?.drawImage(canvas, 0, 0, out.width, out.height)
  }
  const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg'
  const url = out.toDataURL(mimeType, Math.min(Math.max(Number(options.quality) || 0.8, 0.1), 1))
  return { data: url.slice(url.indexOf(',') + 1), mimeType, width: out.width, height: out.height, source }
}

export async function domShot(options: ShotOptions = {}): Promise<Shot> {
  // <body>, not <html>: rendered from <html>, snapdom drops the position:fixed parts of a
  // layout (qdadm's sidebar) and shifts the rest — measured on the demo.
  const target = options.element ?? document.body
  const viewport = !options.element && !options.fullPage
  const canvas = await snapdom.toCanvas(target, {
    dpr: 1,
    exclude: options.withDebugBar ? [] : [DEBUG_BAR],
    excludeMode: 'hide',
    embedFonts: true,
    backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
    ...(viewport ? { plugins: [fixedAtScroll()] } : {}),
  })
  return encode(viewport ? cropToViewport(canvas, target) : canvas, options, 'dom')
}

/**
 * A scrolled page (#2312): snapdom renders `<body>` whole, where a `position: fixed` element sits as at scroll 0,
 * and the viewport is then cropped at the scroll — a fixed sidebar came out cut, an `inset: 0` overlay spanned the
 * whole document. In the clone only, each fixed element gets the box the user sees: moved by the scroll, sized as
 * on screen. The page itself is not touched.
 */
export function fixedAtScroll(): SnapdomPlugin {
  return {
    name: 'qdadm-fixed-at-scroll',
    afterClone({ clone, nodeMap }) {
      const { scrollX, scrollY } = window
      if (!clone || !nodeMap || (!scrollX && !scrollY)) return
      for (const [copy, source] of nodeMap) {
        if (!(source instanceof HTMLElement) || !(copy instanceof HTMLElement)) continue
        const style = getComputedStyle(source)
        if (style.position !== 'fixed') continue
        const pin = (property: string, value: string) => copy.style.setProperty(property, value, 'important')
        pin('top', `${(parseFloat(style.top) || 0) + scrollY}px`)
        pin('left', `${(parseFloat(style.left) || 0) + scrollX}px`)
        pin('bottom', 'auto')
        pin('right', 'auto')
        pin('box-sizing', 'border-box')
        pin('width', `${source.offsetWidth}px`)
        pin('height', `${source.offsetHeight}px`)
      }
    },
  }
}

/**
 * What the user sees of a whole-body rendering. snapdom's own `clip: 'viewport'` misplaces
 * sticky parts (a table header), so the body is rendered whole and cropped here.
 */
function cropToViewport(canvas: HTMLCanvasElement, rendered: Element): HTMLCanvasElement {
  const box = rendered.getBoundingClientRect()
  if (box.width === 0) return canvas
  const k = canvas.width / box.width
  const sx = Math.max(0, Math.round(-box.left * k))
  const sy = Math.max(0, Math.round(-box.top * k))
  const sw = Math.min(canvas.width - sx, Math.round(document.documentElement.clientWidth * k))
  const sh = Math.min(canvas.height - sy, Math.round(document.documentElement.clientHeight * k))
  if (sx === 0 && sy === 0 && sw >= canvas.width && sh >= canvas.height) return canvas
  const out = document.createElement('canvas')
  out.width = sw
  out.height = sh
  out.getContext('2d')?.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
  return out
}

/** A frame of the capture the user started (the connector holds the stream: it is asked for inside their click). */
export async function tabShot(stream: MediaStream, options: ShotOptions = {}): Promise<Shot> {
  const track = stream.getVideoTracks()[0]
  if (!track || track.readyState !== 'live') {
    throw new Error('The tab capture has ended — ask the user to start it again from the MCP tab of the debug bar.')
  }
  const video = document.createElement('video')
  video.muted = true
  video.srcObject = stream
  await video.play()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  const width = video.videoWidth
  const height = video.videoHeight
  let sx = 0
  let sy = 0
  let sw = width
  let sh = height
  if (options.element) {
    // The capture is the viewport, at the capture's own resolution.
    const k = width / window.innerWidth
    const box = options.element.getBoundingClientRect()
    sx = Math.max(0, Math.round(box.left * k))
    sy = Math.max(0, Math.round(box.top * k))
    sw = Math.max(1, Math.min(width - sx, Math.round(box.width * k)))
    sh = Math.max(1, Math.min(height - sy, Math.round(box.height * k)))
  }
  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  canvas.getContext('2d')?.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh)
  video.pause()
  video.srcObject = null
  return encode(canvas, options, 'tab')
}
