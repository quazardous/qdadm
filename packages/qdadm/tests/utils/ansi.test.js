/**
 * ANSI SGR parsing for LogStream (#4110).
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { parseAnsiLine, stripAnsi, ansiStyleToCss } from '../../src/utils/ansi'

const ESC = '\x1b'

describe('ANSI parsing (#4110)', () => {
  it('splits a line into styled segments', () => {
    const { segments } = parseAnsiLine(`${ESC}[1;31mERROR${ESC}[0m disk full`)
    expect(segments).toEqual([
      { text: 'ERROR', style: { bold: true, fg: '#cd3131' } },
      { text: ' disk full', style: {} },
    ])
  })

  it('carries the style to the next line, as a terminal does', () => {
    const first = parseAnsiLine(`${ESC}[32mstep 1`)
    const second = parseAnsiLine('step 2', first.state)
    expect(second.segments[0].style.fg).toBe('#0dbc79')
    const third = parseAnsiLine(`${ESC}[mstep 3`, second.state)
    expect(third.segments[0].style).toEqual({})
  })

  it('reads bright, 256 and truecolor colours', () => {
    expect(parseAnsiLine(`${ESC}[94mx`).segments[0].style.fg).toBe('#3b8eea')
    expect(parseAnsiLine(`${ESC}[38;5;196mx`).segments[0].style.fg).toBe('rgb(255, 0, 0)')
    expect(parseAnsiLine(`${ESC}[48;5;244mx`).segments[0].style.bg).toBe('rgb(128, 128, 128)')
    expect(parseAnsiLine(`${ESC}[38;2;10;20;30mx`).segments[0].style.fg).toBe('rgb(10, 20, 30)')
  })

  it('drops escapes that are not colours', () => {
    const line = `${ESC}[2K${ESC}[1Gprogress ${ESC}]0;title\x07done`
    expect(stripAnsi(line)).toBe('progress done')
    expect(parseAnsiLine(line).segments.map((s) => s.text).join('')).toBe('progress done')
  })

  it('turns a style into inline CSS, swapping colours on inverse', () => {
    expect(ansiStyleToCss({ fg: 'red', bold: true, underline: true })).toEqual({
      color: 'red',
      fontWeight: '700',
      textDecoration: 'underline',
    })
    expect(ansiStyleToCss({ fg: 'red', inverse: true })).toEqual({ color: 'var(--qd-log-bg)', backgroundColor: 'red' })
  })
})
