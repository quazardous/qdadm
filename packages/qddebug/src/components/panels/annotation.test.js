/**
 * The strokes of a screenshot annotation in the MCP tab (#2309).
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { Annotation, PEN_COLORS, drawStrokes, penWidth, toPicture } from './annotation'

describe('screenshot annotation (#2309)', () => {
  it('draws strokes in the chosen colour, with a pen sized to the picture, kept inside it', () => {
    const a = new Annotation(1600, 900)
    a.begin({ x: 10, y: 10 })
    a.extend({ x: 20, y: 30 })
    a.end()
    a.color = PEN_COLORS[4].value
    a.begin({ x: 100, y: 100 })
    a.extend({ x: 5000, y: -3 })
    a.end()
    a.extend({ x: 1, y: 1 }) // after end: not part of any stroke

    expect(penWidth(1600, 900)).toBe(6)
    expect(a.strokes).toEqual([
      { color: '#ef4444', width: 6, points: [{ x: 10, y: 10 }, { x: 20, y: 30 }] },
      { color: '#3b82f6', width: 6, points: [{ x: 100, y: 100 }, { x: 1600, y: 0 }] },
    ])
  })

  it('undo removes the last stroke, clear removes them all', () => {
    const a = new Annotation(200, 100)
    for (const x of [10, 20, 30]) {
      a.begin({ x, y: 5 })
      a.end()
    }
    a.undo()
    expect(a.strokes.map((s) => s.points[0].x)).toEqual([10, 20])
    a.clear()
    expect(a.empty).toBe(true)
    expect(penWidth(200, 100)).toBe(3)
  })

  it('maps a pointer on the picture as displayed to its own pixels', () => {
    const rect = { left: 50, top: 50, width: 400, height: 225 }
    expect(toPicture(150, 100, rect, 1600, 900)).toEqual({ x: 400, y: 200 })
    expect(toPicture(0, 1000, rect, 1600, 900)).toEqual({ x: 0, y: 900 })
  })

  it('replays the strokes on a canvas context; a click without a move leaves a dot', () => {
    const calls = []
    const ctx = {
      set strokeStyle(v) {
        calls.push(['strokeStyle', v])
      },
      set lineWidth(v) {
        calls.push(['lineWidth', v])
      },
      lineCap: '',
      lineJoin: '',
      beginPath: () => calls.push(['beginPath']),
      moveTo: (x, y) => calls.push(['moveTo', x, y]),
      lineTo: (x, y) => calls.push(['lineTo', x, y]),
      stroke: () => calls.push(['stroke']),
    }

    drawStrokes(ctx, [{ color: '#22c55e', width: 4, points: [{ x: 5, y: 6 }] }])

    expect(calls).toEqual([
      ['strokeStyle', '#22c55e'],
      ['lineWidth', 4],
      ['beginPath'],
      ['moveTo', 5, 6],
      ['lineTo', 5.01, 6],
      ['stroke'],
    ])
    expect(ctx.lineCap).toBe('round')
  })
})
