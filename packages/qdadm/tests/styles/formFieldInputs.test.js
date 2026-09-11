// @vitest-environment node
/**
 * `.form-field` stretches text inputs to the full row, never native checkboxes or radios (#2319).
 *
 * jsdom has no layout, so this reads the compiled stylesheet itself: every selector that forces
 * `.form-field input` to `width: 100% !important` must leave checkbox and radio inputs out.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import * as sass from 'sass'

const indexScss = fileURLToPath(new URL('../../src/styles/index.scss', import.meta.url))

describe('.form-field input widths (#2319)', () => {
  it('the full-width rule covers text-like inputs only', () => {
    const css = sass.compile(indexScss, { style: 'expanded' }).css
    const selectors = css
      .split('}')
      .filter((rule) => /width:\s*100%\s*!important/.test(rule))
      .flatMap((rule) => rule.slice(0, rule.indexOf('{')).split(','))
      .map((s) => s.trim())
      .filter((s) => /\.form-field\s+input\b/.test(s))

    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      expect(selector).toMatch(/:not\(\[type=["']?checkbox["']?\]\)/)
      expect(selector).toMatch(/:not\(\[type=["']?radio["']?\]\)/)
    }
  })

  it('a checkbox or radio placed directly in the field is not stretched by its flex column', () => {
    const css = sass.compile(indexScss, { style: 'expanded' }).css
    const rule = css
      .split('}')
      .find((r) => /\.form-field\s*>\s*input\[type=["']?checkbox["']?\]/.test(r) && /align-self:\s*flex-start/.test(r))

    expect(rule).toBeDefined()
    expect(rule).toMatch(/\.form-field\s*>\s*input\[type=["']?radio["']?\]/)
  })
})
