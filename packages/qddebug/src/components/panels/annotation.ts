/**
 * The strokes drawn over a screenshot in the MCP tab (#2309): a pen, a colour, undo. Pure: the overlay replays them
 * on a canvas, the tests read them.
 */

export interface Point {
  x: number
  y: number
}

export interface Stroke {
  color: string
  width: number
  points: Point[]
}

export const PEN_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#facc15' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'White', value: '#ffffff' },
] as const

/** A pen that reads on a picture of any size: about 1/250 of its longest edge. */
export const penWidth = (width: number, height: number): number => Math.max(3, Math.round(Math.max(width, height) / 250))

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max)

export class Annotation {
  readonly width: number
  readonly height: number
  strokes: Stroke[] = []
  color: string = PEN_COLORS[0].value
  private current: Stroke | null = null

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }

  get empty(): boolean {
    return this.strokes.length === 0
  }

  private inside(p: Point): Point {
    return { x: clamp(p.x, this.width), y: clamp(p.y, this.height) }
  }

  begin(p: Point): void {
    this.current = { color: this.color, width: penWidth(this.width, this.height), points: [this.inside(p)] }
    this.strokes.push(this.current)
  }

  extend(p: Point): void {
    this.current?.points.push(this.inside(p))
  }

  end(): void {
    this.current = null
  }

  undo(): void {
    this.current = null
    this.strokes.pop()
  }

  clear(): void {
    this.current = null
    this.strokes = []
  }
}

/** What drawing needs from a 2D canvas context. */
export interface PenContext {
  strokeStyle: unknown
  lineWidth: number
  lineCap: string
  lineJoin: string
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  stroke(): void
}

/** Replays the strokes, in picture coordinates. A click without a move leaves a dot. */
export function drawStrokes(ctx: PenContext, strokes: readonly Stroke[]): void {
  for (const stroke of strokes) {
    const [first, ...rest] = stroke.points
    if (!first) continue
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(first.x, first.y)
    if (rest.length === 0) ctx.lineTo(first.x + 0.01, first.y)
    for (const p of rest) ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }
}

/** A pointer on the picture as displayed → the picture's own pixels. */
export function toPicture(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  width: number,
  height: number
): Point {
  return {
    x: clamp(((clientX - rect.left) / rect.width) * width, width),
    y: clamp(((clientY - rect.top) / rect.height) * height, height),
  }
}
