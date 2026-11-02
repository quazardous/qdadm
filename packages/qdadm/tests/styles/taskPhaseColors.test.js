// @vitest-environment node
/**
 * A running phase has its own colour, not the theme's primary, which may be
 * the green of done (#4662); its bar sweeps, except under reduced motion.
 *
 * jsdom computes no CSS, so this reads the compiled stylesheet itself.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { fileURLToPath } from 'node:url'
import * as sass from 'sass'

const indexScss = fileURLToPath(new URL('../../src/styles/index.scss', import.meta.url))

let css
const rules = (selector) =>
  css.split('}').filter((r) => r.slice(0, r.indexOf('{')).split(',').map((s) => s.trim()).includes(selector))

beforeAll(() => {
  css = sass.compile(indexScss, { style: 'expanded' }).css
})

describe('the running phase (#4662)', () => {
  it('its colours are variables an app may override, orange and green by default', () => {
    const root = rules('.qd-task-phases').join('')
    expect(root).toMatch(/--qd-task-running-color:\s*var\(--p-orange-500\)/)
    expect(root).toMatch(/--qd-task-done-color:\s*var\(--p-green-500\)/)
    expect(rules('.qd-task-phase--running').join('')).toMatch(/--qd-phase-color:\s*var\(--qd-task-running-color\)/)
    expect(rules('.qd-task-phase--done').join('')).toMatch(/--qd-phase-color:\s*var\(--qd-task-done-color\)/)
  })

  it('nothing in the frieze takes the primary colour any more', () => {
    const frieze = css.slice(css.indexOf('.qd-task-phases {'), css.indexOf('.qd-task-phase-filter {'))
    expect(frieze).not.toMatch(/--p-primary-color/)
  })

  it('its bar sweeps, and stops under reduced motion', () => {
    expect(rules('.qd-task-phases-list > .qd-task-phase--running::after').join('')).toMatch(/animation:\s*qd-task-sweep-x/)
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduced.slice(0, reduced.indexOf('}') + 1)).toMatch(/qd-task-phase--running::after\s*\{\s*display:\s*none/)
  })
})
