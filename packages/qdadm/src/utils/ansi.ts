/**
 * ANSI SGR parsing for log output (#4110).
 *
 * Only the Select Graphic Rendition sequences (`ESC [ … m`) carry meaning in
 * a log: colours and weight. Every other escape (cursor moves, erase line,
 * OSC titles) is dropped, since a tail has no cursor to move.
 *
 * The style carries from one line to the next, as in a terminal: a worker
 * that prints `ESC[31m` and two lines later `ESC[0m` coloured both lines.
 * So a stream is parsed in order, passing the state along.
 */

export interface AnsiStyle {
  fg?: string
  bg?: string
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
  inverse?: boolean
}

export interface AnsiSegment {
  text: string
  style: AnsiStyle
}

/** xterm's default 16 colours: 0-7 normal, 8-15 bright. */
const BASE_COLORS = [
  '#000000', '#cd3131', '#0dbc79', '#e5e510', '#2472c8', '#bc3fbc', '#11a8cd', '#e5e5e5',
  '#666666', '#f14c4c', '#23d18b', '#f5f543', '#3b8eea', '#d670d6', '#29b8db', '#ffffff',
]

function color256(n: number): string | undefined {
  if (n < 0 || n > 255) return undefined
  if (n < 16) return BASE_COLORS[n]
  if (n < 232) {
    const c = n - 16
    const level = (v: number) => (v === 0 ? 0 : 55 + v * 40)
    const r = level(Math.floor(c / 36))
    const g = level(Math.floor(c / 6) % 6)
    const b = level(c % 6)
    return `rgb(${r}, ${g}, ${b})`
  }
  const grey = 8 + (n - 232) * 10
  return `rgb(${grey}, ${grey}, ${grey})`
}

// eslint-disable-next-line no-control-regex
const ESCAPE = /\x1b\[([0-9;:]*)([A-Za-z])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g

/** The text of a line without any escape sequence. */
export function stripAnsi(text: string): string {
  return text.replace(ESCAPE, '')
}

/** Apply one SGR parameter list to a style, returning the new style. */
function applySgr(style: AnsiStyle, params: string): AnsiStyle {
  const codes = params === '' ? [0] : params.split(/[;:]/).map((p) => (p === '' ? 0 : Number(p)))
  let next: AnsiStyle = { ...style }
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]!
    if (code === 0) next = {}
    else if (code === 1) next.bold = true
    else if (code === 2) next.dim = true
    else if (code === 3) next.italic = true
    else if (code === 4) next.underline = true
    else if (code === 7) next.inverse = true
    else if (code === 22) { delete next.bold; delete next.dim }
    else if (code === 23) delete next.italic
    else if (code === 24) delete next.underline
    else if (code === 27) delete next.inverse
    else if (code >= 30 && code <= 37) next.fg = BASE_COLORS[code - 30]
    else if (code >= 90 && code <= 97) next.fg = BASE_COLORS[code - 90 + 8]
    else if (code === 39) delete next.fg
    else if (code >= 40 && code <= 47) next.bg = BASE_COLORS[code - 40]
    else if (code >= 100 && code <= 107) next.bg = BASE_COLORS[code - 100 + 8]
    else if (code === 49) delete next.bg
    else if (code === 38 || code === 48) {
      const key = code === 38 ? 'fg' : 'bg'
      let value: string | undefined
      if (codes[i + 1] === 5) {
        value = color256(codes[i + 2] ?? -1)
        i += 2
      } else if (codes[i + 1] === 2) {
        const [r, g, b] = [codes[i + 2], codes[i + 3], codes[i + 4]]
        if ([r, g, b].every((v) => v !== undefined && v >= 0 && v <= 255)) value = `rgb(${r}, ${g}, ${b})`
        i += 4
      }
      if (value) next[key] = value
    }
  }
  return next
}

/**
 * Split one line into styled segments, starting from `state` (the style the
 * previous line ended in). Returns the segments and the style this line ends
 * in, for the next one.
 */
export function parseAnsiLine(line: string, state: AnsiStyle = {}): { segments: AnsiSegment[]; state: AnsiStyle } {
  const segments: AnsiSegment[] = []
  let style = state
  let last = 0
  ESCAPE.lastIndex = 0
  for (let m = ESCAPE.exec(line); m; m = ESCAPE.exec(line)) {
    if (m.index > last) segments.push({ text: line.slice(last, m.index), style })
    if (m[2] === 'm') style = applySgr(style, m[1] ?? '')
    last = m.index + m[0].length
  }
  if (last < line.length) segments.push({ text: line.slice(last), style })
  return { segments, state: style }
}

/** Inline CSS for a style; inverse swaps the colours it has. */
export function ansiStyleToCss(style: AnsiStyle): Record<string, string> {
  const css: Record<string, string> = {}
  const fg = style.inverse ? style.bg ?? 'var(--qd-log-bg)' : style.fg
  const bg = style.inverse ? style.fg ?? 'var(--qd-log-fg)' : style.bg
  if (fg) css.color = fg
  if (bg) css.backgroundColor = bg
  if (style.bold) css.fontWeight = '700'
  if (style.dim) css.opacity = '0.65'
  if (style.italic) css.fontStyle = 'italic'
  if (style.underline) css.textDecoration = 'underline'
  return css
}
